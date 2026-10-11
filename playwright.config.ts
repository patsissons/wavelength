import { defineConfig, devices } from "@playwright/test";

// E2e runs against `vite dev` with the wrangler `e2e` env selected, so the
// game room uses a fixed seed and a short away-grace period. Port 5199 (not
// 5173) so a normally-running dev server is never reused.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5199",
    trace: "on-first-retry",
    // Spin/shroud/card animations collapse to instant under reduced motion.
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: "pnpm dev --port 5199 --strictPort",
    url: "http://localhost:5199/api/health",
    reuseExistingServer: false,
    env: { CLOUDFLARE_ENV: "e2e" },
  },
});
