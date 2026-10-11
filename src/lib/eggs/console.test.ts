import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eggBus, type EggEvent } from "./bus";
import { eggApi, installConsole, printMenu } from "./console";
import { useEggs } from "./store";

describe("console API", () => {
  let log: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.useFakeTimers();
    log = vi.spyOn(console, "log").mockImplementation(() => {});
    useEggs.getState().reset();
  });
  afterEach(() => {
    log.mockRestore();
    vi.useRealTimers();
    delete (window as { wavelength?: unknown }).wavelength;
  });

  it("prints the menu when `wavelength` is read, not when a method is called", () => {
    installConsole();
    expect(window.wavelength).toBeDefined();
    vi.runAllTimers();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain("Wavelength easter eggs");

    log.mockClear();
    expect(window.wavelength!.crt()).toBe("📺 CRT on");
    vi.runAllTimers();
    expect(log).not.toHaveBeenCalled();
    expect(useEggs.getState().crt).toBe(true);

    // Installing twice keeps the first getter.
    installConsole();
    expect(
      Object.getOwnPropertyDescriptor(window, "wavelength")?.get,
    ).toBeDefined();
  });

  it("list() prints the menu on demand with the styled header", () => {
    expect(eggApi.list()).toMatch(/\d+ eggs/);
    expect(log).toHaveBeenCalledTimes(1);
    const [text, style] = log.mock.calls[0]!;
    expect(String(text).startsWith("%c")).toBe(true);
    expect(String(style)).toContain("font");
    printMenu((s) => expect(String(s)).toContain("Rain"));
  });

  it("rain emits one event per call with sanitised arguments", () => {
    const seen: EggEvent[] = [];
    const off = eggBus.subscribe((e) => seen.push(e));
    expect(eggApi.rain("🍕🍔", 3)).toBe("raining 3 × 🍕🍔");
    expect(eggApi.rain("", 0)).toBe("raining 1 × ");
    expect(eggApi.rain("x", 999)).toContain("60");
    off();
    expect(seen).toEqual([
      { kind: "rain", id: "custom", glyphs: ["🍕", "🍔"], count: 3 },
      { kind: "rain", id: "custom", glyphs: ["🌧️"], count: 1 },
      { kind: "rain", id: "custom", glyphs: ["x"], count: 60 },
    ]);
  });

  it("runs the jukebox through the audio manager", async () => {
    const audio = await import("@/lib/audio");
    const play = vi.spyOn(audio.audio, "play").mockImplementation(() => {});
    const setLoop = vi
      .spyOn(audio.audio, "setLoop")
      .mockImplementation(() => {});
    expect(eggApi.jukebox()).toMatch(/\d+ sounds, 2 loops/);
    expect(String(log.mock.calls[0]?.[0])).toContain("fanfare");
    expect(eggApi.play("nope")).toContain("no sound");
    expect(eggApi.loop("nope")).toContain("no loop");
    // Not unlocked yet: the console says why nothing played.
    expect(eggApi.play("fanfare")).toContain("tap the page");
    expect(eggApi.loop("disco")).toContain("tap the page");
    expect(eggApi.loop(null)).toBe("loop stopped");
    expect(setLoop).toHaveBeenCalledWith(null);
    vi.spyOn(audio.audio, "ready", "get").mockReturnValue(true);
    expect(eggApi.play("fanfare")).toBe("▶ fanfare");
    expect(play).toHaveBeenCalledWith("fanfare");
    expect(eggApi.loop("disco")).toBe("🔁 disco");
    expect(setLoop).toHaveBeenCalledWith("disco");
    expect(eggApi.disco()).toBe("🪩 disco on");
    expect(eggApi.disco()).toBe("disco off");
    expect(eggApi.disco(5)).toBe("🪩 disco for 5s");
    expect(useEggs.getState().disco).toBe(true);
    vi.advanceTimersByTime(5100);
    expect(useEggs.getState().disco).toBe(false);
    vi.restoreAllMocks();
  });

  it("toggles the modes and resets them", () => {
    const seen: EggEvent[] = [];
    const off = eggBus.subscribe((e) => seen.push(e));
    expect(eggApi.barrelRoll()).toContain("rolling");
    expect(seen).toEqual([{ kind: "roll" }]);
    off();
    expect(eggApi.pet()).toBe("🐈 adopted");
    expect(useEggs.getState().pet).toBe("🐈");
    expect(eggApi.pet(null)).toBe("pet sent home");
    expect(eggApi.pet("  ")).toBe("pet sent home");
    eggApi.crt();
    expect(eggApi.crt()).toBe("CRT off");
    eggApi.crt();
    eggApi.pet("🦀");
    expect(eggApi.reset()).toBe("all eggs off");
    expect(useEggs.getState()).toMatchObject({ crt: false, pet: null });
  });
});
