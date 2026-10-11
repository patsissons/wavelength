import { expect, test } from "@playwright/test";
import { hostGame, joinGame, playerRow } from "./helpers";

test("players join the lounge, see each other, switch teams and get kicked", async ({
  browser,
}) => {
  const host = await hostGame(browser, "Ann");
  const bob = await joinGame(browser, host.code, "Bob");
  const cid = await joinGame(browser, host.code, "Cid");

  for (const { page } of [host, bob, cid]) {
    await expect(playerRow(page, "Ann")).toBeVisible();
    await expect(playerRow(page, "Bob")).toBeVisible();
    await expect(playerRow(page, "Cid")).toBeVisible();
  }
  // teams auto-balance: Ann left, Bob right, Cid left
  await expect(
    host.page.getByTestId("team-left").getByTestId("player"),
  ).toHaveCount(2);
  await expect(
    host.page.getByTestId("team-right").getByTestId("player"),
  ).toHaveCount(1);
  await expect(host.page.getByTestId("start-game")).toBeDisabled();

  // Cid moves to the right team; everyone sees it
  await cid.page.getByRole("button", { name: /Right Brain/ }).click();
  await expect(
    host.page.getByTestId("team-right").getByTestId("player"),
  ).toHaveCount(2);
  await expect(
    bob.page.getByTestId("team-left").getByTestId("player"),
  ).toHaveCount(1);

  // guests wait, host can't start until teams are valid
  await expect(bob.page.getByTestId("waiting")).toContainText("Ann");
  await expect(host.page.getByTestId("start-game")).toBeDisabled();

  // host removes Cid → Cid lands back on the join page
  await host.page.getByRole("button", { name: "Remove Cid" }).click();
  await expect(playerRow(host.page, "Cid")).toHaveCount(0);
  await expect(playerRow(bob.page, "Cid")).toHaveCount(0);
  await expect(cid.page).toHaveURL(`/join/${host.code}`);

  await Promise.all([
    host.context.close(),
    bob.context.close(),
    cid.context.close(),
  ]);
});

test("host changes the mode and a reload keeps the seat", async ({
  browser,
}) => {
  const host = await hostGame(browser, "Ann");
  const bob = await joinGame(browser, host.code, "Bob");

  await host.page.getByTestId("open-settings").click();
  await host.page.getByTestId("mode-coop").click();
  await expect(bob.page.getByTestId("mode-label")).toContainText("Co-op");
  await host.page.keyboard.press("Escape");
  await expect(host.page.getByTestId("start-game")).toBeEnabled();

  await bob.page.reload();
  await expect(bob.page).toHaveURL(`/game/${host.code}`);
  await expect(playerRow(bob.page, "Bob")).toContainText("(you)");
  await expect(host.page.getByTestId("player")).toHaveCount(2);

  await Promise.all([host.context.close(), bob.context.close()]);
});
