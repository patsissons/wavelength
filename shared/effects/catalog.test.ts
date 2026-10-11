import { describe, expect, it } from "vitest";
import { createGame } from "../game/commands";
import { EFFECTS, canSendEffect, effectById, effectsFor } from "./catalog";

describe("effects catalog", () => {
  it("has unique ids and a role for every effect", () => {
    expect(new Set(EFFECTS.map((e) => e.id)).size).toBe(EFFECTS.length);
    for (const e of EFFECTS) expect(e.roles.length).toBeGreaterThan(0);
  });

  it("gives each role its own set plus the shared ones", () => {
    const psychic = effectsFor("psychic").map((e) => e.id);
    const guesser = effectsFor("guesser").map((e) => e.id);
    expect(psychic).toContain("drumroll");
    expect(psychic).not.toContain("panic");
    expect(guesser).toContain("panic");
    expect(guesser).not.toContain("drumroll");
    expect(psychic).toContain("applause");
    expect(guesser).toContain("applause");
    expect(effectsFor("spectator").map((e) => e.id)).toContain("crickets");
  });

  it("authorises by role, existence and the effects setting", () => {
    const { game } = createGame({
      code: "BCDF",
      hostId: "p1",
      hostName: "Ann",
      hostTokenHash: "h",
      now: 0,
    });
    expect(canSendEffect(game, "p1", "applause")).toBe(true);
    expect(canSendEffect(game, "p1", "drumroll")).toBe(false); // no round
    expect(canSendEffect(game, "p1", "nope")).toBe(false);
    expect(
      canSendEffect(
        { ...game, settings: { ...game.settings, effects: false } },
        "p1",
        "applause",
      ),
    ).toBe(false);
    expect(effectById("heart")?.icon).toBe("❤️");
  });
});
