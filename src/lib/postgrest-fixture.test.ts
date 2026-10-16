import type { Route } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import { fulfillPostgrestRows } from "../../e2e/postgrest-response";

function mockRoute(query = "", headers: Record<string, string> = {}, method = "GET") {
  const fulfill = vi.fn(async () => undefined);
  const route = { request: () => ({ url: () => `https://example.test/rest/v1/transactions${query}`, headers: () => headers, method: () => method }), fulfill } as unknown as Route;
  return { route, fulfill };
}

describe("PostgREST browser fixtures", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  it("honors Supabase offset/limit with a complete count and exhausted page", async () => {
    const { route, fulfill } = mockRoute("?offset=2&limit=1", { prefer: "count=exact" });
    await fulfillPostgrestRows(route, rows);
    expect(fulfill).toHaveBeenCalledWith(expect.objectContaining({ body: JSON.stringify([rows[2]]), headers: expect.objectContaining({ "Content-Range": "2-2/4" }) }));
    const empty = mockRoute("?offset=4&limit=2");
    await fulfillPostgrestRows(empty.route, rows);
    expect(empty.fulfill).toHaveBeenCalledWith(expect.objectContaining({ body: "[]", headers: expect.objectContaining({ "Content-Range": "*/4" }) }));
  });
  it("supports inclusive HTTP ranges and gives query parameters precedence", async () => {
    const first = mockRoute("", { range: "items=1-2" });
    await fulfillPostgrestRows(first.route, rows);
    expect(first.fulfill).toHaveBeenCalledWith(expect.objectContaining({ body: JSON.stringify(rows.slice(1, 3)) }));
    const query = mockRoute("?offset=0&limit=1", { range: "2-3" });
    await fulfillPostgrestRows(query.route, rows);
    expect(query.fulfill).toHaveBeenCalledWith(expect.objectContaining({ body: JSON.stringify([rows[0]]) }));
  });
  it("preserves object responses, write representations and HEAD behavior", async () => {
    const object = mockRoute("", { accept: "application/vnd.pgrst.object+json" });
    await fulfillPostgrestRows(object.route, [rows[0]]);
    expect(object.fulfill).toHaveBeenCalledWith(expect.objectContaining({ body: JSON.stringify(rows[0]) }));
    const write = mockRoute("?offset=4&limit=1", {}, "PATCH");
    await fulfillPostgrestRows(write.route, [rows[0]]);
    expect(write.fulfill).toHaveBeenCalledWith(expect.objectContaining({ body: JSON.stringify([rows[0]]) }));
    const head = mockRoute("?limit=1", {}, "HEAD");
    await fulfillPostgrestRows(head.route, rows);
    expect(head.fulfill).toHaveBeenCalledWith(expect.objectContaining({ body: "", headers: expect.objectContaining({ "Content-Range": "0-0/4" }) }));
  });
  it("rejects malformed range requests", async () => {
    await expect(fulfillPostgrestRows(mockRoute("?offset=-1").route, rows)).rejects.toThrow(/invalid/i);
    await expect(fulfillPostgrestRows(mockRoute("?limit=nope").route, rows)).rejects.toThrow(/invalid/i);
  });
});
