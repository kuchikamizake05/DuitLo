import { z } from "zod";
export { createRateLimiter as createReceiptRateLimiter } from "./rate-limit";

const datePattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export const receiptExtractionSchema = z.strictObject({
  date: z.string().regex(datePattern, "Format tanggal harus YYYY-MM-DD").refine(value => {
    const [year,month,day]=value.split("-").map(Number);
    const leapYear=year%4===0&&(year%100!==0||year%400===0);
    const days=[31,leapYear?29:28,31,30,31,30,31,31,30,31,30,31];
    return day>=1&&day<=days[month-1];
  }, "Tanggal transaksi tidak valid.").nullable(),
  merchant: z.string().trim().min(1).max(120).nullable(),
  amount: z.number().finite().positive().max(1_000_000_000_000).nullable(),
  categoryHint: z.string().trim().min(1).max(80).nullable(),
  type: z.enum(["income", "expense"]).nullable(),
  proofKind: z.enum(["receipt", "transfer"]).nullable(),
  note: z.string().trim().min(1).max(300).nullable(),
  rawText: z.string().trim().min(1).max(2_000).nullable(),
  confidence: z.number().finite().min(0).max(1).nullable(),
}).refine((data) => (
  data.date !== null
  || data.merchant !== null
  || data.amount !== null
  || data.categoryHint !== null
  || data.note !== null
  || data.type !== null
), { message: "AI tidak menemukan data transaksi yang valid." });

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

export const receiptGenerationResponseSchema = {
  type: "object",
  properties: {
    date: {
      type: "string",
      description: "Tanggal transaksi dalam format YYYY-MM-DD atau null jika tidak terbaca.",
      nullable: true,
    },
    merchant: {
      type: "string",
      description: "Nama toko/merchant/tujuan pembayaran atau null jika tidak jelas.",
      nullable: true,
    },
    amount: {
      type: "number",
      description: "Total nominal pembayaran final angka positif tanpa simbol/titik atau null jika tidak jelas.",
      nullable: true,
    },
    categoryHint: {
      type: "string",
      description: "Perkiraan kategori transaksi dalam bahasa Indonesia atau null.",
      nullable: true,
    },
    type: {
      type: "string",
      enum: ["income", "expense"],
      description: "income untuk dana masuk, expense untuk pembayaran atau dana keluar, atau null jika tidak jelas.",
      nullable: true,
    },
    proofKind: {
      type: "string",
      enum: ["receipt", "transfer"],
      description: "transfer untuk bukti transfer bank/e-wallet, receipt untuk struk pembayaran, atau null jika tidak jelas.",
      nullable: true,
    },
    note: {
      type: "string",
      description: "Catatan ringkas nama item penting atau keterangan transaksi atau null.",
      nullable: true,
    },
    rawText: {
      type: "string",
      description: "Teks penting yang terbaca pada struk atau null.",
      nullable: true,
    },
    confidence: {
      type: "number",
      description: "Skor keyakinan ekstraksi dari 0.0 sampai 1.0.",
      nullable: true,
    },
  },
  required: ["date", "merchant", "amount", "categoryHint", "type", "proofKind", "note", "rawText", "confidence"],
} as const;

export function buildQwenReceiptRequest({
  mimeType,
  base64Data,
}: {
  mimeType: string;
  base64Data: string;
}) {
  return {
    messages: [
      {
        role: "system",
        content: [
          "Kamu adalah asisten pembaca struk/bukti transaksi untuk DuitLo.",
          "Ekstrak data bukti transaksi dan kembalikan JSON dengan tepat sembilan key yang diminta.",
          "date: format YYYY-MM-DD atau null. Jika hanya tanggal dan bulan, gunakan tahun saat ini jika masuk akal.",
          "merchant: nama merchant atau penerima transfer.",
          "amount: nominal total transaksi sebagai angka positif tanpa simbol, atau null.",
          "type: expense untuk pembayaran/dana keluar, income untuk dana masuk, atau null.",
          "proofKind: transfer untuk bukti transfer bank/e-wallet, receipt untuk struk pembayaran, atau null.",
          "categoryHint: rekomendasi kategori transaksi dalam bahasa Indonesia atau null.",
          "note: rangkuman ringkas transaksi atau tujuan transfer, atau null.",
          "rawText: teks utama yang terbaca di bukti, atau null.",
          "confidence: angka keyakinan dari 0.0 sampai 1.0, atau null.",
          "Jika informasi tidak terbaca, gunakan null. Jangan menambahkan teks di luar JSON.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Baca gambar ini dan kembalikan hasil ekstraksi dalam format JSON." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Data}` } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 1024,
  };
}

export function parseQwenReceiptResponse(value: unknown): ReceiptExtraction {
  try {
    const content = (value as {
      choices?: Array<{ message?: { content?: unknown } }>;
    }).choices?.[0]?.message?.content;
    const rawContent = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((part) => typeof part === "object" && part !== null && "text" in part ? part.text : "").join("")
        : null;

    if (typeof rawContent !== "string") {
      throw new Error("missing text content");
    }

    const parsedJson = JSON.parse(rawContent);
    return receiptExtractionSchema.parse(parsedJson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(error.issues[0]?.message || "Format data struk tidak valid.");
    }
    throw new Error("Gagal membaca hasil analisis bukti pembayaran.");
  }
}

export function validateReceiptParseSecurity({
  origin,
  requestOrigin,
  authorization,
}: {
  origin: string | null;
  requestOrigin: string;
  authorization: string | null;
}) {
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!origin || origin !== requestOrigin || !jwtPattern.test(accessToken)) {
    return { ok: false } as const;
  }
  return { ok: true, accessToken } as const;
}

export function mapQwenFailure(status: number) {
  if (status === 429) {
    return {
      status: 429,
      message: "Batas pemrosesan AI harian/menit tercapai. Silakan isi form secara manual.",
    } as const;
  }
  if (status === 401 || status === 403) {
    return {
      status: 503,
      message: "Layanan pembacaan struk otomatis belum dikonfigurasi.",
    } as const;
  }
  return {
    status: 502,
    message: "AI belum berhasil menganalisis struk. Silakan periksa atau isi manual.",
  } as const;
}
