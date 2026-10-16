import { describe, expect, it, vi } from "vitest";
import { submitDataControlRequest, validateDataControlRequest } from "./data-control";
describe("data control requests", () => {
  it("validates a real request without allowing arbitrary categories or huge payloads", () => {
    expect(validateDataControlRequest("delete_account", "")).toBeNull();
    expect(validateDataControlRequest("support", "Need help exporting")).toBeNull();
    expect(validateDataControlRequest("support", " ")).toBeTruthy();
    expect(validateDataControlRequest("admin", "help")).toBeTruthy();
    expect(validateDataControlRequest("support", "x".repeat(2001))).toBeTruthy();
  });
  it("sends no client-provided user ID and reuses the caller's durable request ID", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "request-id", status: "pending" }, error: null });
    const client = { rpc };
    await submitDataControlRequest(client, "request-id", "delete_account", " Please delete ");
    await submitDataControlRequest(client, "request-id", "delete_account", " Please delete ");
    expect(rpc).toHaveBeenNthCalledWith(1, "submit_data_control_request", { request_id: "request-id", request_kind: "delete_account", request_details: "Please delete" });
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });
  it("surfaces storage failure rather than falsely confirming acceptance", async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "Database unavailable" } }) };
    await expect(submitDataControlRequest(client, "request-id", "support", "Help me")).rejects.toThrow();
  });
});
