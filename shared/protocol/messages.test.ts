import { describe, expect, it } from "vitest";
import { isCommand, parseClientMessage } from "./messages";

const cmdId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";

describe("parseClientMessage", () => {
  it("parses every command variant", () => {
    const messages = [
      { type: "resync" },
      { type: "dial.move", dialId: "shared", position: 0.25 },
      { type: "shroud.toggle", cmdId, open: true },
      { cmdId, type: "settings.update", patch: { mode: "coop", rounds: 5 } },
      { cmdId, type: "settings.update", patch: { guessSeconds: 60 } },
      { cmdId, type: "team.join", team: "left" },
      { cmdId, type: "player.rename", name: "  Pat " },
      { cmdId, type: "player.setAvatar", avatar: "dancing-unicorn" },
      { cmdId, type: "player.setAvatar", avatar: "🦄" },
      { cmdId, type: "player.setAvatar", avatar: null },
      { cmdId, type: "game.start" },
      { cmdId, type: "card.draw" },
      { cmdId, type: "card.pickSide", side: 1 },
      { cmdId, type: "spin.flick", velocity: -12.5 },
      { cmdId, type: "clue.submit", clue: "Pineapple pizza" },
      { cmdId, type: "dial.set", dialId: "shared", position: 1 },
      { cmdId, type: "dial.accept", dialId: "shared" },
      { cmdId, type: "dial.unaccept", dialId: "shared" },
      { cmdId, type: "vote.cast", side: "right" },
      { cmdId, type: "round.next" },
      { cmdId, type: "host.forceLock" },
      { cmdId, type: "host.skipRound" },
      { cmdId, type: "host.kick", playerId: "p2" },
      { cmdId, type: "host.transfer", playerId: "p2" },
      { cmdId, type: "host.endGame" },
      { cmdId, type: "game.playAgain" },
      { cmdId, type: "effect.send", effectId: "applause" },
      { cmdId, type: "poke.send", playerId: "p2" },
      { cmdId, type: "reaction.send", playerId: "p2", emoji: "🔥" },
    ];
    for (const message of messages) {
      const parsed = parseClientMessage(JSON.stringify(message));
      expect(parsed.ok, JSON.stringify(message)).toBe(true);
    }
  });

  it("trims names and clues", () => {
    const parsed = parseClientMessage(
      JSON.stringify({ cmdId, type: "player.rename", name: "  Pat " }),
    );
    expect(parsed.ok && parsed.message).toMatchObject({ name: "Pat" });
  });

  it("rejects malformed input", () => {
    const bad = [
      "not json",
      JSON.stringify({ type: "nope" }),
      JSON.stringify({ type: "dial.move", dialId: "shared", position: 1.5 }),
      JSON.stringify({ type: "game.start" }), // missing cmdId
      JSON.stringify({ cmdId, type: "clue.submit", clue: "   " }),
      JSON.stringify({ cmdId, type: "spin.flick", velocity: 1000 }),
      JSON.stringify({ cmdId, type: "player.setAvatar", avatar: "ab" }),
      JSON.stringify({ cmdId, type: "player.setAvatar", avatar: "🦄🦄" }),
      JSON.stringify({ cmdId, type: "player.setAvatar", avatar: "no-such" }),
      JSON.stringify({
        cmdId,
        type: "reaction.send",
        playerId: "p2",
        emoji: "🦄",
      }),
      JSON.stringify({
        cmdId,
        type: "settings.update",
        patch: { targetScore: 99 },
      }),
      JSON.stringify({
        cmdId,
        type: "settings.update",
        patch: { guessSeconds: 301 },
      }),
    ];
    for (const raw of bad) {
      expect(parseClientMessage(raw).ok, raw).toBe(false);
    }
  });

  it("distinguishes commands from ephemerals", () => {
    const cmd = parseClientMessage(
      JSON.stringify({ cmdId, type: "game.start" }),
    );
    const eph = parseClientMessage(
      JSON.stringify({ type: "dial.move", dialId: "shared", position: 0.5 }),
    );
    expect(cmd.ok && isCommand(cmd.message)).toBe(true);
    expect(eph.ok && isCommand(eph.message)).toBe(false);
    const arena = parseClientMessage(JSON.stringify({ type: "arena.open" }));
    expect(arena.ok && isCommand(arena.message)).toBe(false);
  });
});
