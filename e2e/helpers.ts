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
export async function startTeamsGame(
  browser: Browser,
  extraNames: string[] = [],
) {
  const host = await hostGame(browser, "Ann");
  const bob = await joinGame(browser, host.code, "Bob");
  const cid = await joinGame(browser, host.code, "Cid");
  const dee = await joinGame(browser, host.code, "Dee");
  const extras: Client[] = [];
  for (const name of extraNames) {
    extras.push(await joinGame(browser, host.code, name));
  }
  await host.page.getByTestId("open-settings").click();
  await host.page.getByRole("button", { name: "Left Brain" }).click();
  await host.page.keyboard.press("Escape");
  await expect(host.page.getByTestId("start-game")).toBeEnabled();
  await host.page.getByTestId("start-game").click();
  await expect(host.page.getByTestId("score-header")).toBeVisible();
  const all = [host, bob, cid, dee, ...extras];
  const close = () => Promise.all(all.map((c) => c.context.close()));
  return { host, bob, cid, dee, extras, all, code: host.code, close };
}

/** Drive the psychic from drawing through to the clue. */
export async function psychicTurn(page: Page, clue: string) {
  await page.getByTestId("draw-card").click();
  await page.getByTestId("flip-card").click();
  await page.getByTestId("pick-side-1").click();
  // The board only accepts a flick once the client has entered the spin phase.
  await expect(page.getByTestId("panel")).toContainText("Spin the wheel");
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

/** Assert a rendered dial is within `tolerance` of a spectrum position. */
export async function expectDialNear(
  page: Page,
  dialId: string,
  position: number,
  tolerance = 0.03,
) {
  await expect
    .poll(async () => {
      const raw = await page
        .getByTestId(`dial-${dialId}`)
        .getAttribute("data-position");
      return raw === null ? NaN : Math.abs(Number(raw) - position);
    })
    .toBeLessThanOrEqual(tolerance);
}

/**
 * Host + guests in a Co-op or FFA game with a fixed number of rounds, started.
 * The rounds slider is driven with the keyboard from its default of 7.
 */
export async function startModeGame(
  browser: Browser,
  mode: "coop" | "ffa",
  rounds: number,
  guestNames: string[],
) {
  const host = await hostGame(browser, "Ann");
  const guests: Client[] = [];
  for (const name of guestNames) {
    guests.push(await joinGame(browser, host.code, name));
  }
  await host.page.getByTestId("open-settings").click();
  await host.page.getByTestId(`mode-${mode}`).click();
  // The Rounds slider only exists once the mode change has round-tripped.
  await expect(host.page.getByTestId("rounds-value")).toHaveText("7");
  const thumb = host.page.getByRole("slider", { name: "Rounds" });
  await thumb.focus();
  // One step per round trip: each press is confirmed by the server.
  for (let i = 7; i > rounds; i--) {
    await host.page.keyboard.press("ArrowLeft");
    await expect(host.page.getByTestId("rounds-value")).toHaveText(
      String(i - 1),
    );
  }
  for (let i = 7; i < rounds; i++) {
    await host.page.keyboard.press("ArrowRight");
    await expect(host.page.getByTestId("rounds-value")).toHaveText(
      String(i + 1),
    );
  }
  await host.page.keyboard.press("Escape");
  await expect(host.page.getByTestId("mode-label")).toContainText(
    `${rounds} rounds`,
  );
  await host.page.getByTestId("start-game").click();
  await expect(host.page.getByTestId("score-header")).toBeVisible();
  const all = [host, ...guests];
  const close = () => Promise.all(all.map((c) => c.context.close()));
  return { host, guests, all, code: host.code, close };
}

export async function readTarget(page: Page): Promise<number> {
  const raw = await page.getByTestId("disc").getAttribute("data-target");
  const target = Number(raw);
  expect(target).toBeGreaterThan(0);
  return target;
}
