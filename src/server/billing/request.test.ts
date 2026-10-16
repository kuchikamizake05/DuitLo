import { describe, expect, it } from "vitest";
import { readBillingJson } from "./request";

describe("billing request limits", () => {
  it("rejects oversized bodies even without Content-Length", async () => {
    const request = new Request("https://app.example", { method: "POST", body: JSON.stringify({ data: "x".repeat(2000) }) });
    await expect(readBillingJson(request, 1024)).rejects.toMatchObject({ status: 413 });
  });
  it("parses bounded JSON and rejects malformed or missing bodies", async () => {
    await expect(readBillingJson(new Request("https://app.example", { method: "POST", body: '{"operationId":"test"}' }), 1024)).resolves.toEqual({ operationId: "test" });
    await expect(readBillingJson(new Request("https://app.example", { method: "POST", body: "{" }), 1024)).rejects.toMatchObject({ status: 400 });
    await expect(readBillingJson(new Request("https://app.example", { method: "POST" }), 1024)).rejects.toMatchObject({ status: 400 });
  });
});
