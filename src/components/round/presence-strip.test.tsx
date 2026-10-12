import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audio", () => ({ audio: { play: vi.fn() } }));

import { createGame } from "@shared/game/commands";
import { ConnectionContext } from "@/lib/connection-context";
import { eggBus, type EggEvent } from "@/lib/eggs/bus";
import { useEggs } from "@/lib/eggs/store";
import { useGameStore } from "@/lib/store";
import { PresenceStrip } from "./presence-strip";

describe("PresenceStrip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEggs.getState().reset();
  });
  afterEach(() => {
    vi.useRealTimers();
    useGameStore.getState().reset();
  });

  it("keeps your own pill tappable: five taps rain, a hold adopts a pet", () => {
    const { game } = createGame({
      code: "BCDF",
      hostId: "p1",
      hostName: "Ann",
      hostTokenHash: "h",
      now: 0,
    });
    const bob = { ...game.players.p1!, id: "p2", name: "Bob", order: 1 };
    const state = { ...game, players: { ...game.players, p2: bob } };
    useGameStore.getState().receive({
      type: "snapshot",
      state,
      you: { playerId: "p1", target: null },
    });
    const send = vi.fn(async () => ({ ok: true as const, version: 1 }));
    render(
      <ConnectionContext.Provider
        value={{ send, sendEphemeral: vi.fn(), reconnectNow: vi.fn() }}
      >
        <PresenceStrip game={state} playerId="p1" />
      </ConnectionContext.Provider>,
    );
    const seen: EggEvent[] = [];
    const off = eggBus.subscribe((e) => seen.push(e));

    const self = screen.getByTestId("self");
    expect(self).toBeEnabled();
    for (let i = 0; i < 5; i++) fireEvent.click(self);
    expect(seen).toContainEqual({
      kind: "rain",
      id: "avatar",
      glyphs: ["🌧️"],
      count: 20,
    });
    expect(send).not.toHaveBeenCalled();

    fireEvent.pointerDown(self, {
      clientX: 5,
      clientY: 5,
      isPrimary: true,
      button: 0,
    });
    vi.advanceTimersByTime(1100);
    fireEvent.pointerUp(self);
    fireEvent.click(self);
    expect(useEggs.getState().pet).toBe("🐈");

    // Everyone else is still a poke.
    fireEvent.click(screen.getByTestId("poke"));
    expect(send).toHaveBeenCalledWith({ type: "poke.send", playerId: "p2" });
    off();
  });
});
