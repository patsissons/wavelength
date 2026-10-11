import { expect, test } from "@playwright/test";
import { psychicTurn, startTeamsGame } from "./helpers";

test("the psychic draws, spins, peeks and gives a clue that everyone sees", async ({
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

  await host.page.getByTestId("draw-card").click();
  await expect(host.page.getByTestId("card-side-0")).toBeVisible();
  await host.page.getByTestId("flip-card").click();
  await host.page.getByTestId("pick-side-1").click();
  await expect(bob.page.getByTestId("panel")).toContainText(
    "Ann is spinning the wheel",
  );
  await expect(bob.page.getByTestId("spectrum")).not.toContainText("?");

  // Non-psychics never receive a target
  await expect(host.page.getByTestId("shroud")).not.toHaveAttribute(
    "data-open",
  );
  await expect(host.page.getByTestId("peek-toggle")).toHaveCount(0);

  await expect(host.page.getByTestId("panel")).toContainText("Spin the wheel");
  const box = (await host.page.getByTestId("board").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * (205 / 230);
  const r = box.width * 0.4;
  await host.page.mouse.move(cx - r * 0.7, cy - r * 0.7);
  await host.page.mouse.down();
  await host.page.mouse.move(cx, cy - r, { steps: 3 });
  await host.page.mouse.move(cx + r * 0.7, cy - r * 0.7, { steps: 3 });
  await host.page.mouse.up();

  await expect(host.page.getByTestId("peek-toggle")).toBeEnabled();
  await expect(bob.page.getByTestId("panel")).toContainText(
    "Ann is thinking of a clue",
  );
  await host.page.getByTestId("peek-toggle").click();
  await expect(host.page.getByTestId("shroud")).toHaveAttribute(
    "data-open",
    "true",
  );
  await expect(host.page.getByTestId("wedge-4")).toBeVisible();
  await expect(bob.page.getByTestId("panel")).toContainText("Ann is peeking");
  await expect(bob.page.getByTestId("wedge-4")).toHaveCount(0);

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

  await game.close();
});

test("helper drives a full psychic turn", async ({ browser }) => {
  const game = await startTeamsGame(browser);
  await psychicTurn(game.host.page, "Banana");
  await expect(game.bob.page.getByTestId("clue")).toContainText("Banana");
  await game.close();
});
