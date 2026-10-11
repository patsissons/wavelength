import { SEGMENT } from "./geometry";
import { sideOfTarget, wedgeScore } from "./scoring";
import type {
  Mode,
  Player,
  PlayerRoundStats,
  Round,
  RoundResult,
  RoundStats,
} from "./types";

/* ---------- per round (computed by the server at reveal) ---------- */

function emptyPlayerStats(): PlayerRoundStats {
  return {
    moves: 0,
    travel: 0,
    toward: 0,
    away: 0,
    pointsSwing: 0,
    closest: null,
    firstMoveMs: null,
    firstMover: false,
    finalMover: false,
    accepts: 0,
    unaccepts: 0,
    lastAccepter: false,
    vote: null,
  };
}

/** Everything measurable about one round, given the (now public) target. */
export function computeRoundStats(
  round: Round,
  target: number,
  now: number,
): RoundStats {
  const log = round.log;
  const at = (t: string) => log.find((e) => e.t === t)?.at ?? null;
  const last = (t: string) =>
    [...log].reverse().find((e) => e.t === t)?.at ?? null;
  const drawAt = at("draw");
  const sideAt = at("side");
  const lastSpinAt = last("spin");
  const clueAt = at("clue");
  const lastLockAt = last("lock");

  const players: Record<string, PlayerRoundStats> = {};
  const stats = (id: string) => (players[id] ??= emptyPlayerStats());
  // Everyone who owned a dial gets a row, even if they never touched it.
  for (const dial of Object.values(round.dials)) {
    for (const id of dial.owners) stats(id);
  }

  let firstMove: string | null = null;
  const lastMover: Record<string, string> = {}; // dialId → player
  const lastAccept: Record<string, string> = {};
  for (const e of log) {
    if (e.t === "move") {
      const p = stats(e.by);
      p.moves += 1;
      p.travel += Math.abs(e.to - e.from);
      const before = Math.abs(e.from - target);
      const after = Math.abs(e.to - target);
      if (after < before - 1e-9) p.toward += 1;
      else if (after > before + 1e-9) p.away += 1;
      p.pointsSwing += wedgeScore(e.to, target) - wedgeScore(e.from, target);
      p.closest = p.closest === null ? after : Math.min(p.closest, after);
      if (p.firstMoveMs === null && clueAt !== null) {
        p.firstMoveMs = Math.max(0, e.at - clueAt);
      }
      firstMove ??= e.by;
      lastMover[e.dialId] = e.by;
    } else if (e.t === "accept") {
      stats(e.by).accepts += 1;
      lastAccept[e.dialId] = e.by;
    } else if (e.t === "unaccept") {
      stats(e.by).unaccepts += 1;
    } else if (e.t === "lock") {
      const mover = lastMover[e.dialId];
      if (mover) stats(mover).finalMover = true;
      const accepter = lastAccept[e.dialId];
      const dial = round.dials[e.dialId];
      // Only when the lock came from accepts (not a host force-lock).
      if (accepter && dial && dial.accepts.includes(accepter)) {
        stats(accepter).lastAccepter = true;
      }
    } else if (e.t === "vote") {
      const shared = round.dials.shared;
      if (shared) {
        const correct = sideOfTarget(shared.position, target);
        stats(e.by).vote = correct === e.side ? "correct" : "wrong";
      }
    }
  }
  if (firstMove) stats(firstMove).firstMover = true;

  return {
    durationMs: Math.max(0, now - round.startedAt),
    drawMs: drawAt === null ? null : drawAt - round.startedAt,
    pickMs: drawAt === null || sideAt === null ? null : sideAt - drawAt,
    clueMs: lastSpinAt === null || clueAt === null ? null : clueAt - lastSpinAt,
    guessMs:
      clueAt === null || lastLockAt === null ? null : lastLockAt - clueAt,
    spins: round.spins,
    peeks: round.peeks,
    clueLength: (round.clue ?? "").trim().length,
    players,
  };
}

/* ---------- per game (computed by clients from the history) ---------- */

