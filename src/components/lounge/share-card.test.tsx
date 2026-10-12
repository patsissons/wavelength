import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { play } = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock("@/lib/audio", () => ({
  audio: { play, setLoop: vi.fn(), ready: true, loop: null },
  soundNames: () => ({ patches: ["ding"], loops: ["lounge"] }),
}));

import { eggBus, type EggEvent } from "@/lib/eggs/bus";
import { ShareCard, ShareStrip } from "./share-card";

describe("ShareCard", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("mirrors a palindromic code", () => {
    const { rerender } = render(<ShareCard code="BCDF" />);
    expect(screen.getByTestId("game-code")).toHaveTextContent("BCDF");
    expect(screen.queryByTestId("egg-palindrome")).toBeNull();
    rerender(<ShareCard code="BCCB" />);
    expect(screen.getByTestId("egg-palindrome")).toHaveTextContent("🪞");
  });

  it("opens the easter-egg cheat sheet after five quick taps on the QR code", () => {
    render(<ShareStrip code="BCDF" />);
    const qr = screen.getByTestId("qr-code");
    for (let i = 0; i < 4; i++) fireEvent.click(qr);
    expect(screen.queryByTestId("egg-cheatsheet")).toBeNull();
    fireEvent.click(qr);
    expect(screen.getByTestId("egg-cheatsheet")).toBeInTheDocument();
    expect(screen.getByTestId("egg-list")).toHaveTextContent("Konami code");
  });

  it("sends the code down the warp pipe on a hold", () => {
    render(<ShareCard code="BCDF" />);
    const seen: EggEvent[] = [];
    const off = eggBus.subscribe((e) => seen.push(e));
    const code = screen.getByTestId("game-code");
    fireEvent.pointerDown(code, {
      clientX: 5,
      clientY: 5,
      isPrimary: true,
      button: 0,
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    fireEvent.pointerUp(code);
    expect(code).toHaveAttribute("data-egg-warp");
    expect(seen).toContainEqual({
      kind: "chip",
      id: "warp",
      text: "🟢 Welcome to Warp Zone!",
    });
    expect(play).toHaveBeenCalledWith("warp");
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(code).not.toHaveAttribute("data-egg-warp");
    off();
  });
});
