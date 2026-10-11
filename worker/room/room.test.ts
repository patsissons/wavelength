import { describe, expect, it } from "vitest";
import { mulberry32 } from "@shared/util/random";
import { DEFAULT_SETTINGS, type GameState } from "@shared/game/types";
import { nextAlarmAt, ROOM_TTL_MS } from "./alarms";
import { sha256Hex, verifyToken } from "./auth";
import { generateCode, isValidCode, normalizeCode } from "./codes";
import { TokenBucket } from "./rate-limit";

describe("codes", () => {
  it("generates four-letter codes from the safe alphabet", () => {
    const random = mulberry32(5);
    for (let i = 0; i < 50; i++) {
      const code = generateCode(random);
      expect(code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
      expect(isValidCode(code)).toBe(true);
    }
  });

  it("normalizes user input", () => {
    expect(normalizeCode(" b-c d\nf ")).toBe("BCDF");
    expect(normalizeCode("aeiou")).toBe("");
    expect(normalizeCode("bcdfgh")).toBe("BCDF");
    expect(isValidCode("bcdf")).toBe(false);
  });
});

describe("auth", () => {
  it("hashes and verifies tokens", async () => {
    const hash = await sha256Hex("secret");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    const tokens = { p1: hash };
    expect(await verifyToken(tokens, "p1", "secret")).toBe(true);
    expect(await verifyToken(tokens, "p1", "nope")).toBe(false);
    expect(await verifyToken(tokens, "p2", "secret")).toBe(false);
    expect(await verifyToken(tokens, null, "secret")).toBe(false);
  });
});

describe("TokenBucket", () => {
  it("allows a burst then refills over time", () => {
    const bucket = new TokenBucket(3, 1 / 1000, 0);
    expect(bucket.take(0)).toBe(true);
    expect(bucket.take(0)).toBe(true);
    expect(bucket.take(0)).toBe(true);
    expect(bucket.take(0)).toBe(false);
    expect(bucket.take(500)).toBe(false);
    expect(bucket.take(1000)).toBe(true);
    expect(bucket.take(1000)).toBe(false);
    expect(bucket.take(10_000)).toBe(true);
  });
});

describe("nextAlarmAt", () => {
  const base: GameState = {
    protocolVersion: 1,
    version: 0,
    code: "BCDF",
    hostId: "p1",
    phase: "lobby",
    settings: DEFAULT_SETTINGS,
    players: {},
    activeTeam: null,
    psychicCursor: { left: -1, right: -1, all: -1 },
    psychicStart: { left: -1, right: -1, all: -1 },
    effectTally: {},
    scores: {},
    round: null,
    roundsPlayed: 0,
    history: [],
    suddenDeath: false,
    gameOver: null,
    deckRemaining: 0,
    createdAt: 0,
  };
  const player = (id: string, disconnectedAt: number | null, away = false) => ({
    id,
    name: id,
    color: 0,
    avatar: null,
    team: null,
    order: 0,
    connected: disconnectedAt === null,
    away,
    disconnectedAt,
  });

  it("uses the room TTL when nobody is disconnected", () => {
    const game = { ...base, players: { p1: player("p1", null) } };
    expect(nextAlarmAt(game, 1000, 60_000)).toBe(1000 + ROOM_TTL_MS);
  });

  it("wakes at the earliest grace expiry, ignoring players already away", () => {
    const game = {
      ...base,
      players: {
        p1: player("p1", 5000),
        p2: player("p2", 2000),
        p3: player("p3", 100, true),
      },
    };
    expect(nextAlarmAt(game, 1000, 3000)).toBe(5000);
  });
});
