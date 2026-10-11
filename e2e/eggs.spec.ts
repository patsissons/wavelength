import { expect, test } from "@playwright/test";

/** `wavelength` in the console prints the menu; the API drives the eggs. */
test("the console menu lists the eggs and the API fires them", async ({
  page,
}) => {
  await page.goto("/");
  const menu = page.waitForEvent("console", (m) =>
    m.text().includes("Wavelength easter eggs"),
  );
  await page.evaluate(() => void window.wavelength);
  const text = (await menu).text();
  expect(text).toContain("Barrel roll");
  expect(text).toContain('wavelength.rain("🍕", 24)');

  // Reduced motion is on in e2e, so the rain is trimmed but still falls.
  await page.evaluate(() => window.wavelength!.rain("🍕", 12));
  await expect(
    page.locator("[data-testid=effect-burst][data-effect=egg-custom]").first(),
  ).toBeAttached();

  expect(await page.evaluate(() => window.wavelength!.crt())).toBe("📺 CRT on");
  await expect(page.locator("html")).toHaveAttribute("data-egg-crt", "");
  await expect(page.getByTestId("egg-crt")).toBeAttached();

  await page.evaluate(() => window.wavelength!.pet("🦀"));
  await expect(page.getByTestId("egg-pet")).toHaveText("🦀");

  // The modes survive a reload in this tab.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-egg-crt", "");

  await page.evaluate(() => window.wavelength!.reset());
  await expect(page.locator("html")).not.toHaveAttribute("data-egg-crt");
  await expect(page.getByTestId("egg-pet")).toHaveCount(0);
});
