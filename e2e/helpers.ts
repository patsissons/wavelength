import {
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

export interface Client {
  context: BrowserContext;
  page: Page;
  name: string;
}

export async function hostGame(
  browser: Browser,
  name = "Host",
): Promise<Client & { code: string }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Host a game" }).click();
  await expect(page).toHaveURL(/\/game\/[A-Z]{4}$/);
  const code = page.url().slice(-4);
  await expect(page.getByTestId("game-code")).toHaveText(code);
  return { context, page, name, code };
}

export async function joinGame(
  browser: Browser,
  code: string,
  name: string,
): Promise<Client> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/join/${code}`);
  await expect(page.getByTestId("room-status")).toContainText("player");
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Join game" }).click();
  await expect(page).toHaveURL(`/game/${code}`);
  return { context, page, name };
}

export function playerRow(page: Page, name: string) {
  return page.locator(`[data-testid="player"][data-player-name="${name}"]`);
}
