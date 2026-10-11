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

test("a code typed on the home page joins with the entered name", async ({
  browser,
}) => {
  const host = await hostGame(browser, "Ann");
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill("Bob");

  // A wrong code stays on the home page with a toast.
  await page.getByLabel("Have a code?").fill("ZZZZ");
  await page.getByTestId("join-with-code").click();
  await expect(page.getByText("No game with that code.")).toBeVisible();
  await expect(page).toHaveURL("/");

  // The right code skips the join screen entirely.
  await page.getByLabel("Have a code?").fill(host.code.toLowerCase());
  await page.getByTestId("join-with-code").click();
  await expect(page).toHaveURL(`/game/${host.code}`);
  await expect(playerRow(page, "Bob")).toContainText("(you)");
  await expect(playerRow(host.page, "Bob")).toBeVisible();

  await Promise.all([host.context.close(), context.close()]);
});