export interface PlayerTotals {
  id: string;
  rounds: number; // rounds in which they owned a dial
  moves: number;
  travel: number;
  toward: number;
  away: number;
  pointsSwing: number;
  closest: number | null;
  fastestMoveMs: number | null;
  firstMoves: number;
  finalMoves: number;
  accepts: number;
  unaccepts: number;
  lastAccepts: number;
  votes: number;
  votesCorrect: number;
  psychicTurns: number;
  psychicPoints: number;
  clueMs: number;
  clueChars: number;
  spins: number;
  peeks: number;
}

export function playerTotals(
  history: ReadonlyArray<RoundResult>,
  players: Record<string, Player>,
): PlayerTotals[] {
  const totals: Record<string, PlayerTotals> = {};
  const get = (id: string) =>
    (totals[id] ??= {
      id,
      rounds: 0,
      moves: 0,
      travel: 0,
      toward: 0,
      away: 0,
      pointsSwing: 0,
      closest: null,
      fastestMoveMs: null,
      firstMoves: 0,
      finalMoves: 0,
      accepts: 0,
      unaccepts: 0,
      lastAccepts: 0,
      votes: 0,
      votesCorrect: 0,
      psychicTurns: 0,
      psychicPoints: 0,
      clueMs: 0,
      clueChars: 0,
      spins: 0,
      peeks: 0,
    });
  for (const id of Object.keys(players)) get(id);
  for (const r of history) {
    const s = r.stats;
    for (const [id, p] of Object.entries(s.players)) {
      const t = get(id);
      t.rounds += 1;
      t.moves += p.moves;
      t.travel += p.travel;
      t.toward += p.toward;
      t.away += p.away;
      t.pointsSwing += p.pointsSwing;
      if (p.closest !== null)
        t.closest =
          t.closest === null ? p.closest : Math.min(t.closest, p.closest);
      if (p.firstMoveMs !== null)
        t.fastestMoveMs =
          t.fastestMoveMs === null
            ? p.firstMoveMs
            : Math.min(t.fastestMoveMs, p.firstMoveMs);
      if (p.firstMover) t.firstMoves += 1;
      if (p.finalMover) t.finalMoves += 1;
      t.accepts += p.accepts;
      t.unaccepts += p.unaccepts;
      if (p.lastAccepter) t.lastAccepts += 1;
      if (p.vote) {
        t.votes += 1;
        if (p.vote === "correct") t.votesCorrect += 1;
      }
    }
    // Votes come from opponents who own no dial; count them too.
    const psychic = get(r.psychicId);
    psychic.psychicTurns += 1;
    psychic.psychicPoints += psychicWedge(r);
    psychic.clueMs += s.clueMs ?? 0;
    psychic.clueChars += s.clueLength;
    psychic.spins += s.spins;
    psychic.peeks += s.peeks;
  }
  return Object.values(totals).sort(
    (a, b) => (players[a.id]?.order ?? 0) - (players[b.id]?.order ?? 0),
  );
}

/** Points the guessers earned on this psychic's clue (mean over FFA dials). */
function psychicWedge(r: RoundResult): number {
  const dials = Object.values(r.dials);
  if (dials.length === 0) return 0;
  return dials.reduce((sum, d) => sum + d.wedge, 0) / dials.length;
}

export interface Award {
  id: string;
  emoji: string;
  title: string;
  playerId: string;
  value: string;
}

const DEG = 180; // a full dial sweep in degrees

const ms = (v: number) => `${(v / 1000).toFixed(1)} s`;
const deg = (v: number) => `${Math.round(v * DEG)}°`;

/**
 * Fun superlatives for the end screen. Each award only appears when the
 * data supports it; ties go to whoever joined first.
 */
