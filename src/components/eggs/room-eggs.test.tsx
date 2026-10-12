import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/audio", () => ({ audio: { play: vi.fn() } }));

import { ConnectionContext } from "@/lib/connection-context";
import { eggBus, type EggEvent } from "@/lib/eggs/bus";
import { RoomEggs } from "./room-eggs";

function mount(send: (...args: never[]) => Promise<unknown>) {
  render(
    <ConnectionContext.Provider
      value={{
        send: send as never,
        sendEphemeral: vi.fn(),
        reconnectNow: vi.fn(),
      }}
    >
      <RoomEggs />
    </ConnectionContext.Provider>,
  );
}

describe("RoomEggs", () => {
  it("sends hidden effects the eggs ask for", () => {
    const send = vi.fn(async () => ({ ok: true as const, version: 1 }));
    mount(send);
    eggBus.emit({ kind: "roll" });
    expect(send).not.toHaveBeenCalled();
    eggBus.emit({ kind: "effect", effectId: "konami" });
    expect(send).toHaveBeenCalledWith({
      type: "effect.send",
      effectId: "konami",
    });
  });

  it("fires a refused magic clue on this screen instead", async () => {
    const send = vi.fn(async () => ({
      ok: false as const,
      code: "rate_limited" as const,
      message: "slow down",
    }));
    mount(send);
    const seen: EggEvent[] = [];
    const off = eggBus.subscribe((e) => seen.push(e));
    eggBus.emit({ kind: "effect", effectId: "clue:banana" });
    eggBus.emit({ kind: "effect", effectId: "konami" });
    await vi.waitFor(() =>
      expect(seen.some((e) => e.kind === "rain" && e.id === "banana")).toBe(
        true,
      ),
    );
    // Only clue eggs fall back; Konami already played locally.
    expect(seen.filter((e) => e.kind === "rain")).toHaveLength(1);
    off();
  });
});
