import { describe, expect, it, vi } from "vitest";
import { createRequestObservability, getReadiness } from "./observability";

describe("safe operations", () => {
 it("logs allowlisted fields and returns a generated correlation ID", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const observation = createRequestObservability("receipts:parse");
  const result = observation.failure("provider_failure", new Error("token secret@email.com"), 502);
  expect(result).toMatchObject({code: "provider_failure", correlationId: expect.any(String)});
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/token|secret@email/);
  log.mockRestore();
 });
 it("does not expose secrets or private configuration in readiness", async () => {
  const result = await getReadiness({NODE_ENV: "production", UPSTASH_REDIS_REST_TOKEN: "super-secret"});
  expect(result.ready).toBe(false);
  expect(JSON.stringify(result)).not.toContain("super-secret");
 });
});

it("requires both reachable configured dependencies", async () => {
 const environment = {NODE_ENV:"production", NEXT_PUBLIC_SUPABASE_URL:"https://database.example", NEXT_PUBLIC_SUPABASE_ANON_KEY:"private-key", UPSTASH_REDIS_REST_URL:"https://redis.example", UPSTASH_REDIS_REST_TOKEN:"private-token"};
 const fetcher = vi.fn(async () => new Response(JSON.stringify({result:"PONG"}), {status:200}));
 expect((await getReadiness(environment,fetcher)).ready).toBe(true);
 expect(fetcher).toHaveBeenCalledTimes(2);
 expect(JSON.stringify(await getReadiness(environment, async () => {throw new Error("private-detail");}))).not.toContain("private");
 expect((await getReadiness(environment,async () => new Response("error",{status:503}))).ready).toBe(false);
 expect((await getReadiness({...environment,NEXT_PUBLIC_SUPABASE_URL:"invalid"},fetcher)).ready).toBe(false);
});

it("checks an empty application query when anonymous OpenAPI discovery is forbidden", async () => {
 const environment={NODE_ENV:"production",NEXT_PUBLIC_SUPABASE_URL:"https://database.example",NEXT_PUBLIC_SUPABASE_ANON_KEY:"public-anon-key",UPSTASH_REDIS_REST_URL:"https://redis.example",UPSTASH_REDIS_REST_TOKEN:"private-token"};
 const fetcher:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.hostname==="redis.example")return new Response(JSON.stringify({result:"PONG"}));
  if(url.pathname==="/rest/v1/")return new Response("metadata access forbidden",{status:401});
  expect(url.pathname).toBe("/rest/v1/categories");
  expect(url.searchParams.get("select")).toBe("id");
  expect(url.searchParams.get("limit")).toBe("0");
  expect(init?.method).toBe("HEAD");
  expect(new Headers(init?.headers).get("apikey")).toBe("public-anon-key");
  return new Response(null,{status:200});
 };
 expect(await getReadiness(environment,fetcher)).toEqual({ready:true,checks:{limiter:"ready",database:"ready"}});
});
