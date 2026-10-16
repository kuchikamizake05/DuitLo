import { getUpstashConfig } from "../lib/rate-limit";

export function createRequestObservability(route: string) {
  const correlationId = crypto.randomUUID();
  return {
    correlationId,
    failure(code: string, _error: unknown, status: number) {
      console.error(JSON.stringify({ event: "api_error", route, code, status, correlationId }));
      return { code, correlationId };
    },
  };
}

async function probe(operation: (signal: AbortSignal) => Promise<boolean>) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation(controller.signal), new Promise<boolean>((resolve) => {
      timer = setTimeout(() => {controller.abort(); resolve(false);}, 1500);
    })]);
  } catch { return false; }
  finally { if (timer) clearTimeout(timer); }
}

export async function getReadiness(environment: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch) {
  const config = getUpstashConfig(environment);
  const localAllowed = environment.NODE_ENV === "development" || environment.NODE_ENV === "test" || environment.RATE_LIMIT_ALLOW_LOCAL === "true";
  const limiter = config ? await probe(async (signal) => {
    const response = await fetchImpl(config.url, {method: "POST", headers: {Authorization: `Bearer ${config.token}`, "Content-Type": "application/json"}, body: JSON.stringify(["PING"]), signal, cache: "no-store"});
    if (!response.ok) return false;
    const body = await response.json() as {result?: unknown};
    return body.result === "PONG";
  }) : localAllowed;
  let database = false;
  try {
    const url = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? "");
    const key = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (key && (url.protocol === "https:" || (environment.NODE_ENV !== "production" && url.hostname === "localhost"))) {
      database = await probe(async (signal) => {
        const response = await fetchImpl(new URL("/rest/v1/", url).href, {headers: {apikey: key}, signal, cache: "no-store"});
        return response.ok;
      });
    }
  } catch { database = false; }
  return {ready: limiter && database, checks: {limiter: limiter ? "ready" : "unavailable", database: database ? "ready" : "unavailable"}};
}
