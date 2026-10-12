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

  it("gives every reaction a sound and offers the unicorn and ghost to all", () => {
    expect(effectById("laugh")?.sound).toBe("laugh");
    expect(effectById("thinking")?.sound).toBe("hmm");
    for (const id of ["unicorn", "ghost"]) {
      expect(effectById(id)?.roles).toEqual(["any"]);
      expect(effectById(id)?.sound).toBeDefined();
    }
  });

  it("lets every role hurry the room along", () => {
    const hurry = effectById("hurry");
    expect(hurry?.roles).toEqual(["any"]);
    expect(hurry?.sound).toBe("ticktock");
    expect(hurry?.caption).toBe("is waiting…");
    for (const role of [
      "psychic",
      "guesser",
      "opponent",
      "spectator",
    ] as const) {
      expect(effectsFor(role).map((e) => e.id)).toContain("hurry");
    }
  });

  it("keeps easter-egg effects off the bar but lets anyone send them", () => {
    const konami = effectById("konami");
    expect(konami?.hidden).toBe(true);
    expect(konami?.roles).toEqual(["any"]);
    expect(konami?.caption).toBe("knows the code");
    for (const role of [
      "psychic",
      "guesser",
      "opponent",
      "spectator",
    ] as const) {
      expect(effectsFor(role).map((e) => e.id)).not.toContain("konami");
    }
    const { game } = createGame({
      code: "BCDF",
      hostId: "p1",
      hostName: "Ann",
      hostTokenHash: "h",
      now: 0,
    });
    expect(canSendEffect(game, "p1", "konami")).toBe(true);
  });

  it("carries magic clues as hidden psychic-only effects", () => {
    const banana = effectById("clue:banana");
    expect(banana?.hidden).toBe(true);
    expect(banana?.roles).toEqual(["psychic"]);
    expect(banana?.icon).toBe("🍌");
    expect(banana?.burst).toBeUndefined();
    expect(banana?.sound).toBeUndefined();
    for (const role of ["psychic", "guesser", "spectator"] as const) {
      expect(effectsFor(role).map((e) => e.id)).not.toContain("clue:banana");
    }
    const { game } = createGame({
      code: "BCDF",
      hostId: "p1",
      hostName: "Ann",
      hostTokenHash: "h",
      now: 0,
    });
    expect(canSendEffect(game, "p1", "clue:banana")).toBe(false); // no round
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
