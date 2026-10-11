import { describe, expect, it } from "vitest";
import { SEGMENT } from "./geometry";
import {
  computeRoundStats,
  gameAwards,
  gameFacts,
  playerTotals,
} from "./stats";
import type { Player, Round, RoundResult, RoundStats } from "./types";

const player = (id: string, order: number): Player => ({
  id,
  name: id.toUpperCase(),
  color: order,
  avatar: null,
  team: null,
  order,
  connected: true,
  away: false,
  disconnectedAt: null,
});
const players = {
  ann: player("ann", 0),
  bob: player("bob", 1),
  cid: player("cid", 2),
};

function round(
  log: Round["log"],
  dials: Round["dials"],
  clue = "banana",
): Round {
  return {
    index: 0,
    psychicId: "ann",
    psychicTeam: null,
    card: null,
    side: 1,
    spectrum: { left: "a", right: "b" },
    spin: null,
    spins: 2,
    shroudOpen: false,
    peeks: 1,
    clue,
    guessDeadline: null,
    dials,
    votes: {},
    target: null,
    result: null,
    log,
    catchUp: false,
    startedAt: 1000,
  };
}

const target = 0.5;

describe("computeRoundStats", () => {
  it("measures moves, accuracy, timing, accepts and votes", () => {
    const dials: Round["dials"] = {
      shared: {
        id: "shared",
        owners: ["bob", "cid"],
        position: target + SEGMENT,
        movedBy: "cid",
        accepts: ["bob", "cid"],
        locked: true,
      },
    };
    const stats = computeRoundStats(
      round(
        [
          { t: "draw", at: 1500 },
          { t: "side", at: 2500 },
          { t: "spin", at: 3000 },
          { t: "spin", at: 4000 },
          { t: "shroud", at: 4500, open: false },
          { t: "clue", at: 6000 },
          // Bob moves away from the target (0.5 → 0.2), then Cid fixes it.
          {
            t: "move",
            at: 6800,
            by: "bob",
            dialId: "shared",
            from: 0.5,
            to: 0.2,
          },
          { t: "accept", at: 7000, by: "bob", dialId: "shared" },
          { t: "unaccept", at: 7100, by: "bob", dialId: "shared" },
          {
            t: "move",
            at: 8000,
            by: "cid",
            dialId: "shared",
            from: 0.2,
            to: target + SEGMENT,
          },
          { t: "accept", at: 8500, by: "bob", dialId: "shared" },
          { t: "accept", at: 9000, by: "cid", dialId: "shared" },
          { t: "lock", at: 9000, dialId: "shared" },
          { t: "vote", at: 9500, by: "dee", side: "left" },
        ],
        dials,
      ),
      target,
      10_000,
    );
    expect(stats.durationMs).toBe(9000);
    expect(stats.drawMs).toBe(500);
    expect(stats.pickMs).toBe(1000);
    expect(stats.clueMs).toBe(2000); // from the last spin
    expect(stats.guessMs).toBe(3000);
    expect(stats.spins).toBe(2);
    expect(stats.peeks).toBe(1);
    expect(stats.clueLength).toBe(6);

    const bob = stats.players.bob!;
    expect(bob.moves).toBe(1);
    expect(bob.travel).toBeCloseTo(0.3);
    expect(bob.away).toBe(1);
    expect(bob.toward).toBe(0);
    expect(bob.pointsSwing).toBe(-4); // left the bullseye for nothing
    expect(bob.closest).toBeCloseTo(0.3);
    expect(bob.firstMoveMs).toBe(800);
    expect(bob.firstMover).toBe(true);
    expect(bob.finalMover).toBe(false);
    expect(bob.accepts).toBe(2);
    expect(bob.unaccepts).toBe(1);
    expect(bob.lastAccepter).toBe(false);

    const cid = stats.players.cid!;
    expect(cid.toward).toBe(1);
    expect(cid.pointsSwing).toBe(3);
    expect(cid.closest).toBeCloseTo(SEGMENT);
    expect(cid.finalMover).toBe(true);
    expect(cid.lastAccepter).toBe(true);
    expect(cid.firstMoveMs).toBe(2000);

    // The dial sits right of the target, so "left" was the correct call.
    expect(stats.players.dee!.vote).toBe("correct");
  });

  it("gives untouched dial owners a row and tolerates a bare log", () => {
    const stats = computeRoundStats(
      round([], {
        p1: {
          id: "p1",
          owners: ["bob"],
          position: 0.5,
          movedBy: null,
          accepts: [],
          locked: false,
        },
      }),
      target,
      5000,
    );
    expect(stats.players.bob).toMatchObject({
      moves: 0,
      closest: null,
      firstMoveMs: null,
    });
    expect(stats.drawMs).toBeNull();
    expect(stats.guessMs).toBeNull();
  });
});

function result(
  psychicId: string,
  wedge: 0 | 2 | 3 | 4,
  stats: Partial<RoundStats> & { players: RoundStats["players"] },
  clue = "x",
): RoundResult {
  return {
    roundIndex: 0,
    psychicId,
    psychicTeam: null,
    spectrum: { left: "a", right: "b" },
    clue,
    target,
    dials: {
      shared: { position: target + (4 - wedge) * SEGMENT, wedge, owners: [] },
    },
    vote: null,
    deltas: {},
    goAgain: false,
    psychicBonus: 0,
    gameOver: null,
    stats: {
      durationMs: 60_000,
      drawMs: null,
      pickMs: null,
      clueMs: 5000,
      guessMs: null,
      spins: 1,
      peeks: 0,
      clueLength: clue.length,
      ...stats,
    },
  };
}

