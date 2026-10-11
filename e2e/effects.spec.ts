import { expect, test } from "@playwright/test";
import { psychicTurn, startTeamsGame } from "./helpers";

test("effects reach every player, respect roles and are rate limited", async ({
  browser,
}) => {
  const game = await startTeamsGame(browser);
  const { host, bob, cid } = game;
  await psychicTurn(host.page, "Banana");

  // Role-specific sets: the psychic has a drum roll, guessers have panic.
  await expect(host.page.getByTestId("effect-drumroll")).toBeVisible();
  await expect(host.page.getByTestId("effect-panic")).toHaveCount(0);
  await expect(cid.page.getByTestId("effect-panic")).toBeVisible();
  await expect(cid.page.getByTestId("effect-drumroll")).toHaveCount(0);
  await expect(bob.page.getByTestId("effect-heckle")).toBeVisible();

  // Cid applauds; everyone (including Cid) sees the burst with the sender's name.
  await cid.page.getByTestId("effect-applause").click();
  for (const { page } of [host, bob, cid]) {
    await expect(
      page.locator("[data-testid=effect-burst][data-effect=applause]").first(),
    ).toBeAttached();
    await expect(page.getByTestId("effect-from").first()).toHaveText("Cid");
  }

  // Spamming trips the server rate limit (3 burst, then ~1 per 1.5s).
  for (const id of ["laugh", "heart", "wow", "confident", "left", "right"]) {
    await cid.page.getByTestId(`effect-${id}`).click();
  }
  await expect
    .poll(
      () =>
        cid.page.evaluate(
          () => window.__gameStore?.getState().error?.code ?? null,
        ),
      { timeout: 5000 },
    )
    .toBe("rate_limited");
  await expect(cid.page.getByTestId("effects-bar")).toHaveAttribute(
    "data-limited",
    "true",
  );

  // Mute toggle is per device.
  await cid.page.getByTestId("mute-toggle").click();
  await expect(cid.page.getByTestId("mute-toggle")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await game.close();
});
