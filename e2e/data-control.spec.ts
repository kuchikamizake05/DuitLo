import { test, expect } from "./fixtures";
import { mockReference } from "./reference-fixtures";
test("deletion request is recorded and cancellable without deleting the account", async ({ page }) => {
  await mockReference(page, "light");
  const requests: Array<Record<string, unknown>> = [];
  await page.route("**/rest/v1/data_control_requests**", route => route.fulfill({ json: requests }));
  await page.route("**/rest/v1/rpc/submit_data_control_request", route => {
    const body = route.request().postDataJSON();
    expect(body.user_id).toBeUndefined();
    const request = { id: body.request_id, kind: body.request_kind, details: body.request_details, status: "pending", created_at: "2026-10-16T00:00:00Z", outcome: null };
    requests.push(request);
    return route.fulfill({ json: request });
  });
  await page.route("**/rest/v1/rpc/cancel_data_control_request", route => {
    requests[0].status = "cancelled";
    return route.fulfill({ json: requests[0] });
  });
  await page.goto("/data-controls");
  await page.getByLabel("Request type").selectOption("delete_account");
  await page.getByLabel("I understand this submits a request for review").check();
  await page.getByRole("button", { name: "Submit request", exact: true }).click();
  await expect(page.getByText("pending", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel request", exact: true }).click();
  await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
});

test("settings exposes plan, privacy and support routes and unavailable reminders honestly", async ({page}) => {
  await mockReference(page, "light");
  await page.goto("/settings");
  const links = page.locator("main");
  for (const href of ["/billing", "/data-controls", "/privacy", "/terms", "/support"]) {
    await expect(links.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  await expect(page.locator("#notifReminder")).toBeDisabled();
  await links.locator('a[href="/data-controls"]').click();
  await expect(page).toHaveURL(/\/data-controls$/);
  await expect(page.getByLabel("Request type")).toBeVisible();
});
