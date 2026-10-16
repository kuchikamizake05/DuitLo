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
