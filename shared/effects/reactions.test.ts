import { describe, expect, it } from "vitest";
import { createGame } from "../game/commands";
import {
  REACTIONS,
  canReact,
  isReaction,
  reactionEffectId,
  reactionEmoji,
} from "./reactions";

describe("reactions", () => {
  it("lists unique emoji and recognises them", () => {
    expect(REACTIONS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(REACTIONS).size).toBe(REACTIONS.length);
    expect(isReaction("🔥")).toBe(true);
    expect(isReaction("🦄")).toBe(false);
  });

  it("round-trips the tally id", () => {
    expect(reactionEffectId("👏")).toBe("reaction:👏");
    expect(reactionEmoji("reaction:👏")).toBe("👏");
    expect(reactionEmoji("applause")).toBeNull();
  });

  it("is open after the reveal and at game over, with effects on", () => {
    const { game } = createGame({
      code: "BCDF",
      hostId: "p1",
      hostName: "Ann",
      hostTokenHash: "h",
      now: 0,
    });
    expect(canReact(game)).toBe(false);
    expect(canReact({ ...game, phase: "reveal" })).toBe(true);
    expect(canReact({ ...game, phase: "gameover" })).toBe(true);
    expect(canReact({ ...game, phase: "guessing" })).toBe(false);
    expect(
      canReact({
        ...game,
        phase: "reveal",
        settings: { ...game.settings, effects: false },
      }),
    ).toBe(false);
  });
});
