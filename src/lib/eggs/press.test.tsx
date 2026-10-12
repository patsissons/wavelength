import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoldDetector, useLongPress } from "./press";

describe("HoldDetector", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires after the hold time, once, and tells the click to stand down", () => {
    const onHold = vi.fn();
    const d = new HoldDetector(500, onHold);
    d.down(10, 10);
    vi.advanceTimersByTime(499);
    expect(onHold).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(d.up()).toBe(true);
    expect(d.consume()).toBe(true);
    expect(d.consume()).toBe(false); // only the one click is swallowed
  });

  it("gives up when the pointer lifts early or drifts", () => {
    const onHold = vi.fn();
    const d = new HoldDetector(500, onHold);
    d.down(10, 10);
    vi.advanceTimersByTime(300);
    expect(d.up()).toBe(false);
    vi.advanceTimersByTime(300);
    expect(onHold).not.toHaveBeenCalled();

    d.down(10, 10);
    d.move(14, 14); // within the slop
    vi.advanceTimersByTime(300);
    d.move(40, 10); // a scroll
    vi.advanceTimersByTime(300);
    expect(onHold).not.toHaveBeenCalled();
    expect(d.consume()).toBe(false);
  });
});

function Target({ onHold, onTap }: { onHold: () => void; onTap?: () => void }) {
  const press = useLongPress(400, onHold, { onTap });
  return (
    <button type="button" {...press}>
      hold me
    </button>
  );
}

describe("useLongPress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("calls onHold for a hold and onTap for a tap, never both", () => {
    const onHold = vi.fn();
    const onTap = vi.fn();
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <Target onHold={onHold} onTap={onTap} />
      </div>,
    );
    const button = screen.getByRole("button");
    const down = { clientX: 5, clientY: 5, isPrimary: true, button: 0 };

    fireEvent.pointerDown(button, down);
    vi.advanceTimersByTime(450);
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
    expect(parentClick).not.toHaveBeenCalled();

    fireEvent.pointerDown(button, down);
    vi.advanceTimersByTime(100);
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    expect(onHold).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(parentClick).toHaveBeenCalledTimes(1);

    // A second finger or a right button is not a press.
    fireEvent.pointerDown(button, { ...down, isPrimary: false });
    vi.advanceTimersByTime(450);
    expect(onHold).toHaveBeenCalledTimes(1);
  });
});
