import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({limit: vi.fn(), reserve: vi.fn(), finish: vi.fn(), auth: vi.fn(), parse: vi.fn(), fetch: vi.fn()}));
vi.mock("@/server/observability", () => ({createRequestObservability: () => ({correlationId:"test-id",failure:()=>({correlationId:"test-id",code:"safe_error"})})}));
vi.mock("@/server/http", () => ({noStoreJson:(body:unknown,status:number,headers:Record<string,string>)=>Response.json(body,{status,headers})}));
vi.mock("@/server/billing/usage", () => ({reserveReceiptUsage:mocks.reserve,finishReceiptUsage:mocks.finish}));
vi.mock("@/server/billing/billing", () => ({BillingError:class BillingError extends Error {status=503;}}));
vi.mock("@/infrastructure/supabase/server-client", () => ({authenticateSupabaseAccessToken:mocks.auth}));
vi.mock("@/lib/rate-limit", () => ({consumeRouteRateLimit:mocks.limit}));
vi.mock("@/lib/async", () => ({createTimeoutSignal:()=>({signal:new AbortController().signal,cleanup:()=>{}})}));
vi.mock("@/lib/shared-receipt", () => ({validateSharedReceiptFile:()=>null}));
vi.mock("@/lib/receipt-vision", () => ({buildQwenReceiptRequest:()=>({}),createReceiptRateLimiter:()=>({}),mapQwenFailure:()=>({message:"safe",status:502}),parseQwenReceiptResponse:mocks.parse,validateReceiptParseSecurity:()=>({ok:true,accessToken:"token"})}));
import { POST } from "../app/api/receipts/parse/route";
function request() {
 const body=new FormData();body.set("file",new File(["image"],"receipt.png",{type:"image/png"}));
 return new NextRequest("https://fintrack.example/api/receipts/parse",{method:"POST",body});
}
beforeEach(()=>{
 vi.resetAllMocks(); vi.stubEnv("OPENROUTER_API_KEY","test");vi.stubGlobal("fetch",mocks.fetch);
 mocks.auth.mockResolvedValue({ok:true,user:{id:"owner"}});mocks.limit.mockResolvedValue({allowed:true});mocks.reserve.mockResolvedValue({reserved:true,replayed:false});mocks.finish.mockResolvedValue(undefined);mocks.fetch.mockResolvedValue(new Response("{}"));mocks.parse.mockReturnValue({amount:50000});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe("receipt provider boundaries",()=>{
 it("returns503 before provider or reservation when limiter unavailable",async()=>{
  mocks.limit.mockResolvedValue({allowed:false,reason:"unavailable",retryAfterSeconds:5});
  const response=await POST(request());expect(response.status).toBe(503);expect(response.headers.get("retry-after")).toBe("5");expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.reserve).not.toHaveBeenCalled();
 });
 it("rejects reservation replays without provider call or refund",async()=>{
  mocks.reserve.mockResolvedValue({reserved:false,replayed:true});expect((await POST(request())).status).toBe(409);expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.finish).not.toHaveBeenCalled();
 });
 it("consumes only successfully parsed scans",async()=>{
  expect((await POST(request())).status).toBe(200);expect(mocks.finish).toHaveBeenCalledWith("owner",expect.any(String),true);
 });
 it("refunds malformed extraction and redacts provider exceptions",async()=>{
  mocks.parse.mockImplementation(()=>{throw new Error("private-token")});const response=await POST(request());expect(response.status).toBe(422);expect(JSON.stringify(await response.json())).not.toContain("private-token");expect(mocks.finish).toHaveBeenCalledWith("owner",expect.any(String),false);
 });
});

it("returns429 when allowance exhausted instead of503",async()=>{
 mocks.limit.mockResolvedValue({allowed:false,retryAfterSeconds:60});const response=await POST(request());expect(response.status).toBe(429);expect(mocks.fetch).not.toHaveBeenCalled();
});
it("does not reserve invalid operation IDs",async()=>{
 const input=request();input.headers.set("idempotency-key","not-uuid");expect((await POST(input)).status).toBe(400);expect(mocks.reserve).not.toHaveBeenCalled();
});
it("fails closed when usage storage unavailable",async()=>{
 mocks.reserve.mockRejectedValue(new Error("private-config"));const response=await POST(request());expect(response.status).toBe(503);expect(mocks.fetch).not.toHaveBeenCalled();expect(JSON.stringify(await response.json())).not.toContain("private-config");
});
it("refunds provider rejection without reporting success",async()=>{
 mocks.fetch.mockResolvedValue(new Response("private-body",{status:400}));expect((await POST(request())).status).toBe(502);expect(mocks.finish).toHaveBeenCalledWith("owner",expect.any(String),false);
});

it("retries retired or unavailable models using the configured Qwen fallback",async()=>{
 vi.stubEnv("OPENROUTER_RECEIPT_MODEL","qwen/qwen3.7-flash");
 vi.stubEnv("OPENROUTER_RECEIPT_FALLBACK_MODEL","qwen/qwen3.7-plus");
 mocks.fetch.mockResolvedValueOnce(new Response("retired model",{status:404})).mockResolvedValueOnce(new Response("{}"));
 const response=await POST(request());
 expect(response.status).toBe(200);
 expect(mocks.fetch).toHaveBeenCalledTimes(2);
 expect(mocks.fetch.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/chat/completions");
 expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).model).toBe("qwen/qwen3.7-flash");
 expect(JSON.parse(mocks.fetch.mock.calls[1][1].body).model).toBe("qwen/qwen3.7-plus");
 expect(await response.json()).toMatchObject({model:"qwen/qwen3.7-plus"});
 expect(mocks.finish).toHaveBeenCalledTimes(1);
 expect(mocks.finish).toHaveBeenCalledWith("owner",expect.any(String),true);
});
