import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoFor, loungeLoop, toggleDisco } from "./disco";
import { useEggs } from "./store";

describe("disco", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEggs.getState().reset();
  });
  afterEach(() => vi.useRealTimers());

  it("picks the record for the lounge", () => {
    const base = { unlocked: true, muted: false, music: true, disco: false };
    expect(loungeLoop(base)).toBe("lounge");
    expect(loungeLoop({ ...base, disco: true })).toBe("disco");
    expect(loungeLoop({ ...base, muted: true, disco: true })).toBeNull();
    expect(loungeLoop({ ...base, music: false })).toBeNull();
    expect(loungeLoop({ ...base, unlocked: false })).toBeNull();
  });

  it("toggles, and a timed drop restores the previous state", () => {
    expect(toggleDisco()).toBe(true);
    expect(toggleDisco()).toBe(false);
    discoFor(1000);
    expect(useEggs.getState().disco).toBe(true);
    vi.advanceTimersByTime(600);
    discoFor(1000); // extends
    vi.advanceTimersByTime(600);
    expect(useEggs.getState().disco).toBe(true);
    vi.advanceTimersByTime(500);
    expect(useEggs.getState().disco).toBe(false);

    toggleDisco();
    discoFor(100);
    vi.advanceTimersByTime(150);
    expect(useEggs.getState().disco).toBe(true); // it was on before the drop
  });
});
