import { expect, test } from "@playwright/test";
import {
  flickWheel,
  psychicTurn,
  readTarget,
  startTeamsGame,
  tapWheel,
} from "./helpers";

test("the psychic draws, spins (and re-spins), covers the wheel and gives a clue", async ({
  browser,
}) => {
  const game = await startTeamsGame(browser);
  const { host, bob, cid } = game;

  // Ann (left team, first) is the psychic
  await expect(host.page.getByTestId("draw-card")).toBeVisible();
  await expect(bob.page.getByTestId("panel")).toContainText(
    "Ann is drawing a card",
  );
  await expect(host.page.getByTestId("spectrum")).toContainText("?");
  // Late arrivals can still be invited from inside the game.
  await expect(bob.page.getByTestId("share-compact-code")).toHaveText(
    game.code,
  );

  await host.page.getByTestId("draw-card").click();
  await expect(host.page.getByTestId("card-side-0")).toBeVisible();
  await host.page.getByTestId("flip-card").click();
  await host.page.getByTestId("pick-side-1").click();
  await expect(bob.page.getByTestId("panel")).toContainText(
    "Ann is spinning the wheel",
  );
  await expect(bob.page.getByTestId("spectrum")).not.toContainText("?");

  // Picking a side lifts the shroud for everyone so they can watch the spin;
  // nobody but the psychic ever receives a target.
  await expect(host.page.getByTestId("panel")).toContainText("Spin the wheel");
  for (const { page } of [host, bob]) {
    await expect(page.getByTestId("shroud")).toHaveAttribute(
      "data-open",
      "true",
    );
    await expect(page.getByTestId("wedge-4")).toHaveCount(0);
  }
  await expect(host.page.getByTestId("peek-toggle")).toHaveCount(0);

  // A flick spins; the wedge lands in view on the psychic's board only.
  await flickWheel(host.page);
  await expect(host.page.getByTestId("wedge-4")).toBeVisible();
  const first = await readTarget(host.page);
  await expect(bob.page.getByTestId("panel")).toContainText("Ann is peeking");
  await expect(bob.page.getByTestId("wedge-4")).toHaveCount(0);

  // Tapping again re-spins to a fresh target (3 spins per turn by default).
  await tapWheel(host.page);
  await expect.poll(() => readTarget(host.page)).not.toBeCloseTo(first, 3);
  await expect(host.page.getByTestId("panel")).toContainText("1 left");
  const second = await readTarget(host.page);
  await tapWheel(host.page);
  await expect(host.page.getByTestId("panel")).toContainText("No spins left");
  await expect.poll(() => readTarget(host.page)).not.toBeCloseTo(second, 3);
  const third = await readTarget(host.page);
  await tapWheel(host.page);
  await expect(bob.page.getByTestId("panel")).toContainText("Ann is peeking");
  expect(await readTarget(host.page)).toBeCloseTo(third, 6);

  // The handle covers the wheel; tapping the shroud lifts it again.
  await host.page.getByTestId("shroud-handle").click();
  await expect(host.page.getByTestId("shroud")).not.toHaveAttribute(
    "data-open",
  );
  await expect(bob.page.getByTestId("shroud")).not.toHaveAttribute("data-open");
  await expect(bob.page.getByTestId("panel")).toContainText(
    "Ann is thinking of a clue",
  );
  await host.page.getByTestId("shroud").click();
  await expect(host.page.getByTestId("shroud")).toHaveAttribute(
    "data-open",
    "true",
  );
  await expect(host.page.getByTestId("wedge-4")).toBeVisible();
  await host.page.getByTestId("peek-toggle").click();
  await expect(host.page.getByTestId("shroud")).not.toHaveAttribute(
    "data-open",
  );

  // The flat wedge strip above the clue input mirrors the board's target.
  await expect(host.page.getByTestId("wedge-strip")).toHaveAttribute(
    "data-target",
    third.toFixed(4),
  );
  await expect(host.page.getByTestId("strip-wedge-4")).toBeVisible();
  await host.page.getByTestId("clue-input").fill("Pineapple on pizza");
  await host.page.getByTestId("submit-clue").click();
  await expect(bob.page.getByTestId("clue")).toContainText(
    "Pineapple on pizza",
  );
  await expect(cid.page.getByTestId("clue")).toContainText(
    "Pineapple on pizza",
  );
  await expect(cid.page.getByTestId("dial-shared")).toBeVisible();
  await expect(bob.page.getByTestId("panel")).toContainText("is guessing");

  // While they guess the psychic can peek; the guessers' shroud stays shut.
  await host.page.getByTestId("peek-toggle").click();
  await expect(host.page.getByTestId("shroud")).toHaveAttribute(
    "data-open",
    "true",
  );
  await expect(cid.page.getByTestId("shroud")).not.toHaveAttribute("data-open");

  await game.close();
});

test("helper drives a full psychic turn", async ({ browser }) => {
  const game = await startTeamsGame(browser);
  await psychicTurn(game.host.page, "Banana");
  await expect(game.bob.page.getByTestId("clue")).toContainText("Banana");
  await game.close();
});
