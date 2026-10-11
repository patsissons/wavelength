import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGame, joinGame } from "@shared/game/commands";
import { applyEvents } from "@shared/game/reducer";
import { useArena } from "@/lib/arena";
import { effectBus } from "@/lib/effect-bus";
import { useGameStore } from "@/lib/store";
import { arenaLayout } from "./aim";
import { Arena } from "./arena";

const send = vi.fn(async () => ({ ok: true as const, version: 1 }));
vi.mock("@/lib/use-game-connection", () => ({
  useCommand: () => send,
}));

function seed() {
  let state = createGame({
    code: "BCDF",
    hostId: "p1",
    hostName: "Ann",
    hostTokenHash: "h",
    now: 0,
  });
  for (const [id, name] of [
    ["p2", "Bob"],
    ["p3", "Cid"],
  ] as const) {
    const joined = joinGame(state, { playerId: id, name, tokenHash: id });
    if (!joined.ok) throw new Error(joined.message);
    state = { ...state, game: applyEvents(state.game, joined.events) };
  }
  useGameStore.setState({
    game: { ...state.game, phase: "reveal" },
    you: { playerId: "p2", target: null },
  });
}

/** jsdom has no layout: the arena falls back to its default 360×560 body. */
const layout = arenaLayout(360, 560, 2);

describe("Arena", () => {
  beforeEach(() => {
    send.mockClear();
    useArena.setState({ open: true });
    seed();
  });

  it("seats the others on the arc and you at the centre", () => {
    render(<Arena />);
    const nodes = screen.getAllByTestId("arena-player");
    expect(nodes.map((n) => n.dataset.playerName)).toEqual(["Ann", "Cid"]);
    const at = (el: HTMLElement) => ({
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
    });
    expect(at(nodes[0]!).x).toBeCloseTo(layout.points[0]!.x, 1);
    expect(at(nodes[0]!).y).toBeCloseTo(layout.points[0]!.y, 1);
    expect(at(screen.getByTestId("arena-you")).x).toBeCloseTo(layout.cx, 1);
    expect(at(screen.getByTestId("arena-you")).y).toBeCloseTo(layout.cy, 1);
    // Both are the same distance from you.
    const d = layout.points.map((p) =>
      Math.hypot(p.x - layout.cx, p.y - layout.cy),
    );
    expect(d[0]).toBeCloseTo(d[1]!, 5);
  });

  it("sends a reaction when an emoji is dropped on a player", () => {
    render(<Arena />);
    const fire = screen.getByTestId("arena-emoji-🔥");
    const cid = layout.points[1]!;
    fireEvent.pointerDown(fire, {
      pointerId: 1,
      isPrimary: true,
      clientX: 180,
      clientY: 520,
    });
    expect(screen.getByTestId("arena-drag")).toHaveTextContent("🔥");
    fireEvent.pointerMove(fire, {
      pointerId: 1,
      clientX: cid.x,
      clientY: cid.y,
    });
    fireEvent.pointerUp(fire, { pointerId: 1, clientX: cid.x, clientY: cid.y });
    expect(screen.queryByTestId("arena-drag")).toBeNull();
    expect(send).toHaveBeenCalledWith({
      type: "reaction.send",
      playerId: "p3",
      emoji: "🔥",
    });
  });

  it("drops a release that hits nobody", () => {
    render(<Arena />);
    const fire = screen.getByTestId("arena-emoji-👏");
    fireEvent.pointerDown(fire, {
      pointerId: 2,
      isPrimary: true,
      clientX: 180,
      clientY: 520,
    });
    fireEvent.pointerUp(fire, { pointerId: 2, clientX: 182, clientY: 518 });
    expect(send).not.toHaveBeenCalled();
  });

  it("shows who threw what at you", () => {
    vi.useFakeTimers();
    render(<Arena />);
    act(() => {
      effectBus.emit({
        kind: "reaction",
        from: "p3",
        to: "p2",
        emoji: "💩",
        nonce: "n1",
      });
    });
    expect(screen.getByTestId("arena-hit")).toHaveTextContent(
      "Cid threw 💩 at you",
    );
    expect(screen.getByTestId("arena")).toHaveAttribute(
      "data-last-reaction",
      "💩",
    );
    // Reactions aimed at someone else fly past without a caption.
    act(() => {
      vi.advanceTimersByTime(2000);
      effectBus.emit({
        kind: "reaction",
        from: "p3",
        to: "p1",
        emoji: "🏆",
        nonce: "n2",
      });
    });
    expect(screen.queryByTestId("arena-hit")).toBeNull();
    vi.useRealTimers();
  });

  it("closes back to the results", () => {
    render(<Arena />);
    fireEvent.click(screen.getByTestId("close-arena"));
    expect(useArena.getState().open).toBe(false);
  });
});
