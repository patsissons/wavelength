/**
 * Public game state model. Everything here is visible to every client; the
 * secret target lives in the server-only `SecretState` until reveal.
 */

export const PROTOCOL_VERSION = 4;

export type Mode = "teams" | "coop" | "ffa";
export type TeamId = "left" | "right";
export type Side = "left" | "right";
export type Phase =
  | "lobby"
  | "drawing"
  | "spinning"
  | "clue"
  | "guessing"
  | "voting"
  | "reveal"
  | "gameover";

export type WedgeScore = 0 | 2 | 3 | 4;

export interface Player {
  id: string;
  name: string;
  /** Index into the player colour palette. */
  color: number;
  /**
   * A catalog id (shared/avatars/catalog.ts) or a single emoji; null shows
   * the monogram.
   */
  avatar: string | null;
  /** Teams mode only. */
  team: TeamId | null;
  /** Join order; drives psychic rotation. */
  order: number;
  /** Has at least one live socket. */
  connected: boolean;
  /** Disconnected longer than the grace period; excluded from "active" sets. */
  away: boolean;
  disconnectedAt: number | null;
}

export interface Spectrum {
  left: string;
  right: string;
}

export interface Card {
  id: string;
  sides: [Spectrum, Spectrum];
}

export interface Settings {
  mode: Mode;
  /** Teams: points to win. */
  targetScore: number;
  /** Co-op / FFA: number of rounds; a round is one psychic turn per player. */
  rounds: number;
  /** FFA: does the psychic score the guessers' average? */
  psychicScoring: "none" | "average";
  /** Teams: a 4-point turn while behind grants another turn. */
  catchUp: boolean;
  firstTeam: TeamId | "random";
  /** Who opens the rotation: a random player or the first to join. */
  firstPsychic: "random" | "order";
  /** Wheel spins allowed per turn; 0 = unlimited. */
  maxSpins: number;
  /**
   * Seconds guessers have to move their dial once the clue is given; 0 =
   * no limit. When it elapses every dial locks where it is.
   */
  guessSeconds: number;
  /** Host-entered extra spectra, mixed into the deck. */
  customSpectra: Spectrum[];
  useBuiltInDeck: boolean;
  effects: boolean;
}

export interface Spin {
  id: string;
  direction: 1 | -1;
  turns: number;
  durationMs: number;
  startedAt: number;
}

export interface DialState {
  /** "shared" for a team dial, or the owning player's id in FFA. */
  id: string;
  /** Players allowed to move/accept this dial. */
  owners: string[];
  /** 0..1 along the spectrum, last committed position. */
  position: number;
  movedBy: string | null;
  /** Owners who have accepted the current position; cleared on any move. */
  accepts: string[];
  locked: boolean;
}

/** Timed actions within a round; the raw material for the stats. */
export type RoundLogEntry =
  | { t: "draw"; at: number }
  | { t: "side"; at: number }
  | { t: "spin"; at: number }
  | { t: "shroud"; at: number; open: boolean }
  | { t: "clue"; at: number }
  | {
      t: "move";
      at: number;
      by: string;
      dialId: string;
      from: number;
      to: number;
    }
  | { t: "accept"; at: number; by: string; dialId: string }
  | { t: "unaccept"; at: number; by: string; dialId: string }
  | { t: "lock"; at: number; dialId: string }
  | { t: "timeout"; at: number }
  | { t: "vote"; at: number; by: string; side: Side };

export interface PlayerRoundStats {
  moves: number;
  /** Sum of |to − from| in spectrum units (1 = the whole dial). */
  travel: number;
  /** Moves that brought the dial closer to / further from the target. */
  toward: number;
  away: number;
  /** Σ wedge(to) − wedge(from) over their moves. */
  pointsSwing: number;
  /** Closest any of their moves got to the target, in spectrum units. */
  closest: number | null;
  /** From the clue to their first move. */
  firstMoveMs: number | null;
  firstMover: boolean;
  /** They made the last move on a dial that then locked. */
  finalMover: boolean;
  accepts: number;
  unaccepts: number;
  /** Their accept was the one that locked the dial. */
  lastAccepter: boolean;
  vote: "correct" | "wrong" | null;
}

export interface RoundStats {
  durationMs: number;
  drawMs: number | null;
  pickMs: number | null;
  /** From the last spin to the clue. */
  clueMs: number | null;
  /** From the clue to the last lock. */
  guessMs: number | null;
  spins: number;
  peeks: number;
  clueLength: number;
  players: Record<string, PlayerRoundStats>;
}

