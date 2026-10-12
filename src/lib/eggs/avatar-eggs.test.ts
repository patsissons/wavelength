import { beforeEach, describe, expect, it, vi } from "vitest";

const { play, toast } = vi.hoisted(() => ({ play: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/audio", () => ({ audio: { play } }));
vi.mock("sonner", () => ({ toast }));

import { eggBus, type EggEvent } from "./bus";
import { avatarGlyph, rainAvatar, togglePet } from "./avatar-eggs";
import { useEggs } from "./store";

describe("avatar eggs", () => {
  beforeEach(() => {
    useEggs.getState().reset();
    play.mockClear();
    toast.mockClear();
  });

  it("stands a player's avatar in for one emoji", () => {
    expect(avatarGlyph({ name: "Ann", avatar: "disco-cat" }, "x")).toBe("🐱");
    expect(avatarGlyph({ name: "Ann", avatar: "🦀" }, "x")).toBe("🦀");
    expect(avatarGlyph({ name: "Ann", avatar: null }, "🌧️")).toBe("🌧️");
    expect(avatarGlyph({ name: "Ann" }, "🐈")).toBe("🐈");
  });

  it("rains the avatar with a splash", () => {
    const seen: EggEvent[] = [];
    const off = eggBus.subscribe((e) => seen.push(e));
    expect(rainAvatar({ name: "Ann", avatar: "🦀" })).toBe("🦀");
    expect(seen).toEqual([
      { kind: "rain", id: "avatar", glyphs: ["🦀"], count: 20 },
    ]);
    expect(play).toHaveBeenCalledWith("splash");
    off();
  });

  it("adopts the avatar as the pet and sends it home again", () => {
    expect(togglePet({ name: "Ann", avatar: "disco-cat" })).toBe("🐱");
    expect(useEggs.getState().pet).toBe("🐱");
    expect(toast).toHaveBeenLastCalledWith("🐱 adopted. It will wander by.");
    expect(togglePet({ name: "Ann", avatar: "disco-cat" })).toBeNull();
    expect(useEggs.getState().pet).toBeNull();
    // A different avatar swaps the pet rather than dismissing it.
    togglePet({ name: "Ann", avatar: "🦀" });
    expect(togglePet({ name: "Ann", avatar: null })).toBe("🐈");
  });
});
