import { expect, test, type Page } from "@playwright/test";
import { hostGame, psychicTurn, startTeamsGame } from "./helpers";

/** Every screen keeps a margin on all edges and never scrolls sideways. */
async function expectPageFits(page: Page, root = "main") {
  const checkTop = root === "main";
  const box = await page.evaluate((selector) => {
    const el = document.querySelector(selector)!;
    const cs = getComputedStyle(el);
    const doc = document.documentElement;
    return {
      left: parseFloat(cs.paddingLeft),
      right: parseFloat(cs.paddingRight),
      top: parseFloat(cs.paddingTop),
      scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth),
      clientWidth: doc.clientWidth,
    };
  }, root);
  expect(box.left).toBeGreaterThanOrEqual(16);
  expect(box.right).toBeGreaterThanOrEqual(16);
  if (checkTop) expect(box.top).toBeGreaterThanOrEqual(16);
  expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
}

test("screens keep an edge margin and the toolbar stays inside the viewport", async ({
  browser,
}) => {
  const lounge = await hostGame(browser, "Ann");
  await expectPageFits(lounge.page);
  await expectPageFits(lounge.page, "footer");
  await lounge.context.close();

  const game = await startTeamsGame(browser);
  const { host, cid } = game;
  const width = host.page.viewportSize()!.width;
  for (const { page } of [host, cid]) {
    await expectPageFits(page);
    await expectPageFits(page, "footer");
  }
  // The host button is fully on screen, with a margin to the right edge.
  const hostBox = (await host.page.getByTestId("host-controls").boundingBox())!;
  expect(hostBox.x + hostBox.width).toBeLessThanOrEqual(width - 16);
  const mute = (await cid.page.getByTestId("mute-toggle").boundingBox())!;
  expect(mute.x).toBeGreaterThanOrEqual(16);

  // Still true once the round is in full swing.
  await psychicTurn(host.page, "Banana");
  await expectPageFits(host.page);
  const again = (await host.page.getByTestId("host-controls").boundingBox())!;
  expect(again.x + again.width).toBeLessThanOrEqual(width - 16);
  await game.close();
});
