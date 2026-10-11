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

test("a player can leave the lounge for the home screen and come back", async ({
  browser,
}) => {
  const host = await hostGame(browser, "Ann");
  const bob = await joinGame(browser, host.code, "Bob");
  await bob.page.getByTestId("leave-game").click();
  await expect(bob.page).toHaveURL("/");
  await expect(
    bob.page.getByRole("button", { name: "Host a game" }),
  ).toBeVisible();
  // The seat is kept: the same code brings Bob straight back.
  await bob.page.goto(`/game/${host.code}`);
  await expect(playerRow(bob.page, "Bob")).toContainText("(you)");
  await host.context.close();
  await bob.context.close();
});

test("players pick avatars on the home page and in the lounge and everyone sees them", async ({
  browser,
}) => {
  // Ann picks a character before hosting; it rides along with the create.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill("Ann");
  await page.getByTestId("open-avatar").click();
  await page.getByTestId("avatar-dancing-unicorn").click();
  await expect(page.getByTestId("open-avatar")).toHaveAttribute(
    "data-avatar",
    "dancing-unicorn",
  );
  await page.getByRole("button", { name: "Host a game" }).click();
  await expect(page).toHaveURL(/\/game\/[A-Z]{4}$/);
  const code = page.url().slice(-4);
  await expect(
    playerRow(page, "Ann").locator("[data-avatar=dancing-unicorn]"),
  ).toBeVisible();
  await expect(
    playerRow(page, "Ann").locator(".avatar-body[data-anim=dance]"),
  ).toBeAttached();

  // Bob joins with the monogram, then switches to an emoji in the lounge;
  // Ann's screen updates too.
  const bob = await joinGame(browser, code, "Bob");
  await expect(
    playerRow(page, "Bob").locator("[data-avatar-kind=initial]"),
  ).toHaveText("B");
  await bob.page.getByTestId("open-avatar").click();
  await bob.page.getByTestId("avatar-emoji-🦊").click();
  await expect(
    playerRow(page, "Bob").locator("[data-avatar='🦊']"),
  ).toBeVisible();
  await expect(
    playerRow(bob.page, "Bob").locator("[data-avatar='🦊']"),
  ).toBeVisible();

  // The choice is remembered on the device: the join page offers it next time.
  await bob.page.goto("/join/ZZZZ");
  await expect(bob.page.getByTestId("open-avatar")).toHaveAttribute(
    "data-avatar",
    "🦊",
  );

  await Promise.all([context.close(), bob.context.close()]);
});
