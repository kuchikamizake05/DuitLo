export type RateLimitResult =
  | { allowed: true; retryAfterSeconds: 0 }
  | { allowed: false; retryAfterSeconds: number; reason?: "unavailable" };

type RateLimiter = ReturnType<typeof createRateLimiter>;
type FetchLike = (input: string, init: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export function createRateLimiter({ maxRequests, windowMs }: { maxRequests: number; windowMs: number }) {
  const buckets = new Map<string, number[]>();

  return {
    consume(key: string, now = Date.now()): RateLimitResult {
      const active = (buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
      if (active.length >= maxRequests) {
        buckets.set(key, active);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - active[0])) / 1_000)) };
      }
      active.push(now);
      buckets.set(key, active);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}

export function getUpstashConfig(environment: Record<string, string | undefined>) {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    if (new URL(url).protocol !== "https:") return null;
    return { url, token };
  } catch {
    return null;
  }
}

async function hashKey(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeRouteRateLimit({ route, userId, maxRequests, windowMs, fallback, environment = process.env, fetchImpl = fetch, timeoutMs = 1500 }: {
  route: string;
  userId: string;
  maxRequests: number;
  windowMs: number;
  fallback: RateLimiter;
  environment?: Record<string, string | undefined>;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): Promise<RateLimitResult> {
  const unavailable = (): RateLimitResult => environment.NODE_ENV === "development" || environment.NODE_ENV === "test" || environment.RATE_LIMIT_ALLOW_LOCAL === "true"
    ? fallback.consume(userId)
    : { allowed: false, reason: "unavailable", retryAfterSeconds: 5 };
  const config = getUpstashConfig(environment);
  if (!config) return unavailable();

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const key = `fintrack:rate-limit:${await hashKey(`${route}:${userId}`)}`;
    const script = "local count=redis.call('INCR',KEYS[1]);if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end;return {count,redis.call('PTTL',KEYS[1])}";
    const operation = async (): Promise<RateLimitResult> => {
      const response = await fetchImpl(config.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["EVAL", script, "1", key, String(windowMs)]),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return unavailable();
      const payload = await response.json() as { result?: unknown };
      if (!Array.isArray(payload.result) || !Number.isSafeInteger(payload.result[0]) || payload.result[0] < 1 || !Number.isFinite(payload.result[1]) || payload.result[1] < 0) return unavailable();
      if (payload.result[0] <= maxRequests) return { allowed: true, retryAfterSeconds: 0 };
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(payload.result[1] / 1_000)) };
    };
    return await Promise.race([operation(), new Promise<RateLimitResult>((resolve) => {
      timer = setTimeout(() => { controller.abort(); resolve(unavailable()); }, Math.max(1, Math.min(timeoutMs, 5000)));
    })]);
  } catch {
    return unavailable();
  } finally {
    if (timer) clearTimeout(timer);
  }
}
