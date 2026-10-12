import { expect, test } from "@playwright/test";
import { seasonFor, tagline } from "../src/lib/eggs/seasons";
import {
  dragDial,
  flickWheelHard,
  hostGame,
  joinGame,
  playerRow,
  reachClue,
  startTeamsGame,
} from "./helpers";

test("five taps on the QR code open the cheat sheet for this device", async ({
  browser,
}, testInfo) => {
  const host = await hostGame(browser, "Ann");
  const qr = host.page.getByTestId("qr-code").first();
  for (let i = 0; i < 5; i++) await qr.click();
  const sheet = host.page.getByTestId("egg-cheatsheet");
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Konami code");
  // Phone emulation gets the swipe wording, not the keyboard one.
  const phone =
    testInfo.project.name === "mobile-safari" ? "iPhone" : "Android";
  await expect(sheet).toContainText(`on ${phone}`);
  await expect(sheet).toContainText("swipe ↑ ↑ ↓ ↓");
  await expect(sheet).not.toContainText("B A on a keyboard");
  await host.page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await host.context.close();
});

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

  // Press and hold the tagline: scanlines. A plain tap is nothing.
  const line = page.getByTestId("tagline");
  await line.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-egg-crt");
  const box = (await line.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1700);
  await page.mouse.up();
  await expect(page.locator("html")).toHaveAttribute("data-egg-crt", "");
  await page.evaluate(() => window.wavelength!.reset());

  // Seven quick taps on the title: the wave, and a quip for a tagline.
  const title = page.getByRole("heading", { name: "Wavelength" });
  // Whatever the calendar says today (the seasons have their own test).
  await expect(page.getByTestId("tagline")).toHaveText(
    tagline(seasonFor(new Date())),
  );
  for (let i = 0; i < 7; i++) await title.click();
  await expect(title).toHaveAttribute("data-egg-wave", "true");
  await expect(page.getByTestId("tagline")).toHaveText(
    "Definitely not telepathy.",
  );
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

test("a magic clue reaches every screen and leaves the clue box free", async ({
  browser,
}) => {
  const game = await startTeamsGame(browser);
  const { host, bob, cid } = game;
  await reachClue(host.page);
  await host.page.getByTestId("clue-input").fill("Marco!");
  await host.page.getByTestId("submit-clue").click();
  for (const { page } of [host, bob, cid]) {
    await expect(page.getByTestId("egg-chip")).toHaveText("POLO!");
    await expect(
      page.locator("[data-testid=effect-burst][data-effect=egg-marco]").first(),
    ).toBeAttached();
  }
  // The egg was not the clue: the psychic still owes one.
  await expect(host.page.getByTestId("clue-input")).toHaveValue("");
  await expect(host.page.getByTestId("clue")).toHaveCount(0);
  await expect(host.page.getByTestId("panel")).toContainText("Give a clue");
  await expect(host.page.getByText("Say it again")).toBeVisible();

  // The same word again means it.
  await host.page.getByTestId("clue-input").fill("Marco!");
  await host.page.getByTestId("submit-clue").click();
  for (const { page } of [host, bob, cid]) {
    await expect(page.getByTestId("clue")).toHaveAttribute(
      "data-egg-clue",
      "marco",
    );
  }
  const tally = await host.page.evaluate(() => {
    const s = window.__gameStore!.getState();
    return s.game!.effectTally[s.you!.playerId];
  });
  expect(tally).toEqual({ "clue:marco": 1 });

  // Ten taps on mute in five seconds: the button has had enough.
  for (let i = 0; i < 10; i++)
    await bob.page.getByTestId("mute-toggle").click();
  await expect(bob.page.getByTestId("mute-toggle")).toHaveAttribute(
    "data-fidget",
    "true",
  );
  await expect(bob.page.getByText("Okay, okay.")).toBeVisible();
  await game.close();
});

test("a flat-out flick heats the wheel and a centred dial is very neutral", async ({
  browser,
}) => {
  const game = await startTeamsGame(browser);
  const { host, cid } = game;
  await host.page.getByTestId("draw-card").click();
  await host.page.getByTestId("flip-card").click();
  await host.page.getByTestId("pick-side-1").click();
  await expect(host.page.getByTestId("panel")).toContainText("Spin the wheel");
  await flickWheelHard(host.page);
  await expect(host.page.locator("html")).toHaveAttribute("data-egg-hot", "");
  await expect(
    host.page
      .locator("[data-testid=effect-burst][data-effect=egg-hot]")
      .first(),
  ).toBeAttached();
  await expect(host.page.locator("html")).not.toHaveAttribute("data-egg-hot", {
    timeout: 3000,
  });
  await expect(host.page.getByTestId("wedge-4")).toBeVisible();
  await host.page.getByTestId("clue-input").fill("Middle");
  await host.page.getByTestId("submit-clue").click();
  await expect(cid.page.getByTestId("clue")).toContainText("Middle");

  await dragDial(cid.page, 0.5);
  await expect(cid.page.getByTestId("egg-chip")).toHaveText("🇨🇭 Very neutral.");
  await game.close();
});

test("a season dresses the home screen and the lounge, never the round", async ({
  browser,
}) => {
  const game = await startTeamsGame(browser);
  const { host } = game;
  expect(
    await host.page.evaluate(() => window.wavelength!.season("winter")),
  ).toBe("season: winter");
  await expect(host.page.locator("html")).toHaveAttribute(
    "data-egg-season",
    "winter",
  );
  // In a round the snow stays away.
  await expect(host.page.getByTestId("egg-ambient")).toHaveCount(0);
  await host.page.goto("/");
  await expect(host.page.getByTestId("egg-ambient")).toHaveAttribute(
    "data-season",
    "winter",
  );
  await host.page.evaluate(() => window.wavelength!.season("fools"));
  await expect(host.page.getByTestId("tagline")).toContainText(
    "Results may vary",
  );
  await host.page.evaluate(() => window.wavelength!.season("thanksgiving"));
  await expect(host.page.getByTestId("egg-ambient")).toHaveAttribute(
    "data-season",
    "thanksgiving",
  );
  await expect(host.page.getByTestId("tagline")).toContainText("gravy");
  await host.page.evaluate(() => window.wavelength!.season("stpatricks"));
  await expect(host.page.getByTestId("tagline")).toContainText("Sláinte");
  expect(
    await host.page.evaluate(() => window.wavelength!.season("summer")),
  ).toContain("seasons:");
  await host.page.evaluate(() => window.wavelength!.season(null));
  // Back to whatever the calendar says today.
  const today = seasonFor(new Date());
  if (today === null) {
    await expect(host.page.locator("html")).not.toHaveAttribute(
      "data-egg-season",
    );
  } else {
    await expect(host.page.locator("html")).toHaveAttribute(
      "data-egg-season",
      today,
    );
  }
  await expect(host.page.getByTestId("tagline")).toHaveText(tagline(today));
  await game.close();
});
