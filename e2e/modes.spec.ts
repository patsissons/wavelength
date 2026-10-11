import { expect, test } from "@playwright/test";
import {
  dragDial,
  expectDialNear,
  psychicTurn,
  readTarget,
  startModeGame,
} from "./helpers";

test("co-op: everyone shares a dial, no voting, one psychic turn each per round", async ({
  browser,
}) => {
  const game = await startModeGame(browser, "coop", 1, ["Bob", "Cid"]);
  const { host } = game;
  const [bob, cid] = game.guests as [typeof host, typeof host];

  // Turn 1: Ann is the psychic, Bob and Cid share the dial.
  await expect(host.page.getByTestId("score-header")).toContainText(
    "Round 1 of 1 · Turn 1",
  );
  await psychicTurn(host.page, "Marmite");
  const target1 = await readTarget(host.page);
  await dragDial(bob.page, target1);
  await bob.page.getByTestId("accept-dial").click();
  await expect(
    cid.page.locator("[data-testid=accept-chip][data-accepted]"),
  ).toHaveCount(1);
  await cid.page.getByTestId("accept-dial").click();
  await expect(host.page.getByTestId("reveal")).toBeVisible();
  await expect(host.page.getByTestId("points")).toHaveText("+4");
  await expect(cid.page.getByTestId("score-coop")).toContainText("4");
  await expect(cid.page.getByTestId("vote-left")).toHaveCount(0);
  await expect(host.page.getByTestId("game-over-pending")).toHaveCount(0);

  // Turn 2: Bob is the psychic; the psychic may advance.
  await host.page.getByTestId("next-round").click();
  await expect(bob.page.getByTestId("draw-card")).toBeVisible();
  await expect(host.page.getByTestId("score-header")).toContainText(
    "Round 1 of 1 · Turn 2",
  );
  await psychicTurn(bob.page, "Crocs");
  const target2 = await readTarget(bob.page);
  await dragDial(host.page, target2);
  await host.page.getByTestId("accept-dial").click();
  await cid.page.getByTestId("accept-dial").click();
  await expect(bob.page.getByTestId("reveal")).toBeVisible();
  await bob.page.getByTestId("next-round").click();

  // Turn 3: Cid closes the round and the game.
  await expect(cid.page.getByTestId("draw-card")).toBeVisible();
  await psychicTurn(cid.page, "Pickles");
  const target3 = await readTarget(cid.page);
  await dragDial(bob.page, target3);
  await bob.page.getByTestId("accept-dial").click();
  await host.page.getByTestId("accept-dial").click();
  await expect(cid.page.getByTestId("game-over-pending")).toBeVisible();
  await cid.page.getByTestId("next-round").click();
  for (const { page } of [host, bob, cid]) {
    await expect(page.getByTestId("game-over")).toBeVisible();
    await expect(page.getByTestId("winner")).toHaveText("Galaxy brain");
  }
  await expect(host.page.getByTestId("awards")).toBeVisible();
  // One round of three turns, numbered within the round.
  await expect(host.page.getByTestId("turn")).toHaveCount(3);
  await expect(host.page.getByTestId("round-heading")).toHaveText(["Round 1"]);
  const turns = host.page.getByTestId("turn");
  await expect(turns.nth(2)).toHaveAttribute("data-round", "1");
  await expect(turns.nth(2)).toHaveAttribute("data-turn", "3");
  // At game over the arena is opt-in: Bob goes in, nobody follows.
  await bob.page.getByTestId("open-arena").click();
  await expect(bob.page.getByTestId("arena")).toBeVisible();
  await expect(host.page.getByTestId("arena")).toHaveCount(0);
  await expect(cid.page.getByTestId("arena")).toHaveCount(0);
  await game.close();
});

test("free-for-all: private dials, individual scores and a winner", async ({
  browser,
}) => {
  const game = await startModeGame(browser, "ffa", 1, ["Bob", "Cid"]);
  const { host } = game;
  const [bob, cid] = game.guests as [typeof host, typeof host];

  await psychicTurn(host.page, "Karaoke");
  const target = await readTarget(host.page);

  // Each guesser has their own dial and cannot see the other's; the
  // psychic watches both move live.
  await expect(bob.page.locator("[data-testid^=dial-]")).toHaveCount(1);
  await expect(host.page.locator("[data-testid^=dial-]")).toHaveCount(2);
  await dragDial(bob.page, target);
  await expect(cid.page.locator("[data-testid^=dial-]")).toHaveCount(1);
  const bobId = await bob.page.evaluate(
    () => window.__gameStore!.getState().you!.playerId,
  );
  await expectDialNear(host.page, bobId, target, 0.03);
  await bob.page.getByTestId("accept-dial").click();
  await expect(bob.page.getByTestId("locked")).toBeVisible();
  await expect(host.page.getByTestId(`dial-${bobId}`)).toHaveAttribute(
    "data-locked",
    "true",
  );
  // Everyone's strip shows Bob has locked in.
  await expect(
    cid.page.locator("[data-testid=presence-player][data-player-name=Bob]"),
  ).toHaveAttribute("data-locked", "true");
  await expect(host.page.getByTestId("reveal")).toHaveCount(0);

  // Cid aims as far from the target as possible, then locks.
  await dragDial(cid.page, target > 0.5 ? 0 : 1);
  await cid.page.getByTestId("accept-dial").click();

  for (const { page } of [host, bob, cid]) {
    await expect(page.getByTestId("reveal")).toBeVisible();
    await expect(page.locator("[data-testid^=dial-]")).toHaveCount(2);
  }
  const results = host.page.getByTestId("ffa-results");
  await expect(results).toContainText("Bob");
  await expect(results.locator("li").filter({ hasText: "Bob" })).toContainText(
    "+4",
  );
  await expect(results.locator("li").filter({ hasText: "Cid" })).toContainText(
    "+0",
  );
  await expect(results.locator("li").filter({ hasText: "Ann" })).toContainText(
    "+2",
  );

  // The player strip is sorted by score and shows each score on the pill.
  const pills = cid.page.getByTestId("presence-player");
  await expect(pills).toHaveCount(3);
  await expect(pills.nth(0)).toHaveAttribute("data-player-name", "Bob");
  await expect(pills.nth(0)).toHaveAttribute("data-score", "4");
  await expect(pills.nth(1)).toHaveAttribute("data-player-name", "Ann");
  await expect(pills.nth(2)).toHaveAttribute("data-player-name", "Cid");
  await expect(cid.page.getByTestId("score-lead")).toContainText("Bob");

  // A round is one psychic turn per player: Bob is up next, not game over.
  await host.page.getByTestId("next-round").click();
  await expect(bob.page.getByTestId("draw-card")).toBeVisible();
  await expect(cid.page.getByTestId("score-header")).toContainText(
    "Round 1 of 1 · Turn 2",
  );
  // The host calls it early; Bob leads.
  await host.page.getByTestId("host-controls").click();
  await host.page.getByTestId("end-game").click();
  await expect(cid.page.getByTestId("winner")).toContainText("Bob wins");
  await game.close();
});
