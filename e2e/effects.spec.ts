import { expect, test } from "@playwright/test";
import { psychicTurn, startTeamsGame } from "./helpers";

test("effects reach every player, respect roles and are rate limited", async ({
  browser,
}) => {
  const game = await startTeamsGame(browser);
  const { host, bob, cid } = game;
  await psychicTurn(host.page, "Mango");

  // Role-specific sets: the psychic has a drum roll, guessers have panic.
  await expect(host.page.getByTestId("effect-drumroll")).toBeVisible();
  await expect(host.page.getByTestId("effect-panic")).toHaveCount(0);
  await expect(cid.page.getByTestId("effect-panic")).toBeVisible();
  await expect(cid.page.getByTestId("effect-drumroll")).toHaveCount(0);
  await expect(bob.page.getByTestId("effect-heckle")).toBeVisible();
  // Anyone can tell anyone to hurry up.
  for (const { page } of [host, bob, cid]) {
    await expect(page.getByTestId("effect-hurry")).toBeVisible();
  }

  // The host button shares the toolbar with the effects; nothing overlaps.
  const hostBox = (await host.page.getByTestId("host-controls").boundingBox())!;
  const effectsBox = (await host.page
    .getByTestId("effects-bar")
    .boundingBox())!;
  expect(effectsBox.x + effectsBox.width).toBeLessThanOrEqual(hostBox.x + 1);
  for (const id of ["drumroll", "heart"]) {
    const button = host.page.getByTestId(`effect-${id}`);
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(hostBox.x + 1);
  }

  // Cid applauds; everyone (including Cid) sees the burst with the sender's name.
  await cid.page.getByTestId("effect-applause").click();
  for (const { page } of [host, bob, cid]) {
    await expect(
      page.locator("[data-testid=effect-burst][data-effect=applause]").first(),
    ).toBeAttached();
    await expect(page.getByTestId("effect-from").first()).toHaveText("Cid");
  }

  // Cid pokes Bob by tapping his name: Bob's screen reacts, everyone sees it.
  await expect(
    cid.page.locator(
      "[data-testid=presence-player][data-player-name=Cid] [data-testid=poke]",
    ),
  ).toBeDisabled();
  await cid.page
    .locator(
      "[data-testid=presence-player][data-player-name=Bob] [data-testid=poke]",
    )
    .click();
  await expect(bob.page.getByTestId("effects-layer")).toHaveAttribute(
    "data-poked-by",
    "Cid",
  );
  await expect(
    host.page.locator("[data-testid=effect-burst][data-effect=poke]").first(),
  ).toBeAttached();
  await expect(host.page.getByTestId("effects-layer")).not.toHaveAttribute(
    "data-poked-by",
  );

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
