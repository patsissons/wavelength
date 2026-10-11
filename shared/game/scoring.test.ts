import { describe, expect, it } from "vitest";
import { SEGMENT } from "./geometry";
import {
  coopLabel,
  initialTeamsScores,
  ranking,
  scoreFfaRound,
  scoreTeamsTurn,
  sideOfTarget,
  tallyVotes,
  wedgeScore,
} from "./scoring";

describe("wedgeScore", () => {
  const target = 0.5;
  it.each([
    [0, 4],
    [0.5, 4],
    [0.5001, 3],
    [1.5, 3],
    [1.5001, 2],
    [2.5, 2],
    [2.5001, 0],
    [10, 0],
  ])("%s segments away scores %s", (segments, expected) => {
    expect(wedgeScore(target + segments * SEGMENT, target)).toBe(expected);
    expect(wedgeScore(target - segments * SEGMENT, target)).toBe(expected);
  });
});

describe("sideOfTarget / tallyVotes", () => {
  it("reports where the target is relative to the dial", () => {
    expect(sideOfTarget(0.6, 0.4)).toBe("left");
    expect(sideOfTarget(0.4, 0.6)).toBe("right");
    expect(sideOfTarget(0.5, 0.5)).toBeNull();
  });

  it("finds a majority and treats ties as none", () => {
    expect(tallyVotes({ a: "left", b: "left", c: "right" })).toEqual({
      left: 2,
      right: 1,
      majority: "left",
    });
    expect(tallyVotes({ a: "left", b: "right" }).majority).toBeNull();
    expect(tallyVotes({}).majority).toBeNull();
  });
});

describe("scoreTeamsTurn", () => {
  const base = {
    scores: { left: 3, right: 3 },
    psychicTeam: "left" as const,
    target: 0.5,
    targetScore: 10,
    catchUp: true,
    suddenDeath: false,
  };

  it("awards the wedge and a correct left/right bonus", () => {
    const out = scoreTeamsTurn({
      ...base,
      guess: 0.5 + 2 * SEGMENT, // 2 points, target is left of the dial
      votes: { r1: "left", r2: "left", r3: "right" },
    });
    expect(out.wedge).toBe(2);
    expect(out.vote.bonusTo).toBe("right");
    expect(out.scores).toEqual({ left: 5, right: 4 });
    expect(out.deltas).toEqual({ left: 2, right: 1 });
  });

  it("awards the bonus even on a miss", () => {
    const out = scoreTeamsTurn({
      ...base,
      guess: 0.9,
      votes: { r1: "left" },
    });
    expect(out.wedge).toBe(0);
    expect(out.scores).toEqual({ left: 3, right: 4 });
  });

  it("suppresses the bonus on a bullseye", () => {
    const out = scoreTeamsTurn({
      ...base,
      guess: 0.5 + 0.2 * SEGMENT,
      votes: { r1: "left", r2: "left" },
    });
    expect(out.wedge).toBe(4);
    expect(out.vote.bonusTo).toBeNull();
    expect(out.scores).toEqual({ left: 7, right: 3 });
  });

  it("gives no bonus on a tied vote or a wrong majority", () => {
    const tied = scoreTeamsTurn({
      ...base,
      guess: 0.6,
      votes: { r1: "left", r2: "right" },
    });
    expect(tied.vote.bonusTo).toBeNull();
    const wrong = scoreTeamsTurn({
      ...base,
      guess: 0.6,
      votes: { r1: "right" },
    });
    expect(wrong.vote.bonusTo).toBeNull();
  });

  it("applies catch-up only when still behind after a 4", () => {
    const behind = scoreTeamsTurn({
      ...base,
      scores: { left: 0, right: 6 },
      guess: 0.5,
      votes: {},
    });
    expect(behind.goAgain).toBe(true);
    const level = scoreTeamsTurn({
      ...base,
      scores: { left: 2, right: 6 },
      guess: 0.5,
      votes: {},
    });
    expect(level.goAgain).toBe(false);
    const disabled = scoreTeamsTurn({
      ...base,
      catchUp: false,
      scores: { left: 0, right: 6 },
      guess: 0.5,
      votes: {},
    });
    expect(disabled.goAgain).toBe(false);
  });

  it("ends the game at the target score with a lead", () => {
    const out = scoreTeamsTurn({
      ...base,
      scores: { left: 7, right: 5 },
      guess: 0.5,
      votes: {},
    });
    expect(out.gameOver).toBe(true);
    expect(out.winner).toBe("left");
  });

  it("goes to sudden death on a tie and resolves on the next lead", () => {
    const tie = scoreTeamsTurn({
      ...base,
      scores: { left: 8, right: 10 },
      guess: 0.5 + SEGMENT, // 3 points → 11 vs 10? no: 8+3 = 11
      votes: {},
    });
    expect(tie.gameOver).toBe(true);
    const realTie = scoreTeamsTurn({
      ...base,
      scores: { left: 7, right: 10 },
      guess: 0.5 + SEGMENT, // 3 → 10 vs 10
      votes: {},
    });
    expect(realTie.gameOver).toBe(false);
    expect(realTie.suddenDeath).toBe(true);
    const next = scoreTeamsTurn({
      ...base,
      psychicTeam: "right",
      scores: realTie.scores,
      suddenDeath: true,
      guess: 0.5 + 2 * SEGMENT, // 2 → 12 vs 10
      votes: {},
    });
    expect(next.gameOver).toBe(true);
    expect(next.winner).toBe("right");
    const scoreless = scoreTeamsTurn({
      ...base,
      scores: { left: 10, right: 10 },
      suddenDeath: true,
      guess: 0.9,
      votes: {},
    });
    expect(scoreless.gameOver).toBe(false);
    expect(scoreless.suddenDeath).toBe(true);
  });

  it("starts the second team on 1", () => {
    expect(initialTeamsScores("left")).toEqual({ left: 0, right: 1 });
    expect(initialTeamsScores("right")).toEqual({ left: 1, right: 0 });
  });
});

describe("co-op", () => {
  it("labels totals relative to the maximum", () => {
    expect(coopLabel(0, 7)).toBe("Are you even on the same planet?");
    expect(coopLabel(28, 7)).toBe("Galaxy brain");
    expect(coopLabel(14, 7)).toBe("Tuned in");
    expect(coopLabel(8, 2)).toBe("Galaxy brain");
  });
});

describe("free-for-all", () => {
  it("scores each guesser and averages for the psychic", () => {
    const deltas = scoreFfaRound(
      { a: 0.5, b: 0.5 + 2 * SEGMENT, c: 0.9 },
      0.5,
      "psy",
      "average",
    );
    expect(deltas).toEqual({ a: 4, b: 2, c: 0, psy: 2 });
    expect(scoreFfaRound({ a: 0.5 }, 0.5, "psy", "none").psy).toBe(0);
  });

  it("ranks with shared ranks for ties", () => {
    expect(ranking({ a: 5, b: 9, c: 5, d: 1 })).toEqual([
      { id: "b", score: 9, rank: 1 },
      { id: "a", score: 5, rank: 2 },
      { id: "c", score: 5, rank: 2 },
      { id: "d", score: 1, rank: 4 },
    ]);
  });
});
