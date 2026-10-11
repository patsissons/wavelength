import { expect, test } from "@playwright/test";
import {
  dragDial,
  expectDialNear,
  psychicTurn,
  startTeamsGame,
} from "./helpers";

test("a full Teams turn: bullseye scores 4, opponents vote, next turn rotates, host ends the game", async ({
  browser,
}) => {
  const game = await startTeamsGame(browser);
  const { host, bob, cid, dee } = game;
  await psychicTurn(host.page, "Pineapple");

  // The psychic's board knows the target; aim the team dial right at it.
  const target = Number(
    await host.page.getByTestId("disc").getAttribute("data-target"),
  );
  expect(target).toBeGreaterThan(0);
  await dragDial(cid.page, target);
  await expectDialNear(cid.page, "shared", target, 0.015);
  await cid.page.getByTestId("accept-dial").click();
  await expect(cid.page.getByTestId("locked")).toBeVisible();

  // Opponents vote; the first vote shows progress, the second reveals.
  await expect(bob.page.getByTestId("vote-left")).toBeVisible();
  await bob.page.getByTestId("vote-left").click();
  await expect(dee.page.getByTestId("vote-progress")).toContainText("1 of 2");
  await dee.page.getByTestId("vote-right").click();

  // The guesser who hit the bullseye gets the full barrage; the psychic does not.
  await expect(cid.page.getByTestId("effects-layer")).toHaveAttribute(
    "data-celebration",
    "score-4",
  );
  await expect(host.page.getByTestId("effects-layer")).not.toHaveAttribute(
    "data-celebration",
  );
  for (const { page } of [host, bob, cid, dee]) {
    await expect(page.getByTestId("reveal")).toBeVisible();
    await expect(page.getByTestId("points")).toHaveText("+4");
    await expect(page.getByTestId("shroud")).toHaveAttribute(
      "data-open",
      "true",
    );
    await expect(page.getByTestId("wedge-4")).toBeVisible();
    await expect(page.getByTestId("score-left")).toContainText("4");
    await expect(page.getByTestId("score-right")).toContainText("1");
  }
  await expect(bob.page.getByTestId("vote-result")).toContainText(
    "split the vote",
  );
  await expect(bob.page.getByTestId("next-round")).toHaveCount(0);

  // Host advances; Bob (right team) becomes the psychic.
  await host.page.getByTestId("next-round").click();
  await expect(bob.page.getByTestId("draw-card")).toBeVisible();
  await expect(host.page.getByTestId("score-header")).toContainText("Turn 2");
  await expect(host.page.getByTestId("panel")).toContainText(
    "Bob is drawing a card",
  );

  // Host ends the game early: Left Brain leads 4–1.
  await host.page.getByTestId("host-controls").click();
  await host.page.getByTestId("end-game").click();
  for (const { page } of [host, bob]) {
    await expect(page.getByTestId("game-over")).toBeVisible();
    await expect(page.getByTestId("winner")).toContainText("Left Brain wins");
  }
  await expect(bob.page.getByTestId("play-again")).toHaveCount(0);
  await host.page.getByTestId("play-again").click();
  await expect(bob.page.getByTestId("waiting")).toBeVisible();
  await expect(host.page.getByTestId("start-game")).toBeVisible();

  await game.close();
});
