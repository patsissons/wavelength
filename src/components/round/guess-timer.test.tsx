import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "@/lib/store";
import { formatRemaining, formatTimer } from "@/lib/time";
import { GuessTimer } from "./guess-timer";

describe("formatRemaining", () => {
  it("rounds up to whole seconds as m:ss", () => {
    expect(formatRemaining(90_000)).toBe("1:30");
    expect(formatRemaining(9_400)).toBe("0:10");
    expect(formatRemaining(0)).toBe("0:00");
    expect(formatRemaining(-500)).toBe("0:00");
  });
});

describe("formatTimer", () => {
  it("labels the setting compactly", () => {
    expect(formatTimer(0)).toBe("Off");
    expect(formatTimer(45)).toBe("45s");
    expect(formatTimer(60)).toBe("1m");
    expect(formatTimer(90)).toBe("1:30");
    expect(formatTimer(180)).toBe("3m");
  });
});

describe("GuessTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    useGameStore.setState({ clockSkew: 0 });
  });
  afterEach(() => vi.useRealTimers());

  it("counts down from the deadline and turns urgent in the last ten seconds", () => {
    render(<GuessTimer deadline={100_000 + 30_000} totalSeconds={30} />);
    const timer = screen.getByTestId("guess-timer");
    expect(timer).toHaveTextContent("0:30");
    expect(timer).not.toHaveAttribute("data-urgent");
    act(() => vi.advanceTimersByTime(21_000));
    expect(timer).toHaveTextContent("0:09");
    expect(timer).toHaveAttribute("data-urgent", "true");
    act(() => vi.advanceTimersByTime(15_000));
    expect(timer).toHaveTextContent("0:00");
  });

  it("corrects for the clock skew measured against the server", () => {
    // The server is 5 s ahead of this device: 30 s on the server clock
    // means 30 s here too, not 35.
    useGameStore.setState({ clockSkew: 5_000 });
    render(<GuessTimer deadline={105_000 + 30_000} totalSeconds={30} />);
    expect(screen.getByTestId("guess-timer")).toHaveTextContent("0:30");
  });
});
