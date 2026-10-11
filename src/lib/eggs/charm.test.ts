import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PATIENCE_AFTER_MS,
  PATIENCE_EVERY_MS,
  QUIPS,
  TapCounter,
  isPalindrome,
  patienceQuip,
  usePatience,
} from "./charm";

describe("charm", () => {
  it("spots palindromic codes", () => {
    expect(isPalindrome("BCCB")).toBe(true);
    expect(isPalindrome("gxxg")).toBe(true);
    expect(isPalindrome("BCDF")).toBe(false);
    expect(isPalindrome("B")).toBe(false);
    expect(isPalindrome("")).toBe(false);
  });

  it("counts quick taps inside the window", () => {
    const taps = new TapCounter(3, 1000);
    expect(taps.push(0)).toBe(false);
    expect(taps.push(400)).toBe(false);
    expect(taps.push(1500)).toBe(false); // the earlier taps aged out
    expect(taps.push(1600)).toBe(false);
    expect(taps.push(1700)).toBe(true);
    expect(taps.push(1800)).toBe(false); // it re-arms
    expect(QUIPS.length).toBeGreaterThan(3);
  });

  it("editorialises once the wait drags on", () => {
    expect(patienceQuip(0, "Ann")).toBeNull();
    expect(patienceQuip(PATIENCE_AFTER_MS - 1, "Ann")).toBeNull();
    expect(patienceQuip(PATIENCE_AFTER_MS, "Ann")).toBe("Still waiting…");
    expect(patienceQuip(PATIENCE_AFTER_MS + PATIENCE_EVERY_MS, "Ann")).toBe(
      "Ann is probably getting snacks.",
    );
    const far = PATIENCE_AFTER_MS + PATIENCE_EVERY_MS * 6;
    expect(patienceQuip(far, "Ann")).toBe("Still waiting…"); // wraps
  });

  describe("usePatience", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("ticks from mount", () => {
      const { result, unmount } = renderHook(() => usePatience("Ann"));
      expect(result.current).toBeNull();
      act(() => {
        vi.advanceTimersByTime(PATIENCE_AFTER_MS + 5000);
      });
      expect(result.current).toBe("Still waiting…");
      act(() => {
        vi.advanceTimersByTime(PATIENCE_EVERY_MS);
      });
      expect(result.current).toContain("snacks");
      unmount();
    });
  });
});
