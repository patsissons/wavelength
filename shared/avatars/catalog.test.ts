import { describe, expect, it } from "vitest";
import {
  AVATARS,
  avatarById,
  graphemeCount,
  isEmojiAvatar,
  isValidAvatar,
} from "./catalog";

describe("avatar catalog", () => {
  it("has about 32 unique, well-formed characters", () => {
    expect(AVATARS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(AVATARS.length);
    for (const a of AVATARS) {
      expect(a.id).toMatch(/^[a-z-]+$/);
      expect(a.label.length).toBeGreaterThan(0);
      expect(isEmojiAvatar(a.base), a.id).toBe(true);
      if (a.prop) {
        expect(isEmojiAvatar(a.prop), a.id).toBe(true);
        expect(a.anchor, a.id).toBeDefined();
        expect(a.propAnim, a.id).toBeDefined();
      }
    }
    expect(avatarById("dancing-unicorn")?.base).toBe("🦄");
    expect(avatarById("nope")).toBeUndefined();
  });

  it("counts graphemes, not code units", () => {
    expect(graphemeCount("🦄")).toBe(1);
    expect(graphemeCount("👩‍🚀")).toBe(1);
    expect(graphemeCount("👍🏽")).toBe(1);
    expect(graphemeCount("🇨🇦")).toBe(1);
    expect(graphemeCount("ab")).toBe(2);
    expect(graphemeCount("🦄🦄")).toBe(2);
  });

  it("accepts one emoji or a catalog id and nothing else", () => {
    for (const ok of ["🦄", "👩‍🚀", "👍🏽", "🇨🇦", "❤️", "dancing-unicorn"]) {
      expect(isValidAvatar(ok), ok).toBe(true);
    }
    for (const bad of ["", "a", "ab", "🦄🦄", "🦄 ", "no-such-avatar", "1"]) {
      expect(isValidAvatar(bad), bad).toBe(false);
    }
  });
});
