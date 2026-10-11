import { expect, test } from "@playwright/test";
import {
  hostGame,
  joinGame,
  playerRow,
  psychicTurn,
  startTeamsGame,
} from "./helpers";

test("a closed tab goes away after the grace period and reattaches to the same seat", async ({
  browser,
}) => {
  const host = await hostGame(browser, "Ann");
  const bob = await joinGame(browser, host.code, "Bob");

  await expect(playerRow(host.page, "Bob")).toHaveAttribute(
    "data-connected",
    "true",
  );

  // Bob's tab dies (the phone killed it). The seat is kept.
  await bob.page.close();
  await expect(playerRow(host.page, "Bob")).not.toHaveAttribute(
    "data-connected",
    "true",
  );
  await expect(playerRow(host.page, "Bob")).not.toHaveAttribute(
    "data-away",
    "true",
  );
  // GRACE_MS is 3s in the e2e env.
  await expect(playerRow(host.page, "Bob")).toHaveAttribute(
    "data-away",
    "true",
    { timeout: 8000 },
  );

  // Bob reopens the app: the stored identity reattaches without rejoining.
  const again = await bob.context.newPage();
  await again.goto(`/game/${host.code}`);
  await expect(again).toHaveURL(`/game/${host.code}`);
  await expect(playerRow(again, "Bob")).toContainText("(you)");
  await expect(playerRow(host.page, "Bob")).not.toHaveAttribute(
    "data-away",
    "true",
  );
  await expect(playerRow(host.page, "Bob")).toHaveAttribute(
    "data-connected",
    "true",
  );
  await expect(host.page.getByTestId("player")).toHaveCount(2);

  await Promise.all([host.context.close(), bob.context.close()]);
});

test("a silently dropped socket reconnects before the grace period", async ({
  browser,
}) => {
  const host = await hostGame(browser, "Ann");
  const bob = await joinGame(browser, host.code, "Bob");

  await bob.page.evaluate(() => window.__wsDrop?.());
  await expect
    .poll(() => bob.page.evaluate(() => window.__gameStore?.getState().conn), {
      timeout: 5000,
    })
    .toBe("open");
  // Well past the 3s grace: Bob never became away.
  await bob.page.waitForTimeout(4000);
  await expect(playerRow(host.page, "Bob")).not.toHaveAttribute(
    "data-away",
    "true",
  );
  await expect(playerRow(host.page, "Bob")).toHaveAttribute(
    "data-connected",
    "true",
  );
  await expect(bob.page.getByTestId("connection-banner")).toHaveCount(0);

  await Promise.all([host.context.close(), bob.context.close()]);
});

test("an away psychic is flagged and the host can skip the round; an away guesser no longer blocks the lock", async ({
  browser,
}) => {
  const game = await startTeamsGame(browser, ["Eve"]);
  const { host, bob, cid } = game;
  const eve = game.extras[0]!;
  await psychicTurn(host.page, "Banana");

  // Eve (a left-team guesser) vanishes mid-guess; Cid alone can lock.
  await eve.page.close();
  await expect(
    host.page.locator("[data-testid=presence-player][data-player-name=Eve]"),
  ).toHaveAttribute("data-away", "true", { timeout: 8000 });
  await cid.page.getByTestId("accept-dial").click();
  await expect(bob.page.getByTestId("vote-left")).toBeVisible();

  // Host closes the vote, advances, then the new psychic (Bob) vanishes.
  await host.page.getByTestId("host-controls").click();
  await host.page.getByTestId("force-lock").click();
  await host.page.getByTestId("next-round").click();
  await expect(bob.page.getByTestId("draw-card")).toBeVisible();
  await bob.page.close();
  await expect(host.page.getByTestId("psychic-away")).toBeVisible({
    timeout: 8000,
  });
  await host.page.getByTestId("host-controls").click();
  await host.page.getByTestId("skip-round").click();
  await expect(host.page.getByTestId("psychic-away")).toHaveCount(0);
  // The right team's other member, Dee, is the new psychic.
  await expect(game.dee.page.getByTestId("draw-card")).toBeVisible();

  await game.close();
});
