import { createRequestObservability } from "@/server/observability";
import { reserveReceiptUsage, finishReceiptUsage } from "@/server/billing/usage";
import { BillingError } from "@/server/billing/billing";
import { NextRequest } from "next/server";
import { createTimeoutSignal } from "@/lib/async";
import { authenticateSupabaseAccessToken } from "@/infrastructure/supabase/server-client";
import { noStoreJson as baseJson } from "@/server/http";
import { consumeRouteRateLimit } from "@/lib/rate-limit";
import { validateSharedReceiptFile } from "@/lib/shared-receipt";
import {
  buildQwenReceiptRequest,
  createReceiptRateLimiter,
  mapQwenFailure,
  parseQwenReceiptResponse,
  ReceiptParseError,
  type ReceiptExtraction,
  validateReceiptParseSecurity,
} from "@/lib/receipt-vision";

const json = (body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) => {
  const observation = createRequestObservability("receipts:parse");
  const details = typeof body.correlationId === "string" ? { correlationId: body.correlationId } : status >= 500 ? observation.failure("upstream_unavailable", null, status) : { correlationId: observation.correlationId };
  return baseJson(status >= 400 ? { ...details, ...body } : body, status, { "X-Correlation-Id": details.correlationId, ...headers });
};
export const dynamic = "force-dynamic";

const limiter = createReceiptRateLimiter({ maxRequests: 5, windowMs: 60_000 });
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const host=request.headers.get("host");
  if(host)requestUrl.host=host;
  const security = validateReceiptParseSecurity({
    origin: request.headers.get("origin"),
    requestOrigin: requestUrl.origin,
    authorization: request.headers.get("authorization"),
  });

  if (!security.ok) {
    return json({ error: "Permintaan atau sesi tidak valid." }, 403);
  }

  const authentication = await authenticateSupabaseAccessToken(security.accessToken);
  if (!authentication.ok) {
    const unavailable = authentication.reason === "configuration";
    return json(
      { error: unavailable ? "Layanan belum dikonfigurasi." : "Sesi login tidak valid." },
      unavailable ? 503 : 401,
    );
  }
  const { user } = authentication;

  const rateLimit = await consumeRouteRateLimit({ route: "receipts:parse", userId: user.id, maxRequests: 5, windowMs: 60_000, fallback: limiter });
  if (!rateLimit.allowed && rateLimit.reason === "unavailable") {
    const observation = createRequestObservability("rate_limit");
    return json({error: "Layanan sementara tidak tersedia. Coba lagi sebentar.", ...observation.failure("rate_limit_unavailable", null, 503)}, 503, {"Retry-After": String(rateLimit.retryAfterSeconds), "X-Correlation-Id": observation.correlationId});
  }
  if (!rateLimit.allowed) {
    return json(
      { error: "Terlalu banyak permintaan pembacaan struk. Coba lagi sebentar." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Format data tidak valid." }, 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return json({ error: "File bukti pembayaran tidak ditemukan." }, 400);
  }

  const validationError = validateSharedReceiptFile(file);
  if (validationError) {
    return json({ error: validationError }, 400);
  }

  if (!supportedImageTypes.has(file.type)) {
    return json(
      { error: "Format file ini belum didukung untuk ekstraksi otomatis. Silakan isi form secara manual." },
      422,
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return json({ error: "Layanan pembacaan struk otomatis belum dikonfigurasi." }, 503);
  }

  const model = process.env.OPENROUTER_RECEIPT_MODEL?.trim() || "qwen/qwen3.7-flash";
  const operationId = request.headers.get("idempotency-key") ?? crypto.randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) {
    return json({error: "ID permintaan tidak valid."}, 400);
  }
  try {
    const reservation = await reserveReceiptUsage(user.id, operationId);
    if (!reservation.reserved || reservation.replayed) return json({error: "Permintaan ini sudah diproses. Mulai pemindaian baru."}, 409);
  } catch (error) {
    const status = error instanceof BillingError && error.status === 402 ? 402 : 503;
    return json({error: status === 402 ? "Kuota pembacaan struk bulan ini habis." : "Kuota belum dapat diperiksa. Coba lagi sebentar."}, status);
  }
  let completed = false;
  const timeout = createTimeoutSignal(60_000);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const qwenPayload = buildQwenReceiptRequest({
      mimeType: file.type,
      base64Data,
    });

    let usedModel=model;
    const models=[model,process.env.OPENROUTER_RECEIPT_FALLBACK_MODEL?.trim()||"qwen/qwen3.7-plus"];

    let providerResponse: Response | null = null;
    let extraction: ReceiptExtraction | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      usedModel=models[attempt];
      const endpoint="https://openrouter.ai/api/v1/chat/completions";
      providerResponse = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-OpenRouter-Title": "DuitLo",
        },
        body: JSON.stringify({ model: usedModel, ...qwenPayload }),
        cache: "no-store",
        signal: timeout.signal,
      });

      if (providerResponse.ok) {
        try {
          extraction = parseQwenReceiptResponse(await providerResponse.json());
          break;
        } catch (error) {
          if (attempt === 1) throw error;
          const code = error instanceof ReceiptParseError ? error.code : "invalid_response";
          createRequestObservability("receipts:parse").failure(`receipt_${code}_retry`, null, 422);
        }
      } else if ((providerResponse.status < 500&&providerResponse.status!==404&&providerResponse.status!==429) || attempt === 1) {
        break;
      }
      await wait(100 + Math.floor(Math.random() * 100));
    }

    if (!providerResponse?.ok) {
      createRequestObservability("receipts:parse").failure("provider_rejected", null, providerResponse?.status ?? 502);
      const failure = providerResponse?.status===503?{message:"Layanan AI sedang sibuk. Coba lagi sebentar.",status:503}:mapQwenFailure(providerResponse?.status ?? 500);
      const retryAfter = providerResponse?.headers.get("retry-after");
      return json({ error: failure.message }, failure.status, retryAfter ? { "Retry-After": retryAfter } : {});
    }

    if (!extraction) throw new ReceiptParseError("missing_content");
    await finishReceiptUsage(user.id, operationId, true);
    completed = true;

    return json(
      {
        extraction,
        model:usedModel,
      },
      200,
    );
  } catch (error) {
    if (error instanceof BillingError) return json({error: "Hasil pemindaian belum dapat dikonfirmasi. Coba lagi sebentar."}, 503);
    if (error instanceof Error && error.name === "AbortError") {
      return json({ error: "AI tidak merespons tepat waktu. Silakan isi form manual." }, 504);
    }
    if (error instanceof Error && error.message) {
      const observation = createRequestObservability("receipts:parse");
      const code = error instanceof ReceiptParseError ? `receipt_${error.code}` : "receipt_parse_failed";
      return json({ error: "Hasil analisis struk tidak valid. Silakan isi form manual.", ...observation.failure(code, null, 422) }, 422, {"X-Correlation-Id": observation.correlationId});
    }
    return json({ error: "AI belum bisa menganalisis struk. Silakan isi form manual." }, 502);
  } finally {
    timeout.cleanup();
    if (!completed) {
      try { await finishReceiptUsage(user.id, operationId, false); }
      catch (error) { createRequestObservability("receipts:parse").failure("quota_reconciliation_required", error, 503); }
    }
  }
}