export interface VoteResult {
  left: number;
  right: number;
  majority: Side | null;
  /** Which side of the dial the target actually was. */
  correct: Side | null;
  bonusTo: TeamId | null;
}

export interface RoundResult {
  /** 0-based turn number (`Round.index`). */
  roundIndex: number;
  /**
   * 1-based round (co-op / FFA: rotation; Teams: same as the turn) this
   * turn belongs to. Missing on results recorded before it was tracked.
   */
  round?: number;
  psychicId: string;
  psychicTeam: TeamId | null;
  spectrum: Spectrum;
  clue: string;
  target: number;
  dials: Record<
    string,
    { position: number; wedge: WedgeScore; owners: string[] }
  >;
  vote: VoteResult | null;
  /** Score deltas keyed like `GameState.scores`. */
  deltas: Record<string, number>;
  /** Teams catch-up: the same team goes again. */
  goAgain: boolean;
  /** FFA: extra points for the psychic because every guesser hit a 4. */
  psychicBonus: number;
  /** Decided at reveal; applied when the round advances. */
  gameOver: GameOver | null;
  stats: RoundStats;
}

export interface Round {
  index: number;
  psychicId: string;
  psychicTeam: TeamId | null;
  card: Card | null;
  side: 0 | 1 | null;
  spectrum: Spectrum | null;
  spin: Spin | null;
  /** Times the wheel has been spun this round (re-spins allowed until the clue). */
  spins: number;
  /** The psychic's shroud: open from the side pick until the clue, then toggled. */
  shroudOpen: boolean;
  /** Explicit peeks (shroud opened by the psychic) this round. */
  peeks: number;
  clue: string | null;
  /** Server time when the dial timer runs out; null without a timer. */
  guessDeadline: number | null;
  dials: Record<string, DialState>;
  /** Teams: opposing players' left/right calls. */
  votes: Record<string, Side>;
  /** Only populated from reveal onward. */
  target: number | null;
  result: RoundResult | null;
  log: RoundLogEntry[];
  /** This round was granted by the catch-up rule. */
  catchUp: boolean;
  startedAt: number;
}

export interface GameOver {
  /** Team id (teams), player id (ffa), or null (co-op / tie). */
  winner: string | null;
  /** Co-op benchmark label. */
  label: string | null;
}

export interface GameState {
  protocolVersion: number;
  /** Monotonic; bumped by every persisted event. */
  version: number;
  code: string;
  hostId: string;
  phase: Phase;
  settings: Settings;
  players: Record<string, Player>;
  /** Teams: whose turn it is. */
  activeTeam: TeamId | null;
  /** Psychic rotation: join `order` of the last psychic per pool (-1 = none). */
  psychicCursor: { left: number; right: number; all: number };
  /**
   * Join `order` of the player who opened each pool's rotation (-1 = none).
   * A rotation is complete when the cursor passes this order again.
   */
  psychicStart: { left: number; right: number; all: number };
  /**
   * Scores keyed by "left"/"right" (teams), "coop" (co-op) or player id
   * (ffa).
   */
  scores: Record<string, number>;
  round: Round | null;
  /**
   * Teams: completed turns. Co-op / FFA: completed rounds, where a round is
   * one psychic turn per player (`history.length` counts the turns).
   */
  roundsPlayed: number;
  /**
   * Reactions sent this game: player id → effect id → count. Pokes count
   * as "poke" for the sender and "poked" for the target.
   */
  effectTally: Record<string, Record<string, number>>;
  history: RoundResult[];
  suddenDeath: boolean;
  gameOver: GameOver | null;
  deckRemaining: number;
  createdAt: number;
}

export const TEAM_NAMES: Record<TeamId, string> = {
  left: "Left Brain",
  right: "Right Brain",
};

export const PLAYER_COLORS = 12;

export const DEFAULT_SETTINGS: Settings = {
  mode: "teams",
  targetScore: 10,
  rounds: 2,
  psychicScoring: "average",
  catchUp: true,
  firstTeam: "random",
  firstPsychic: "random",
  maxSpins: 3,
  guessSeconds: 0,
  customSpectra: [],
  useBuiltInDeck: true,
  effects: true,
};

export const LIMITS = {
  maxPlayers: 16,
  nameMax: 20,
  clueMax: 60,
  labelMax: 28,
  customSpectraMax: 60,
  minTargetScore: 5,
  maxTargetScore: 20,
  minRounds: 1,
  maxRounds: 10,
  maxSpins: 10,
  maxGuessSeconds: 300,
} as const;

export function otherTeam(team: TeamId): TeamId {
  return team === "left" ? "right" : "left";
}
