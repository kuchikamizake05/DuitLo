import type { Route } from "@playwright/test";

/** Rows must already match the mock route's intended owner/date/filter scope. */
export async function fulfillPostgrestRows(route: Route, rows: unknown[]) {
  const request = route.request();
  const headers = request.headers();
  const url = new URL(request.url());
  const isRead = request.method() === "GET" || request.method() === "HEAD";
  const range = headers.range?.match(/^(?:items=)?(\d+)-(\d*)$/);
  // supabase-js .range() encodes inclusive bounds as offset/limit query parameters.
  const offset = Number(url.searchParams.get("offset") ?? range?.[1] ?? 0);
  const limitValue = url.searchParams.get("limit");
  const limit = limitValue !== null ? Number(limitValue) : range?.[2] ? Number(range[2]) - offset + 1 : rows.length;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 0) {
    throw new Error(`Invalid mock PostgREST range: ${request.url()}`);
  }
  const selected = isRead ? rows.slice(offset, offset + limit) : rows;
  const start = isRead ? offset : 0;
  const contentRange = selected.length ? `${start}-${start + selected.length - 1}/${rows.length}` : `*/${rows.length}`;
  const acceptsObject = headers.accept?.includes("application/vnd.pgrst.object+json");
  await route.fulfill({
    status: 200,
    headers: { "Content-Type": "application/json", "Content-Range": contentRange },
    body: request.method() === "HEAD" ? "" : JSON.stringify(acceptsObject ? (selected[0] ?? null) : selected),
  });
}
