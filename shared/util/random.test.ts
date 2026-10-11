import { describe, expect, it } from "vitest";
import { mulberry32, seedFromString, shuffle } from "./random";
import { randomHex, ulid } from "./id";

describe("random", () => {
  it("is deterministic for a seed", () => {
    const a = mulberry32(seedFromString("e2e"));
    const b = mulberry32(seedFromString("e2e"));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays within [0, 1)", () => {
    const r = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("shuffles deterministically and keeps every element", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffle([...items], mulberry32(7));
    const b = shuffle([...items], mulberry32(7));
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(items);
    expect(a).not.toEqual(items);
  });
});

describe("ids", () => {
  it("generates sortable ulids of length 26", () => {
    const earlier = ulid(1_000_000);
    const later = ulid(2_000_000);
    expect(earlier).toHaveLength(26);
    expect(earlier < later).toBe(true);
    expect(ulid()).not.toEqual(ulid());
  });

  it("generates hex tokens of the requested size", () => {
    expect(randomHex(32)).toMatch(/^[0-9a-f]{64}$/);
  });
});
