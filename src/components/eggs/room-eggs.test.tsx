import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionContext } from "@/lib/connection-context";
import { eggBus } from "@/lib/eggs/bus";
import { RoomEggs } from "./room-eggs";

describe("RoomEggs", () => {
  it("sends the hidden konami effect when the egg fires", () => {
    const send = vi.fn(async () => ({ ok: true as const, version: 1 }));
    render(
      <ConnectionContext.Provider
        value={{ send, sendEphemeral: vi.fn(), reconnectNow: vi.fn() }}
      >
        <RoomEggs />
      </ConnectionContext.Provider>,
    );
    eggBus.emit({ kind: "roll" });
    expect(send).not.toHaveBeenCalled();
    eggBus.emit({ kind: "konami" });
    expect(send).toHaveBeenCalledWith({
      type: "effect.send",
      effectId: "konami",
    });
  });
});