export function gameAwards(
  history: ReadonlyArray<RoundResult>,
  players: Record<string, Player>,
  mode: Mode,
): Award[] {
  const totals = playerTotals(history, players);
  const awards: Award[] = [];
  const pick = (
    id: string,
    emoji: string,
    title: string,
    candidates: PlayerTotals[],
    score: (t: PlayerTotals) => number | null,
    better: "max" | "min",
    value: (t: PlayerTotals) => string,
    ok: (best: number) => boolean = () => true,
  ) => {
    let best: PlayerTotals | null = null;
    let bestScore = 0;
    for (const t of candidates) {
      const s = score(t);
      if (s === null) continue;
      if (best === null || (better === "max" ? s > bestScore : s < bestScore)) {
        best = t;
        bestScore = s;
      }
    }
    if (best && ok(bestScore)) {
      awards.push({ id, emoji, title, playerId: best.id, value: value(best) });
    }
  };
  const guessers = totals.filter((t) => t.moves > 0);
  const psychics = totals.filter((t) => t.psychicTurns > 0);

  pick(
    "sharpshooter",
    "🎯",
    "Sharpshooter",
    guessers,
    (t) => t.closest,
    "min",
    (t) => `${deg(t.closest ?? 0)} off at best`,
  );
  pick(
    "clutch",
    "💪",
    "Clutch",
    guessers,
    (t) => t.pointsSwing,
    "max",
    (t) => `+${t.pointsSwing} points from their moves`,
    (s) => s > 0,
  );
  pick(
    "saboteur",
    "🙈",
    "Saboteur",
    guessers,
    (t) => t.pointsSwing,
    "min",
    (t) => `${t.pointsSwing} points from their moves`,
    (s) => s < 0,
  );
  pick(
    "wanderer",
    "🧭",
    "Wanderer",
    guessers,
    (t) => t.away,
    "max",
    (t) => `${t.away} moves away from the target`,
    (s) => s >= 2,
  );
  pick(
    "fidget",
    "🫨",
    "Fidget",
    guessers,
    (t) => t.moves / t.rounds,
    "max",
    (t) => `${(t.moves / t.rounds).toFixed(1)} moves per turn`,
    (s) => s >= 3,
  );
  if (guessers.length > 1) {
    pick(
      "zen",
      "🧘",
      "Zen",
      guessers,
      (t) => t.moves / t.rounds,
      "min",
      (t) => `${(t.moves / t.rounds).toFixed(1)} moves per turn`,
    );
  }
  pick(
    "marathon",
    "🏃",
    "Marathon",
    guessers,
    (t) => t.travel,
    "max",
    (t) => `${deg(t.travel)} of dial travel`,
    (s) => s * DEG >= 90,
  );
  pick(
    "quickdraw",
    "⚡",
    "Quick draw",
    guessers,
    (t) => t.fastestMoveMs,
    "min",
    (t) => `moved ${ms(t.fastestMoveMs ?? 0)} after the clue`,
  );
  pick(
    "lastword",
    "🎤",
    "Last word",
    guessers,
    (t) => t.finalMoves,
    "max",
    (t) => `${t.finalMoves} final ${t.finalMoves === 1 ? "say" : "says"}`,
    (s) => s >= 1,
  );
  pick(
    "holdout",
    "🔒",
    "Holdout",
    totals,
    (t) => t.lastAccepts,
    "max",
    (t) => `locked it in ${t.lastAccepts} times`,
    (s) => s >= 2,
  );
  pick(
    "secondthoughts",
    "🤔",
    "Second thoughts",
    totals,
    (t) => t.unaccepts,
    "max",
    (t) => `${t.unaccepts} un-accepts`,
    (s) => s >= 1,
  );
  pick(
    "mindreader",
    "🔮",
    "Mind reader",
    psychics,
    (t) => t.psychicPoints / t.psychicTurns,
    "max",
    (t) => `${(t.psychicPoints / t.psychicTurns).toFixed(1)} points per clue`,
  );
  if (psychics.length > 1) {
    pick(
      "deepthinker",
      "🧠",
      "Deep thinker",
      psychics,
      (t) => t.clueMs / t.psychicTurns,
      "max",
      (t) => `${ms(t.clueMs / t.psychicTurns)} per clue`,
    );
    pick(
      "snap",
      "🫰",
      "Snap clue",
      psychics,
      (t) => t.clueMs / t.psychicTurns,
      "min",
      (t) => `${ms(t.clueMs / t.psychicTurns)} per clue`,
    );
    pick(
      "wordsmith",
      "📜",
      "Wordsmith",
      psychics,
      (t) => t.clueChars / t.psychicTurns,
      "max",
      (t) => `${Math.round(t.clueChars / t.psychicTurns)} letters per clue`,
    );
    pick(
      "minimalist",
      "🤫",
      "Minimalist",
      psychics,
      (t) => t.clueChars / t.psychicTurns,
      "min",
      (t) => `${Math.round(t.clueChars / t.psychicTurns)} letters per clue`,
    );
  }
  pick(
    "spindoctor",
    "🌀",
    "Spin doctor",
    psychics,
    (t) => t.spins,
    "max",
    (t) => `${t.spins} spins`,
    (s) => s >= 2,
  );
  pick(
    "peeker",
    "👀",
    "Peeker",
    psychics,
    (t) => t.peeks,
    "max",
    (t) => `${t.peeks} ${t.peeks === 1 ? "peek" : "peeks"}`,
    (s) => s >= 1,
  );
  if (mode === "teams") {
    pick(
      "oracle",
      "🦉",
      "Oracle",
      totals.filter((t) => t.votes >= 2),
      (t) => t.votesCorrect / t.votes,
      "max",
      (t) => `${t.votesCorrect} of ${t.votes} calls right`,
    );
  }
  return awards;
}

