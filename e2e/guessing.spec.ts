import { expect, test } from "@playwright/test";
import {
  dragDial,
  expectDialNear,
  psychicTurn,
  startTeamsGame,
} from "./helpers";

test("teammates share a dial: live moves, accepts reset on move, lock when all accept", async ({
  browser,
}) => {
  // Ann, Cid, Eve on the left; Bob, Dee on the right. Ann is the psychic.
  const game = await startTeamsGame(browser, ["Eve"]);
  const { host, bob, cid } = game;
  const eve = game.extras[0]!;
  await psychicTurn(host.page, "Banana");

  await expect(cid.page.getByTestId("accept-dial")).toBeVisible();
  await expect(eve.page.getByTestId("accept-dial")).toBeVisible();
  await expect(bob.page.getByTestId("accept-dial")).toHaveCount(0);
  await expect(bob.page.getByTestId("panel")).toContainText("Guessing time");

  // Cid drags; everyone sees the needle move
  await dragDial(cid.page, 0.2);
  await expectDialNear(bob.page, "shared", 0.2);
  await expectDialNear(eve.page, "shared", 0.2);

  // Cid accepts → 1 of 2; Eve moves → reset
  await cid.page.getByTestId("accept-dial").click();
  await expect(
    eve.page.locator("[data-testid=accept-chip][data-accepted]"),
  ).toHaveCount(1);
  await expect(cid.page.getByTestId("accept-dial")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dragDial(eve.page, 0.8);
  await expect(
    eve.page.locator("[data-testid=accept-chip][data-accepted]"),
  ).toHaveCount(0);
  await expect(cid.page.getByTestId("accept-dial")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // both accept → locked, voting begins for the other team
  await eve.page.getByTestId("accept-dial").click();
  await cid.page.getByTestId("accept-dial").click();
  await expect(cid.page.getByTestId("locked")).toBeVisible();
  await expect(bob.page.getByTestId("panel")).toContainText("Left or right?");
  await expectDialNear(bob.page, "shared", 0.8);

  await game.close();
});