const base = (over: Partial<RoundStats["players"][string]> = {}) => ({
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
  ...over,
});

describe("gameAwards / gameFacts", () => {
  const history: RoundResult[] = [
    result(
      "ann",
      4,
      {
        spins: 3,
        peeks: 2,
        players: {
          bob: base({
            moves: 4,
            travel: 0.8,
            toward: 3,
            away: 1,
            pointsSwing: 4,
            closest: 0.01,
            firstMoveMs: 900,
            firstMover: true,
            finalMover: true,
            accepts: 1,
            lastAccepter: true,
          }),
          cid: base({
            moves: 1,
            travel: 0.1,
            toward: 1,
            pointsSwing: 0,
            closest: 0.2,
            firstMoveMs: 4000,
            accepts: 2,
            unaccepts: 1,
          }),
        },
      },
      "a very long clue indeed",
    ),
    result(
      "bob",
      0,
      {
        clueMs: 1000,
        players: {
          ann: base({
            moves: 2,
            travel: 0.5,
            away: 2,
            pointsSwing: -2,
            closest: 0.3,
            firstMoveMs: 2000,
            firstMover: true,
            finalMover: true,
            accepts: 1,
          }),
          cid: base({
            moves: 1,
            travel: 0.05,
            toward: 1,
            closest: 0.25,
            firstMoveMs: 3000,
            accepts: 1,
            lastAccepter: true,
          }),
        },
      },
      "hm",
    ),
  ];

  it("aggregates totals per player in join order", () => {
    const totals = playerTotals(history, players);
    expect(totals.map((t) => t.id)).toEqual(["ann", "bob", "cid"]);
    const bob = totals[1]!;
    expect(bob.moves).toBe(4);
    expect(bob.psychicTurns).toBe(1);
    expect(bob.psychicPoints).toBe(0);
    expect(bob.clueMs).toBe(1000);
    const cid = totals[2]!;
    expect(cid.rounds).toBe(2);
    expect(cid.closest).toBeCloseTo(0.2);
    expect(cid.lastAccepts).toBe(1);
  });

  it("hands out awards only where the data supports them", () => {
    const awards = gameAwards(history, players, "coop");
    const by = Object.fromEntries(awards.map((a) => [a.id, a]));
    expect(by.sharpshooter!.playerId).toBe("bob");
    expect(by.sharpshooter!.value).toBe("2° off at best");
    expect(by.clutch!.playerId).toBe("bob");
    expect(by.saboteur!.playerId).toBe("ann");
    expect(by.wanderer!.playerId).toBe("ann");
    expect(by.fidget!.playerId).toBe("bob");
    expect(by.zen!.playerId).toBe("cid");
    expect(by.marathon!.playerId).toBe("bob");
    expect(by.quickdraw!.playerId).toBe("bob");
    expect(by.quickdraw!.value).toBe("moved 0.9 s after the clue");
    expect(by.lastword!.playerId).toBe("ann"); // tie with bob → earlier join
    expect(by.holdout).toBeUndefined(); // nobody locked it twice
    expect(by.secondthoughts!.playerId).toBe("cid");
    expect(by.mindreader!.playerId).toBe("ann");
    expect(by.deepthinker!.playerId).toBe("ann");
    expect(by.snap!.playerId).toBe("bob");
    expect(by.wordsmith!.playerId).toBe("ann");
    expect(by.minimalist!.playerId).toBe("bob");
    expect(by.spindoctor!.playerId).toBe("ann");
    expect(by.peeker!.playerId).toBe("ann");
    expect(by.oracle).toBeUndefined(); // not teams
    expect(by.hype).toBeUndefined(); // no reactions without a tally
    expect(gameAwards([], players, "ffa")).toEqual([]);
  });

  it("awards reactions and pokes from the tally", () => {
    const tally = {
      ann: { applause: 2, laugh: 1, poke: 3 },
      bob: { ghost: 1, poked: 2 },
      cid: { poked: 1 },
    };
    const awards = gameAwards(history, players, "coop", tally);
    const by = Object.fromEntries(awards.map((a) => [a.id, a]));
    expect(by.hype!.playerId).toBe("ann");
    expect(by.hype!.value).toBe("3 reactions");
    expect(by.pest!.playerId).toBe("ann");
    expect(by.punchingbag!.playerId).toBe("bob");
    const facts = gameFacts(history, players, tally);
    const f = Object.fromEntries(facts.map((x) => [x.id, x.value]));
    expect(f.reactions).toBe("4 sent · favourite 👏");
    expect(f.pokes).toBe("3");
  });

  it("summarises the game in facts", () => {
    const facts = gameFacts(history, players);
    const by = Object.fromEntries(facts.map((f) => [f.id, f.value]));
    expect(by.length).toBe("2 min over 2 turns");
    expect(by.travel).toBe("261° in 8 moves");
    expect(by.spins).toBe("4");
    expect(by.peeks).toBe("2");
    expect(by.bullseyes).toBe("1");
    expect(by.closestmiss).toBe("12° outside the wedge");
    expect(by.longest).toContain("ANN");
    expect(gameFacts([], players)).toEqual([]);
  });
});
