import { describe, expect, it } from "vitest";
import { isSeason, seasonFor, tagline } from "./seasons";

const d = (iso: string) => new Date(`${iso}T12:00:00`);

describe("seasons", () => {
  it("follows the calendar", () => {
    expect(seasonFor(d("2026-10-11"))).toBeNull();
    expect(seasonFor(d("2026-10-24"))).toBeNull();
    expect(seasonFor(d("2026-10-25"))).toBe("halloween");
    expect(seasonFor(d("2026-10-31"))).toBe("halloween");
    expect(seasonFor(d("2026-11-01"))).toBeNull();
    expect(seasonFor(d("2026-12-19"))).toBeNull();
    expect(seasonFor(d("2026-12-20"))).toBe("winter");
    expect(seasonFor(d("2026-12-30"))).toBe("winter");
    expect(seasonFor(d("2026-12-31"))).toBe("newyear");
    expect(seasonFor(d("2027-01-01"))).toBe("newyear");
    expect(seasonFor(d("2027-01-02"))).toBeNull();
    expect(seasonFor(d("2027-04-01"))).toBe("fools");
    expect(seasonFor(d("2027-04-02"))).toBeNull();
  });

  it("lets the console override it", () => {
    expect(seasonFor(d("2026-10-11"), "winter")).toBe("winter");
    expect(seasonFor(d("2026-12-25"), "fools")).toBe("fools");
    expect(isSeason("halloween")).toBe(true);
    expect(isSeason("summer")).toBe(false);
  });

  it("adjusts the tagline", () => {
    expect(tagline(null)).toBe("Read your friends' minds.");
    expect(tagline("fools")).toContain("Results may vary");
    expect(tagline("halloween")).toContain("dare");
    expect(tagline("winter")).toBe("Read your friends' minds.");
  });
});
