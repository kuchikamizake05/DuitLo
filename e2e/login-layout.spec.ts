import { expect, mockSupabase, test } from "./fixtures";

test("auth typography uses the shared readable body font", async ({ page }) => {
  await mockSupabase(page, false);
  await page.goto("/login");
  const body = page.getByText("Masuk menggunakan email dan kata sandi atau akun Google.", {exact:true});
  await expect(body).toBeVisible();
  expect(await body.evaluate(element=>getComputedStyle(element).fontFamily)).toContain("Manrope");
});

test("login controls remain reachable in a short desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await mockSupabase(page, false);
  await page.goto("/login");

  const brand = page.getByRole("link", { name: "FinTrack beranda", exact: true });
  const card = page.getByRole("region", { name: "Selamat datang kembali", exact: true });
  const submit = page.getByRole("button", { name: "Masuk ke FinTrack", exact: true });
  const privacyNote = page.getByText("Hanya kamu yang dapat mengakses catatan keuanganmu.", { exact: true });

  await expect(brand).toBeVisible();
  await expect(brand.getByText("FinTrack", { exact: true })).toBeVisible();
  await expect(submit).toBeVisible();
  await expect(privacyNote).toBeVisible();

  const cardBox = await card.boundingBox();
  const headerBox = await page.locator("header").boundingBox();
  const cardCenterX = (cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2;

  await expect(page.getByText("Kembali ke angka yang benar-benar penting.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Arus kas jelas", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(cardBox).not.toBeNull();
  expect(headerBox).not.toBeNull();
  expect(cardCenterX).toBeGreaterThan(0);
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeInViewport();
});

test("password controls are compact and preserve the password value", async ({ page }) => {
  await mockSupabase(page, false);
  await page.goto("/login");

  const password = page.getByLabel("Kata sandi", { exact: true });
  const passwordLabel = page.getByText("Kata sandi", { exact: true });
  const recovery = page.getByRole("button", { name: "Lupa kata sandi?", exact: true });
  const showPassword = page.getByRole("button", { name: "Tampilkan kata sandi", exact: true });

  await password.fill("rahasia123");
  await expect(password).toHaveAttribute("type", "password");
  await showPassword.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("rahasia123");
  await expect(page.getByRole("button", { name: "Sembunyikan kata sandi", exact: true })).toBeVisible();

  const labelBox = await passwordLabel.boundingBox();
  const recoveryBox = await recovery.boundingBox();
  expect(labelBox).not.toBeNull();
  expect(recoveryBox).not.toBeNull();
  expect(recoveryBox!.y).toBeGreaterThan(labelBox!.y);
});

test("taller authentication modes remain vertically reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await mockSupabase(page, false);
  await page.goto("/login");
  await page.getByRole("button", { name: "Daftar", exact: true }).click();

  const privacyNote = page.getByText("Hanya kamu yang dapat mengakses catatan keuanganmu.", { exact: true });
  await privacyNote.scrollIntoViewIfNeeded();

  const layout = await page.evaluate(() => ({
    viewportHeight: document.documentElement.clientHeight,
    documentHeight: document.documentElement.scrollHeight,
  }));
  const privacyBox = await privacyNote.boundingBox();

  expect(layout.documentHeight).toBeGreaterThanOrEqual(layout.viewportHeight);
  expect(privacyBox).not.toBeNull();
  await privacyNote.scrollIntoViewIfNeeded();
  await expect(privacyNote).toBeInViewport();
});
