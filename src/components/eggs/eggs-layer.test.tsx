import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eggBus } from "@/lib/eggs/bus";
import { useEggs } from "@/lib/eggs/store";
import { usePrefs } from "@/lib/prefs";
import { EggsLayer } from "./eggs-layer";

describe("EggsLayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEggs.getState().reset();
    usePrefs.getState().setReduceEffects(false);
    // jsdom has no Web Animations API.
    HTMLElement.prototype.animate = vi.fn(
      () => ({ onfinish: null }) as unknown as Animation,
    );
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rains the requested glyphs from the top and shows chips", () => {
    render(<EggsLayer />);
    act(() => {
      eggBus.emit({ kind: "rain", id: "pizza", glyphs: ["🍕"], count: 5 });
    });
    const drops = document.querySelectorAll(
      "[data-testid=effect-burst][data-effect=egg-pizza]",
    );
    expect(drops).toHaveLength(5);
    expect((drops[0] as HTMLElement).style.top).toBe("-60px");

    act(() => {
      eggBus.emit({ kind: "chip", id: "polo", text: "POLO!" });
    });
    expect(screen.getByTestId("egg-chip")).toHaveTextContent("POLO!");
    expect(screen.getByTestId("egg-chip")).toHaveAttribute("data-egg", "polo");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId("egg-chip")).toBeNull();
  });

  it("trims rain and swaps the roll for a chip under reduce effects", () => {
    usePrefs.getState().setReduceEffects(true);
    render(<EggsLayer />);
    act(() => {
      eggBus.emit({ kind: "rain", id: "x", glyphs: ["🍕"], count: 20 });
      eggBus.emit({ kind: "roll" });
    });
    expect(document.querySelectorAll("[data-effect=egg-x]")).toHaveLength(3);
    expect(screen.getByTestId("egg-chip")).toHaveTextContent("rolled");
  });

  it("reflects CRT on <html> and shows the pet", () => {
    render(<EggsLayer />);
    expect(document.documentElement.hasAttribute("data-egg-crt")).toBe(false);
    act(() => useEggs.getState().set({ crt: true, pet: "🦀" }));
    expect(document.documentElement.hasAttribute("data-egg-crt")).toBe(true);
    expect(screen.getByTestId("egg-crt")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId("egg-pet")).toHaveTextContent("🦀");
    act(() => useEggs.getState().reset());
    expect(document.documentElement.hasAttribute("data-egg-crt")).toBe(false);
    expect(screen.queryByTestId("egg-pet")).toBeNull();
  });
});
