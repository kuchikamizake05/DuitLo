import { describe, expect, it } from "vitest";
import { consumeRouteRateLimit, createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("isolates users and reports retry time", () => {
    const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1_000 });

    expect(limiter.consume("user-1", 1_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.consume("user-2", 1_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.consume("user-1", 1_200)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(limiter.consume("user-1", 1_250)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume("user-1", 2_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("uses hashed Upstash keys when configured", async () => {
    const fallback = createRateLimiter({ maxRequests: 1, windowMs: 1_000 });
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetchImpl = async (input: string, init: RequestInit) => {
      calls.push({ input, init });
      return { ok: true, json: async () => ({ result: [2, 900] }) };
    };

    await expect(consumeRouteRateLimit({
      route: "receipts:parse",
      userId: "user-secret-id",
      maxRequests: 1,
      windowMs: 1_000,
      fallback,
      environment: { NODE_ENV: "test", UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "secret-token" },
      fetchImpl,
    })).resolves.toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe("https://example.upstash.io");
    expect(calls[0]?.init.headers).toEqual({ Authorization: "Bearer secret-token", "Content-Type": "application/json" });
    expect(calls[0]?.init.body).not.toContain("user-secret-id");
  });

  it("falls back locally when Upstash fails", async () => {
    const fallback = createRateLimiter({ maxRequests: 1, windowMs: 1_000 });
    const fetchImpl = async () => ({ ok: false, json: async () => ({}) });
    const options = {
      route: "insights:generate",
      userId: "user-1",
      maxRequests: 1,
      windowMs: 1_000,
      fallback,
      environment: { NODE_ENV: "test", UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "secret-token" },
      fetchImpl,
    };

    await expect(consumeRouteRateLimit(options)).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
    await expect(consumeRouteRateLimit(options)).resolves.toEqual({ allowed: false, retryAfterSeconds: 1 });
  });
});

 describe("production distributed limiter", () => {
  const options = () => ({route: "receipts:parse", userId: "private-user", maxRequests: 1, windowMs: 1000, fallback: createRateLimiter({maxRequests: 1, windowMs: 1000})});
  it("fails closed without Redis configuration", async () => {
    expect(await consumeRouteRateLimit({...options(), environment: {NODE_ENV: "production"}})).toEqual({allowed: false, reason: "unavailable", retryAfterSeconds: 5});
  });
  it("fails closed on Redis errors instead of spending a local allowance", async () => {
    expect(await consumeRouteRateLimit({...options(), environment: {NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "secret"}, fetchImpl: async () => {throw new Error("secret provider response");}})).toEqual({allowed: false, reason: "unavailable", retryAfterSeconds: 5});
  });
  it("bounds an unresponsive Redis call including response body", async () => {
    const start = Date.now();
    const result = await consumeRouteRateLimit({...options(), environment: {NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://example.upstash.io", UPSTASH_REDIS_REST_TOKEN: "secret"}, timeoutMs: 10, fetchImpl: async () => ({ok: true, json: () => new Promise(() => {})})});
    expect(result).toMatchObject({allowed: false, reason: "unavailable"});
    expect(Date.now() - start).toBeLessThan(1000);
  });
 });


it("rejects invalid Redis responses and HTTP errors in production", async () => {
 for (const response of [{ok: false, json: async () => ({})}, {ok: true, json: async () => ({result:[NaN,-1]})}, {ok:true, json: async () => {throw new Error("private");}}]) {
  const result = await consumeRouteRateLimit({route:"test", userId:"test", maxRequests:1, windowMs:1000, fallback:createRateLimiter({maxRequests:1,windowMs:1000}), environment:{NODE_ENV:"production",UPSTASH_REDIS_REST_URL:"https://example.upstash.io",UPSTASH_REDIS_REST_TOKEN:"secret"}, fetchImpl:async()=>response});
  expect(result).toMatchObject({allowed:false,reason:"unavailable"});
 }
});
it("allows only explicit local fallback in private production", async () => {
 const fallback=createRateLimiter({maxRequests:1,windowMs:1000});
 expect(await consumeRouteRateLimit({route:"test",userId:"test",maxRequests:1,windowMs:1000,fallback,environment:{NODE_ENV:"production",RATE_LIMIT_ALLOW_LOCAL:"true"}})).toEqual({allowed:true,retryAfterSeconds:0});
});