export interface Fact {
  id: string;
  label: string;
  value: string;
}

/** Game-wide numbers for the end screen. */
export function gameFacts(
  history: ReadonlyArray<RoundResult>,
  players: Record<string, Player>,
): Fact[] {
  if (history.length === 0) return [];
  const facts: Fact[] = [];
  let travel = 0;
  let moves = 0;
  let spins = 0;
  let peeks = 0;
  let bullseyes = 0;
  let sweeps = 0;
  let closestMiss: number | null = null;
  let total = 0;
  let longest: RoundResult | null = null;
  let fastest: RoundResult | null = null;
  for (const r of history) {
    for (const p of Object.values(r.stats.players)) {
      travel += p.travel;
      moves += p.moves;
    }
    spins += r.stats.spins;
    peeks += r.stats.peeks;
    if (r.psychicBonus > 0) sweeps += 1;
    for (const d of Object.values(r.dials)) {
      if (d.wedge === 4) bullseyes += 1;
      if (d.wedge === 0) {
        const miss = Math.abs(d.position - r.target) - 2.5 * SEGMENT;
        closestMiss = closestMiss === null ? miss : Math.min(closestMiss, miss);
      }
    }
    total += r.stats.durationMs;
    if (!longest || r.stats.durationMs > longest.stats.durationMs) longest = r;
    if (!fastest || r.stats.durationMs < fastest.stats.durationMs) fastest = r;
  }
  const name = (id: string) => players[id]?.name ?? "someone";
  const minutes = Math.max(1, Math.round(total / 60000));
  facts.push({
    id: "length",
    label: "Played for",
    value: `${minutes} min over ${history.length} ${history.length === 1 ? "turn" : "turns"}`,
  });
  facts.push({
    id: "travel",
    label: "Dial travel",
    value:
      travel * DEG >= 360
        ? `${((travel * DEG) / 360).toFixed(1)} full revolutions in ${moves} moves`
        : `${deg(travel)} in ${moves} ${moves === 1 ? "move" : "moves"}`,
  });
  facts.push({ id: "spins", label: "Wheel spins", value: `${spins}` });
  facts.push({ id: "peeks", label: "Shroud peeks", value: `${peeks}` });
  facts.push({
    id: "bullseyes",
    label: "Bullseyes",
    value: `${bullseyes}`,
  });
  if (sweeps > 0) {
    facts.push({
      id: "sweeps",
      label: "Clean sweeps",
      value: `${sweeps} (everyone hit a 4)`,
    });
  }
  if (closestMiss !== null) {
    facts.push({
      id: "closestmiss",
      label: "Closest miss",
      value: `${deg(Math.max(0, closestMiss))} outside the wedge`,
    });
  }
  if (longest && history.length > 1) {
    facts.push({
      id: "longest",
      label: "Longest turn",
      value: `${name(longest.psychicId)}'s “${longest.clue}” (${ms(longest.stats.durationMs)})`,
    });
  }
  if (fastest && history.length > 1) {
    facts.push({
      id: "fastest",
      label: "Fastest turn",
      value: `${name(fastest.psychicId)}'s “${fastest.clue}” (${ms(fastest.stats.durationMs)})`,
    });
  }
  return facts;
}
