/**
 * Renders the Open Graph image (public/og.png, 1200x630) that chat apps
 * show when a link to the game is unfurled. The scene is the reveal: the
 * shroud is off, the scoring wedge is showing and three dials have been
 * locked at varying distances from it. The board is drawn with the real
 * geometry from shared/game/geometry.ts so it matches the app.
 *
 *   pnpm og
 */
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CX,
  CY,
  R,
  SEGMENTS,
  VIEW,
  positionToPoint,
  sectorPath,
  wedgeSectors,
} from "../../shared/game/geometry.ts";

const WIDTH = 1200;
const HEIGHT = 630;
const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "public/og.png");
const FONT = path.join(
  ROOT,
  "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
);

// Palette: the oklch tokens from src/index.css.
const C = {
  background: "oklch(0.17 0.045 290)",
  foreground: "oklch(0.97 0.01 290)",
  card: "oklch(0.23 0.05 290)",
  muted: "oklch(0.72 0.03 290)",
  border: "oklch(1 0 0 / 12%)",
  primary: "oklch(0.85 0.17 85)",
  primaryForeground: "oklch(0.2 0.05 290)",
  wheel: "oklch(0.3 0.06 290)",
  teamLeft: "oklch(0.72 0.17 25)",
  teamRight: "oklch(0.72 0.15 230)",
  green: "oklch(0.75 0.15 150)",
  wedge: {
    4: "oklch(0.85 0.17 85)",
    3: "oklch(0.72 0.17 60)",
    2: "oklch(0.62 0.15 40)",
  },
} as const;

const TARGET = 0.6;
const INNER = R * 0.55;
const TICK_COUNT = SEGMENTS * 2;

interface Dial {
  position: number;
  color: string;
  emoji: string;
  big?: boolean;
}

const DIALS: Dial[] = [
  { position: 0.33, color: C.green, emoji: "🐸" },
  { position: 0.72, color: C.teamRight, emoji: "🐙" },
  { position: 0.59, color: C.teamLeft, emoji: "🦊", big: true },
];

function ticks(): string {
  return Array.from({ length: TICK_COUNT }, (_, i) => {
    const angle = (i / TICK_COUNT) * Math.PI * 2;
    const major = i % 4 === 0;
    const r0 = R - (major ? 14 : 8);
    const x1 = CX + r0 * Math.cos(angle);
    const y1 = CY - r0 * Math.sin(angle);
    const x2 = CX + (R - 2) * Math.cos(angle);
    const y2 = CY - (R - 2) * Math.sin(angle);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.muted}" stroke-opacity="${major ? 0.8 : 0.4}" stroke-width="${major ? 2 : 1}"/>`;
  }).join("");
}

function wedge(): string {
  return wedgeSectors(TARGET)
    .map((s) => {
      const label = positionToPoint((s.p0 + s.p1) / 2, R * 0.8);
      return `<path d="${sectorPath(s.p0, s.p1, INNER, R - 4)}" fill="${C.wedge[s.score]}" stroke="${C.background}" stroke-width="2"/>
        <text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="central" font-size="18" font-weight="800" fill="${C.primaryForeground}">${s.score}</text>`;
    })
    .join("");
}

function needle(d: Dial): string {
  const tip = positionToPoint(d.position, R * 0.9);
  const knob = positionToPoint(d.position, R + 2);
  const r = d.big ? 20 : 14;
  return `<line x1="${CX}" y1="${CY}" x2="${tip.x}" y2="${tip.y}" stroke="${d.color}" stroke-width="${d.big ? 5 : 3}" stroke-linecap="round"/>
    <circle cx="${knob.x}" cy="${knob.y}" r="${r}" fill="${d.color}" stroke="${C.background}" stroke-width="3"/>
    <text x="${knob.x}" y="${knob.y + 1}" text-anchor="middle" dominant-baseline="central" font-size="${r * 1.35}">${d.emoji}</text>`;
}

function windowPath(radius: number): string {
  return `M ${CX - radius} ${CY} A ${radius} ${radius} 0 0 1 ${CX + radius} ${CY} Z`;
}

