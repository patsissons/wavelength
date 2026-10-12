import { describe, expect, it } from "vitest";
import {
  isSeason,
  nthWeekday,
  seasonFor,
  tagline,
  thanksgivingWindow,
} from "./seasons";

const d = (iso: string) => new Date(`${iso}T12:00:00`);

describe("seasons", () => {
  it("follows the calendar", () => {
    expect(seasonFor(d("2026-10-11"))).toBe("thanksgiving");
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
    expect(seasonFor(d("2027-03-17"))).toBe("stpatricks");
    expect(seasonFor(d("2027-03-18"))).toBeNull();
    expect(seasonFor(d("2027-04-01"))).toBe("fools");
    expect(seasonFor(d("2027-04-02"))).toBeNull();
  });

  it("finds the n-th weekday of a month", () => {
    // November 2026 opens on a Sunday; October 2026 on a Thursday.
    expect(nthWeekday(2026, 10, 4, 4)).toBe(26);
    expect(nthWeekday(2026, 9, 1, 2)).toBe(12);
    expect(nthWeekday(2027, 10, 4, 4)).toBe(25);
    expect(nthWeekday(2027, 9, 1, 2)).toBe(11);
    expect(nthWeekday(2026, 10, 0, 1)).toBe(1);
  });

  it("keeps both Thanksgiving long weekends", () => {
    expect(thanksgivingWindow(2026)).toEqual({ us: [26, 29], ca: [10, 12] });
    expect(seasonFor(d("2026-11-25"))).toBeNull();
    expect(seasonFor(d("2026-11-26"))).toBe("thanksgiving");
    expect(seasonFor(d("2026-11-29"))).toBe("thanksgiving");
    expect(seasonFor(d("2026-11-30"))).toBeNull();
    expect(seasonFor(d("2026-10-09"))).toBeNull();
    expect(seasonFor(d("2026-10-10"))).toBe("thanksgiving");
    expect(seasonFor(d("2026-10-12"))).toBe("thanksgiving");
    expect(seasonFor(d("2026-10-13"))).toBeNull();
    expect(seasonFor(d("2027-11-25"))).toBe("thanksgiving");
    expect(seasonFor(d("2027-10-11"))).toBe("thanksgiving");
  });

  it("lets the console override it", () => {
    expect(seasonFor(d("2026-10-11"), "winter")).toBe("winter");
    expect(seasonFor(d("2026-12-25"), "fools")).toBe("fools");
    expect(isSeason("halloween")).toBe(true);
    expect(isSeason("stpatricks")).toBe(true);
    expect(isSeason("summer")).toBe(false);
  });

  it("adjusts the tagline", () => {
    expect(tagline(null)).toBe("Read your friends' minds.");
    expect(tagline("fools")).toContain("Results may vary");
    expect(tagline("halloween")).toContain("dare");
    expect(tagline("thanksgiving")).toContain("gravy");
    expect(tagline("stpatricks")).toContain("Sláinte");
    expect(tagline("winter")).toBe("Read your friends' minds.");
  });
});
