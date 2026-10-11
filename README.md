# Wavelength

A mobile-first online version of the party game Wavelength. A host creates a
game, players join from their phones with a short code, and the game keeps
everyone in sync over WebSockets.

The psychic draws a card from a pile, spins the wheel behind a shroud, peeks
at the target, and gives a clue. Guessers turn a dial (shared or their own,
depending on the mode) toward where they think the target lies. Everyone can
fire sound and visual effects at everyone else.

## Modes

- **Teams** (the official rules): two teams, a shared dial per turn, the
  other team calls left/right for a bonus point, first to 10 with catch-up.
- **Co-op**: everyone on one team, a fixed number of rounds, scored against
  benchmark labels.
- **Free-for-all**: every guesser has their own dial and scores individually.

## Stack

- React 19, Vite, Tailwind v4, shadcn/ui
- One Cloudflare Worker serving the SPA as static assets and hosting a
  Durable Object per game room (via `partyserver`) for WebSockets
- Shared, pure game logic in `shared/` used by both the client and the Worker
- Vitest (unit), Playwright (e2e on mobile emulation), ESLint, Prettier

## Setup

```sh
pnpm install
pnpm exec playwright install webkit chromium
pnpm dev
```

`pnpm dev` runs Vite with the Cloudflare plugin, so the Worker and the game
room Durable Object run locally in workerd. Open the printed URL on your
phone (same network) to play.

## Scripts

| Script                     | What it does                                                  |
| -------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                 | Local dev server (Vite + Worker + Durable Objects in workerd) |
| `pnpm build`               | Production build into `dist/`                                 |
| `pnpm preview`             | Serve the production build locally in the Workers runtime     |
| `pnpm deploy`              | Build and deploy to Cloudflare with wrangler                  |
| `pnpm types`               | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc`  |
| `pnpm typecheck`           | Regenerate Worker types, then `tsc -b` over all projects      |
| `pnpm test`                | Unit tests (Vitest)                                           |
| `pnpm test:watch`          | Unit tests in watch mode                                      |
| `pnpm test:e2e`            | Playwright e2e (iPhone and Pixel emulation)                   |
| `pnpm lint`                | ESLint                                                        |
| `pnpm format`              | Prettier (write)                                              |
| `pnpm format:check`        | Prettier (check)                                              |
| `pnpm validate:quick`      | Format check + typecheck + lint + unit tests                  |
| `pnpm validate`            | `validate:quick` + e2e                                        |
| `pnpm format-and-validate` | Prettier write, then `validate`. Run before every commit.     |

## Deploy

```sh
pnpm deploy
```

Requires `wrangler login` (or `CLOUDFLARE_API_TOKEN`). The Worker serves
static assets with SPA fallback and routes `/api/*` and `/parties/*` to the
Worker first.
