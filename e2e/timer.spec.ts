import { expect, test } from "@playwright/test";
import { dragDial, psychicTurn, startModeGame } from "./helpers";

test("the dial timer counts down for everyone and locks the dials where they are", async ({
  browser,
}) => {
  const game = await startModeGame(browser, "ffa", 1, ["Bob", "Cid"], 15);
  const { host } = game;
  const [bob, cid] = game.guests as [typeof host, typeof host];
  await psychicTurn(host.page, "Banana");

  // Every screen shows the countdown once the clue is given.
  for (const { page } of [host, bob, cid]) {
    await expect(page.getByTestId("guess-timer")).toBeVisible();
    await expect(page.getByTestId("guess-timer")).toContainText("0:1");
  }

  // Bob moves and never locks; Cid locks in. The timer settles it.
  await dragDial(bob.page, 0.25);
  await expect(bob.page.getByTestId("accept-dial")).toBeVisible();
  await cid.page.getByTestId("accept-dial").click();
  await expect(cid.page.getByTestId("locked")).toBeVisible();

  await expect(bob.page.getByTestId("guess-timer")).toHaveAttribute(
    "data-urgent",
    "true",
    { timeout: 10_000 },
  );
  // Time's up: a toast says so and the round reveals without Bob locking.
  await expect(bob.page.getByText(/Time's up/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(bob.page.getByTestId("reveal")).toBeVisible();
  await expect(host.page.getByTestId("ffa-results")).toBeVisible();
  // Bob's unaccepted dial still counted as the guess.
  const position = Number(
    await host.page
      .getByTestId("dial-" + (await playerId(bob.page)))
      .getAttribute("data-position"),
  );
  expect(Math.abs(position - 0.25)).toBeLessThanOrEqual(0.03);

  await game.close();
});

async function playerId(page: import("@playwright/test").Page) {
  return page.evaluate(() => window.__gameStore!.getState().you!.playerId);
}
