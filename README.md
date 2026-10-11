# Wavelength

A mobile-first online version of the party game Wavelength. A host creates a
game, players join from their phones with a short code, and the game keeps
everyone in sync over WebSockets.

The psychic draws a card from a pile, spins the wheel (as often as they
like), covers it with the shroud and gives a clue. Guessers turn a dial
(shared or their own, depending on the mode) toward where they think the
target lies. Everyone can fire sound and visual effects at everyone else,
and the game ends with awards and stats.

## Modes

- **Teams** (the official rules): two teams, a shared dial per turn, the
  other team calls left/right for a bonus point, first to 10 with catch-up.
- **Co-op**: everyone on one team, a fixed number of rounds, scored against
  benchmark labels.
- **Free-for-all**: every guesser has their own dial and scores individually.

In Co-op and Free-for-all a _round_ is one psychic turn per player, so a
two-round game with four players is eight turns.

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

## How a game works

1. The host enters a name and taps **Host a game**; a four-letter code and a
   share link / QR appear in the lounge.
2. Players open the link (or type the code next to their name on the home
   page) and land in the lounge. In Teams mode they are auto-balanced and
   can tap a team to switch. The code and QR stay visible during the game so
   late arrivals can still join.
3. The host picks the mode and settings (points to win, rounds, catch-up,
   custom spectra, effects) and starts the game.
4. Each turn the psychic draws a card off the pile, flips it to compare both
   spectra and picks a side. The shroud lifts and everyone watches the wheel;
   the psychic taps or flicks it to spin (only their screen shows the
   wedge) and can spin again until they like the target. Tapping the shroud
   or its handle covers and uncovers the wheel; giving the clue (type it and
   say it out loud) covers it automatically.
5. Guessers turn the dial. On a shared dial anyone on the team can move it;
   the dial locks once every active teammate has accepted, and any move
   clears the accepts. In free-for-all each guesser has a private dial.
6. In Teams the other team calls **left** or **right** (majority wins, ties
   score nothing), then the shroud opens for everyone and points are scored:
   4 / 3 / 2 for the wedge, +1 for a correct call unless it was a bullseye,
   and a 4 while behind grants another turn. First to the target wins; a tie
   at the target goes to sudden death.
7. Anyone can fire effects (emoji bursts, confetti, sounds, screen shakes,
   haptics) at the room; the psychic has their own set. Confetti falls on
   every screen when a dial locks, and on the guessers' screens when they
   score (a bullseye gets the full barrage). Tap **Enable sound** in the
   lounge once so iOS allows audio; any later tap re-arms it, and sound
   plays even with the iPhone ringer switch on silent.
8. The game-over screen hands out awards (Sharpshooter, Saboteur, Quick
   draw, Mind reader, Spin doctor and more), lists game-wide numbers, a
   per-player table and every turn's clue and score.

If a phone sleeps or the tab is backgrounded, the player keeps their seat:
the client reconnects as soon as the page wakes, and the room only marks a
player "away" after a grace period (never ejects them). Away players don't
block the dial lock or the vote, and the host can skip a round if the
psychic has vanished.

## Architecture

- `shared/` — pure, runtime-agnostic game logic used by both sides:
  `game/commands.ts` (command → events with all phase/role rules),
  `game/reducer.ts` (`applyEvent`, the single reducer), scoring, geometry,
  `game/stats.ts` (round stats, awards and facts), the card deck, the
  effects catalog and the zod protocol schemas.
- `worker/` — the Cloudflare Worker: `/api/*` (create / join / status via
  Durable Object RPC) and `/parties/game-room/:code` WebSockets. `GameRoom`
  is a hibernating partyserver Durable Object per game code; it applies
  commands through the shared handler, persists after every command,
  broadcasts versioned events and answers `ping` without waking.
- `src/` — the React app. `lib/connection.ts` wraps partysocket with a
  heartbeat watchdog, wake-up reconnects, acks and idempotency ids;
  `lib/store.ts` applies events and resyncs on version gaps; the board is
  SVG with pointer-driven dial and spin hooks.

## Deploy

```sh
pnpm deploy
```

Requires `wrangler login` (or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`).
The Worker serves static assets with SPA fallback and routes `/api/*` and
`/parties/*` to the Worker first. CI (`.github/workflows/ci.yml`) validates
every PR and deploys `main` with those two secrets. Production is served at
<https://wavelength.lgtm.page> (custom domain in `wrangler.jsonc` `routes`),
with `wavelength.patricksissons.workers.dev` as a fallback.
