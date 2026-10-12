import { expect, test, type Page } from "@playwright/test";
import { psychicTurn, startModeGame } from "./helpers";

test("players flick emoji at each other in the post-round arena", async ({
  browser,
}) => {
  const game = await startModeGame(browser, "coop", 1, ["Bob", "Cid"]);
  const { host } = game;
  const [bob, cid] = game.guests as [typeof host, typeof host];
  await psychicTurn(host.page, "Mango");
  await bob.page.getByTestId("accept-dial").click();
  await cid.page.getByTestId("accept-dial").click();
  await expect(host.page.getByTestId("reveal")).toBeVisible();

  // Bob opens the arena and everyone follows; Ann steps back out to the
  // results.
  await bob.page.getByTestId("open-arena").click();
  for (const { page } of [bob, cid, host]) {
    await expect(page.getByTestId("arena")).toBeVisible();
    await expect(page.getByTestId("arena-player")).toHaveCount(2);
  }
  await host.page.getByTestId("close-arena").click();
  await expect(host.page.getByTestId("arena")).toHaveCount(0);
  await expect(host.page.getByTestId("reveal")).toBeVisible();

  // Sliding a finger along the tray scrolls it instead of throwing.
  const tray = bob.page.getByTestId("arena-tray");
  const first = await centre(bob.page.getByTestId("arena-emoji-👏"));
  await bob.page.mouse.move(first.x, first.y);
  await bob.page.mouse.down();
  await bob.page.mouse.move(first.x - 60, first.y + 2, { steps: 4 });
  await bob.page.mouse.move(first.x - 150, first.y + 3, { steps: 4 });
  await bob.page.mouse.up();
  expect(await tray.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  await expect(bob.page.getByTestId("arena-drag")).toHaveCount(0);
  await tray.evaluate((el) => el.scrollTo({ left: 0 }));
  // Everyone else is the same distance from you.
  const you = await centre(bob.page.getByTestId("arena-you"));
  const seats = await Promise.all(
    (await bob.page.getByTestId("arena-player").all()).map((n) => centre(n)),
  );
  const dist = seats.map((s) => Math.hypot(s.x - you.x, s.y - you.y));
  expect(Math.abs(dist[0]! - dist[1]!)).toBeLessThan(2);
  expect(seats.every((s) => s.y < you.y)).toBe(true);

  // Bob drops a 🔥 on Cid: it lands in Cid's arena and is tallied.
  const cidSeat = await centre(
    bob.page.locator("[data-testid=arena-player][data-player-name=Cid]"),
  );
  await drag(bob.page, "🔥", cidSeat);
  await expect(cid.page.getByTestId("arena")).toHaveAttribute(
    "data-last-reaction",
    "🔥",
  );
  await expect(cid.page.getByTestId("arena-hit")).toContainText(
    "Bob threw 🔥 at you",
  );

  // Bob flicks 👏 towards Ann (released halfway, aimed by direction): Ann,
  // still on the results, gets a burst on the effects layer instead.
  const annSeat = await centre(
    bob.page.locator("[data-testid=arena-player][data-player-name=Ann]"),
  );
  await flick(bob.page, "👏", annSeat);
  await expect(host.page.getByTestId("effects-layer")).toHaveAttribute(
    "data-reacted-by",
    "Bob",
  );
  await expect(
    host.page
      .locator("[data-testid=effect-burst][data-effect=reaction]")
      .first(),
  ).toBeAttached();

  // The tally comes with the `effect.sent` event, the burst with the
  // ephemeral; under load the two can land a tick apart.
  const bobId = await bob.page.evaluate(
    () => window.__gameStore!.getState().you!.playerId,
  );
  await expect
    .poll(() =>
      host.page.evaluate(
        (id) => window.__gameStore!.getState().game!.effectTally[id],
        bobId,
      ),
    )
    .toEqual({ "reaction:🔥": 1, "reaction:👏": 1 });

  // The host moves on from inside the arena; everyone's arena closes.
  await host.page.getByTestId("next-round").click();
  await expect(bob.page.getByTestId("arena")).toHaveCount(0);
  await expect(cid.page.getByTestId("arena")).toHaveCount(0);

  await game.close();
});

async function centre(locator: import("@playwright/test").Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Press an emoji in the tray and drop it on a point. */
async function drag(page: Page, emoji: string, to: { x: number; y: number }) {
  const from = await centre(page.getByTestId(`arena-emoji-${emoji}`));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

/** Flick an emoji towards a point, letting go a third of the way there. */
async function flick(page: Page, emoji: string, to: { x: number; y: number }) {
  const from = await centre(page.getByTestId(`arena-emoji-${emoji}`));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(
    from.x + (to.x - from.x) * 0.2,
    from.y + (to.y - from.y) * 0.2,
    { steps: 2 },
  );
  await page.mouse.move(
    from.x + (to.x - from.x) * 0.35,
    from.y + (to.y - from.y) * 0.35,
    { steps: 2 },
  );
  await page.mouse.up();
}
