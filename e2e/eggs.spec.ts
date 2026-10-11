import { expect, test } from "@playwright/test";
import {
  hostGame,
  joinGame,
  playerRow,
  psychicTurn,
  startTeamsGame,
} from "./helpers";

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

test("the Konami code starts party mode and tells the room", async ({
  browser,
}) => {
  const host = await hostGame(browser, "Ann");
  const bob = await joinGame(browser, host.code, "Bob");
  await expect(playerRow(host.page, "Bob")).toBeVisible();

  const keys = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ];
  for (const key of keys) await host.page.keyboard.press(key);
  await expect(host.page.locator("html")).toHaveAttribute("data-egg-party", "");
  await expect(host.page.getByText("+30 lives")).toBeVisible();
  // Everyone, Bob included, sees who knows the code.
  for (const { page } of [host, bob]) {
    await expect(
      page.locator("[data-testid=effect-burst][data-effect=konami]").first(),
    ).toBeAttached();
    await expect(page.getByTestId("effect-from").first()).toHaveText(
      "Ann knows the code",
    );
  }
  await expect(bob.page.locator("html")).not.toHaveAttribute("data-egg-party");

  // The API toggles it back off; the room hears nothing this time.
  expect(await host.page.evaluate(() => window.wavelength!.party())).toBe(
    "party off",
  );
  await expect(host.page.locator("html")).not.toHaveAttribute("data-egg-party");

  // Typing the magic word (outside a field) points at the console.
  await host.page.keyboard.press("Escape");
  await host.page.locator("body").click({ position: { x: 5, y: 5 } });
  await host.page.keyboard.type("wavelength");
  await expect(host.page.getByText("The console knows more")).toBeVisible();

  await Promise.all([host.context.close(), bob.context.close()]);
});

test("disco mode dresses the lounge and swaps the record", async ({
  browser,
}) => {
  const host = await hostGame(browser, "Ann");
  expect(await host.page.evaluate(() => window.wavelength!.disco())).toBe(
    "🪩 disco on",
  );
  await expect(host.page.locator("html")).toHaveAttribute("data-egg-disco", "");
  // The disco loop renders real sound (checked offline, no speakers needed).
  const peak = await host.page.evaluate(async () => {
    const samples = await window.__audio!.render({ loop: "disco" }, 1);
    let max = 0;
    for (const s of samples) max = Math.max(max, Math.abs(s));
    return max;
  });
  expect(peak).toBeGreaterThan(0.05);
  expect(await host.page.evaluate(() => window.wavelength!.jukebox())).toMatch(
    /sounds, 2 loops/,
  );
  expect(await host.page.evaluate(() => window.wavelength!.disco())).toBe(
    "disco off",
  );
  // A timed drop switches itself off again.
  await host.page.evaluate(() => window.wavelength!.disco(1));
  await expect(host.page.locator("html")).toHaveAttribute("data-egg-disco", "");
  await expect(host.page.locator("html")).not.toHaveAttribute(
    "data-egg-disco",
    { timeout: 3000 },
  );
  await host.context.close();
});

test("a magic clue reaches every screen in the room", async ({ browser }) => {
  const game = await startTeamsGame(browser);
  const { host, bob, cid } = game;
  await psychicTurn(host.page, "Marco!");
  for (const { page } of [host, bob, cid]) {
    await expect(page.getByTestId("clue")).toHaveAttribute(
      "data-egg-clue",
      "marco",
    );
    await expect(page.getByTestId("egg-chip")).toHaveText("POLO!");
    await expect(
      page.locator("[data-testid=effect-burst][data-effect=egg-marco]").first(),
    ).toBeAttached();
  }
  await game.close();
});
