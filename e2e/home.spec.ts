import { expect, test } from "@playwright/test";

test("home page renders on a phone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Wavelength" })).toBeVisible();
});

test("health API is served by the worker", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ ok: true });
});
