import { expect, test } from "@playwright/test";
import { dragDial, psychicTurn, readTarget, startModeGame } from "./helpers";

test("co-op: everyone shares a dial, no voting, benchmark label at the end", async ({
  browser,
}) => {
  const game = await startModeGame(browser, "coop", 2, ["Bob", "Cid"]);
  const { host } = game;
  const [bob, cid] = game.guests as [typeof host, typeof host];

  // Round 1: Ann is the psychic, Bob and Cid share the dial.
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

  // Round 2: Bob is the psychic; the psychic may advance.
  await host.page.getByTestId("next-round").click();
  await expect(bob.page.getByTestId("draw-card")).toBeVisible();
  await expect(host.page.getByTestId("score-header")).toContainText(
    "Round 2 of 2",
  );
  await psychicTurn(bob.page, "Crocs");
  const target2 = await readTarget(bob.page);
  await dragDial(host.page, target2);
  await host.page.getByTestId("accept-dial").click();
  await cid.page.getByTestId("accept-dial").click();
  await expect(bob.page.getByTestId("game-over-pending")).toBeVisible();
  await bob.page.getByTestId("next-round").click();
  for (const { page } of [host, bob, cid]) {
    await expect(page.getByTestId("game-over")).toBeVisible();
    await expect(page.getByTestId("winner")).toHaveText("Galaxy brain");
  }
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

  // Each guesser has their own dial and cannot see the other's.
  await expect(bob.page.locator("[data-testid^=dial-]")).toHaveCount(1);
  await dragDial(bob.page, target);
  await expect(cid.page.locator("[data-testid^=dial-]")).toHaveCount(1);
  await bob.page.getByTestId("accept-dial").click();
  await expect(bob.page.getByTestId("locked")).toBeVisible();
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

  await host.page.getByTestId("next-round").click();
  await expect(cid.page.getByTestId("winner")).toContainText("Bob wins");
  await game.close();
});