function board(): string {
  return `<svg viewBox="0 0 ${VIEW.width} ${VIEW.height}" width="680" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="window"><path d="${windowPath(R + 2)}"/></clipPath>
      <radialGradient id="glow" cx="50%" cy="100%" r="80%">
        <stop offset="0%" stop-color="${C.wheel}"/>
        <stop offset="100%" stop-color="${C.background}"/>
      </radialGradient>
    </defs>
    <path d="${windowPath(R)}" fill="url(#glow)" stroke="${C.border}" stroke-width="2"/>
    <g clip-path="url(#window)">${ticks()}${wedge()}</g>
    ${DIALS.map(needle).join("")}
    <circle cx="${CX}" cy="${CY}" r="10" fill="${C.card}" stroke="${C.border}" stroke-width="2"/>
  </svg>`;
}

/** A sprinkle of confetti around the arc, deterministic so renders match. */
function confetti(): string {
  const colors = [C.primary, C.teamLeft, C.teamRight, C.green, C.foreground];
  let seed = 7;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: 26 }, () => {
    const x = 180 + rand() * 840;
    const y = 220 + rand() * 300;
    // Keep the sprinkle outside the board window.
    const dx = x - 600;
    const dy = 583 - y;
    if (dy > 0 && Math.hypot(dx, dy) < 340) return "";
    const size = 4 + rand() * 6;
    const color = colors[Math.floor(rand() * colors.length)];
    const rotate = Math.floor(rand() * 90);
    const round = rand() > 0.5;
    return `<div style="position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${round ? size : size * 1.8}px;background:${color};opacity:${0.35 + rand() * 0.4};border-radius:${round ? "50%" : "2px"};transform:rotate(${rotate}deg)"></div>`;
  }).join("");
}

async function html(): Promise<string> {
  const font = (await readFile(FONT)).toString("base64");
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: Geist; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 100 900; }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; }
  body {
    background: ${C.background};
    color: ${C.foreground};
    font-family: Geist, system-ui, sans-serif;
    position: relative;
  }
  .glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 520px 300px at 50% 92%, oklch(0.85 0.17 85 / 0.22), transparent 70%),
      radial-gradient(ellipse 900px 500px at 50% 0%, oklch(0.3 0.07 300 / 0.6), transparent 70%);
  }
  header { position: absolute; left: 0; right: 0; top: 46px; text-align: center; }
  h1 { font-size: 112px; font-weight: 900; letter-spacing: -0.04em; line-height: 1; }
  p.tagline { margin-top: 10px; font-size: 34px; font-weight: 500; color: ${C.muted}; }
  .board { position: absolute; left: 260px; top: 192px; width: 680px; }
  .board svg { display: block; width: 680px; }
  .label {
    position: absolute; top: 494px;
    padding: 10px 20px; border-radius: 999px;
    background: ${C.card}; border: 2px solid ${C.border};
    font-size: 26px; font-weight: 700; white-space: nowrap;
  }
  .label.left { right: 960px; }
  .label.right { left: 960px; }
  .label span { color: ${C.muted}; }
  footer {
    position: absolute; left: 48px; right: 48px; bottom: 30px;
    display: flex; justify-content: space-between;
    font-size: 22px; font-weight: 500; color: ${C.muted};
  }
  footer b { color: ${C.primary}; font-weight: 700; }
</style></head>
<body>
  <div class="glow"></div>
  ${confetti()}
  <header>
    <h1>Wavelength</h1>
    <p class="tagline">Read your friends' minds.</p>
  </header>
  <div class="label left"><span>◀</span> Bad idea</div>
  <div class="label right">Great idea <span>▶</span></div>
  <div class="board">${board()}</div>
  <footer>
    <div>A party game for your phones. Free, no app.</div>
    <div><b>wavelength.lgtm.page</b></div>
  </footer>
</body></html>`;
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.setContent(await html());
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });
  await writeFile(OUT, png);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${png.byteLength} bytes)`);
} finally {
  await browser.close();
}
