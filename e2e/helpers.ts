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

/**
 * Host + three guests in a Teams game, started. Ann/Cid left, Bob/Dee right.
 * `avatars` maps a player name to a catalog avatar id picked in the lounge.
 */
export async function startTeamsGame(
  browser: Browser,
  extraNames: string[] = [],
  avatars: Record<string, string> = {},
) {
  const host = await hostGame(browser, "Ann");
  const bob = await joinGame(browser, host.code, "Bob");
  const cid = await joinGame(browser, host.code, "Cid");
  const dee = await joinGame(browser, host.code, "Dee");
  const extras: Client[] = [];
  for (const name of extraNames) {
    extras.push(await joinGame(browser, host.code, name));
  }
  for (const client of [host, bob, cid, dee, ...extras]) {
    const id = avatars[client.name];
    if (!id) continue;
    await client.page.getByTestId("open-avatar").click();
    await client.page.getByTestId(`avatar-${id}`).click();
    await expect(
      playerRow(client.page, client.name).locator(`[data-avatar=${id}]`),
    ).toBeVisible();
  }
  await host.page.getByTestId("open-settings").click();
  await host.page.getByRole("button", { name: "Left Brain" }).click();
  // Tests know who is up: pin the rotation to join order.
  await host.page.getByTestId("first-psychic-order").click();
  await expect(host.page.getByTestId("first-psychic-order")).toHaveAttribute(
    "data-variant",
    "default",
  );
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
  // The board only accepts a spin once the client has entered the spin phase.
  await expect(page.getByTestId("panel")).toContainText("Spin the wheel");
  await expect(page.getByTestId("shroud")).toHaveAttribute("data-open", "true");
  await tapWheel(page);
  // The spin lands with the wedge in view (the shroud is already open).
  await expect(page.getByTestId("wedge-4")).toBeVisible();
  await expect(page.getByTestId("peek-toggle")).toBeEnabled();
  await page.getByTestId("clue-input").fill(clue);
  await page.getByTestId("submit-clue").click();
  await expect(page.getByTestId("clue")).toContainText(clue);
  // Giving the clue covers the wheel again.
  await expect(page.getByTestId("shroud")).not.toHaveAttribute("data-open");
}

/** A tap on the open wheel spins it with a random flick. */
export async function tapWheel(page: Page) {
  const box = (await page.getByTestId("board").boundingBox())!;
  await page.mouse.click(
    box.x + box.width / 2,
    box.y + box.height * (205 / 230) - box.width * 0.3,
  );
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
 * The rounds slider is driven with the keyboard from its default of 2.
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
  await host.page.getByTestId("first-psychic-order").click();
  await expect(host.page.getByTestId("first-psychic-order")).toHaveAttribute(
    "data-variant",
    "default",
  );
  // The Rounds slider only exists once the mode change has round-tripped.
  await expect(host.page.getByTestId("rounds-value")).toHaveText("2");
  const thumb = host.page.getByRole("slider", { name: "Rounds" });
  await thumb.focus();
  // One step per round trip: each press is confirmed by the server.
  for (let i = 2; i > rounds; i--) {
    await host.page.keyboard.press("ArrowLeft");
    await expect(host.page.getByTestId("rounds-value")).toHaveText(
      String(i - 1),
    );
  }
  for (let i = 2; i < rounds; i++) {
    await host.page.keyboard.press("ArrowRight");
    await expect(host.page.getByTestId("rounds-value")).toHaveText(
      String(i + 1),
    );
  }
  await host.page.keyboard.press("Escape");
  await expect(host.page.getByTestId("mode-label")).toContainText(
    `${rounds} round`,
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

/**
 * A flat-out flick: nearly a full turn in four pointer moves, so even a
 * browser that stamps synthetic events in real time reports a velocity
 * well past the server's clamp (the Pixel emulation lands around 20 rad/s
 * with `flickWheel`).
 */
export async function flickWheelHard(page: Page) {
  const box = (await page.getByTestId("board").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * (205 / 230);
  const r = box.width * 0.4;
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };
  // Press just above the baseline (inside the board), then sweep round;
  // pointer capture keeps the moves below the baseline on the wheel.
  await page.mouse.move(...at(170));
  await page.mouse.down();
  // Each hop is just under a half turn: the most the wheel reads per event.
  for (const deg of [0, -170, -340, -510, -680]) {
    await page.mouse.move(...at(deg), { steps: 1 });
  }
  await page.mouse.up();
}
