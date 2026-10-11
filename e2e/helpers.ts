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

/** Host + three guests in a Teams game, started. Ann/Cid left, Bob/Dee right. */
export async function startTeamsGame(browser: Browser) {
  const host = await hostGame(browser, "Ann");
  const bob = await joinGame(browser, host.code, "Bob");
  const cid = await joinGame(browser, host.code, "Cid");
  const dee = await joinGame(browser, host.code, "Dee");
  await host.page.getByTestId("open-settings").click();
  await host.page.getByRole("button", { name: "Left Brain" }).click();
  await host.page.keyboard.press("Escape");
  await expect(host.page.getByTestId("start-game")).toBeEnabled();
  await host.page.getByTestId("start-game").click();
  await expect(host.page.getByTestId("score-header")).toBeVisible();
  const all = [host, bob, cid, dee];
  const close = () => Promise.all(all.map((c) => c.context.close()));
  return { host, bob, cid, dee, all, code: host.code, close };
}

/** Drive the psychic from drawing through to the clue. */
export async function psychicTurn(page: Page, clue: string) {
  await page.getByTestId("draw-card").click();
  await page.getByTestId("flip-card").click();
  await page.getByTestId("pick-side-1").click();
  await flickWheel(page);
  await expect(page.getByTestId("peek-toggle")).toBeEnabled();
  await page.getByTestId("peek-toggle").click();
  await expect(page.getByTestId("shroud")).toHaveAttribute("data-open", "true");
  await page.getByTestId("clue-input").fill(clue);
  await page.getByTestId("submit-clue").click();
  await expect(page.getByTestId("clue")).toContainText(clue);
}

export async function flickWheel(page: Page) {
  const box = (await page.getByTestId("board").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * (205 / 230);
  const r = box.width * 0.4;
  await page.mouse.move(cx - r * 0.7, cy - r * 0.7);
  await page.mouse.down();
  await page.mouse.move(cx, cy - r, { steps: 3 });
  await page.mouse.move(cx + r * 0.7, cy - r * 0.7, { steps: 3 });
  await page.mouse.up();
}

/** Drag the board dial to a spectrum position (0..1). */
export async function dragDial(page: Page, position: number) {
  const box = (await page.getByTestId("board").boundingBox())!;
  const scale = box.width / 400;
  const angle = Math.PI * (1 - position);
  const x = box.x + (200 + 150 * Math.cos(angle)) * scale;
  const y = box.y + (205 - 150 * Math.sin(angle)) * scale;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 4 });
  await page.mouse.up();
}
