import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { celebrationBus } from "@/lib/effect-bus";
import { eggBus } from "@/lib/eggs/bus";
import { useEggs } from "@/lib/eggs/store";
import { usePrefs } from "@/lib/prefs";
import { useGameStore } from "@/lib/store";
import { createGame } from "@shared/game/commands";
import type { RoundResult } from "@shared/game/types";
import { MemoryRouter } from "react-router";
import { EggsLayer as Layer } from "./eggs-layer";

function EggsLayer() {
  return (
    <MemoryRouter>
      <Layer />
    </MemoryRouter>
  );
}

describe("EggsLayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A plain June day: the calendar must not dress anything here.
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
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

  it("glows the wheel after a hot flick and rises the smoke", () => {
    render(<EggsLayer />);
    act(() => {
      eggBus.emit({ kind: "hot" });
      eggBus.emit({
        kind: "rain",
        id: "hot",
        glyphs: ["💨"],
        count: 2,
        direction: "rise",
      });
    });
    expect(document.documentElement.hasAttribute("data-egg-hot")).toBe(true);
    const puff = document.querySelector("[data-effect=egg-hot]") as HTMLElement;
    expect(puff.style.top).not.toBe("-60px");
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(document.documentElement.hasAttribute("data-egg-hot")).toBe(false);
  });

  it("spots a hat trick when the revealed history grows", () => {
    const game = createGame({
      code: "BCDF",
      hostId: "p1",
      hostName: "Ann",
      hostTokenHash: "h",
      now: 0,
    }).game;
    const four: RoundResult = {
      roundIndex: 0,
      psychicId: "p1",
      psychicTeam: "left",
      spectrum: { left: "a", right: "b" },
      clue: "x",
      target: 0.5,
      dials: { shared: { position: 0.5, wedge: 4, owners: ["p2"] } },
      vote: null,
      deltas: {},
      goAgain: false,
      psychicBonus: 0,
      gameOver: null,
      stats: {
        durationMs: 0,
        drawMs: null,
        pickMs: null,
        clueMs: null,
        guessMs: null,
        spins: 1,
        peeks: 0,
        clueLength: 1,
        players: {},
      },
    };
    useGameStore.getState().reset();
    render(<EggsLayer />);
    const snapshot = (history: RoundResult[]) =>
      useGameStore.getState().receive({
        type: "snapshot",
        state: { ...game, history },
        you: { playerId: "p1", target: null },
      });
    act(() => snapshot([four, four]));
    expect(screen.queryByTestId("egg-chip")).toBeNull();
    act(() => snapshot([four, four, four]));
    expect(screen.getByTestId("egg-chip")).toHaveTextContent(
      "Hat trick, Left Brain!",
    );
    expect(document.querySelectorAll("[data-effect=egg-hattrick]").length).toBe(
      16,
    );
    useGameStore.getState().reset();
  });

  it("dresses the season on <html>, keeps ambience off the round and fires New Year fireworks", () => {
    render(<EggsLayer />);
    expect(document.documentElement.hasAttribute("data-egg-season")).toBe(
      false,
    );
    act(() => useEggs.getState().set({ season: "winter" }));
    expect(document.documentElement.getAttribute("data-egg-season")).toBe(
      "winter",
    );
    expect(screen.getByTestId("egg-ambient")).toBeInTheDocument();

    const game = createGame({
      code: "BCDF",
      hostId: "p1",
      hostName: "Ann",
      hostTokenHash: "h",
      now: 0,
    }).game;
    // Off the /game route the phase does not matter; the ambience is for
    // the home screen. (The in-game gating is covered end to end.)
    act(() =>
      useGameStore.getState().receive({
        type: "snapshot",
        state: { ...game, phase: "guessing" },
        you: { playerId: "p1", target: null },
      }),
    );
    expect(screen.getByTestId("egg-ambient")).toBeInTheDocument();

    act(() => useEggs.getState().set({ season: "newyear" }));
    act(() => celebrationBus.emit({ kind: "gameover" }));
    expect(screen.getByTestId("egg-chip")).toHaveTextContent("Happy New Year");
    useGameStore.getState().reset();
  });

  it("reflects CRT on <html> and shows the pet", () => {
    render(<EggsLayer />);
    expect(document.documentElement.hasAttribute("data-egg-crt")).toBe(false);
    act(() => useEggs.getState().set({ crt: true, pet: "🦀", disco: true }));
    expect(document.documentElement.hasAttribute("data-egg-crt")).toBe(true);
    expect(document.documentElement.hasAttribute("data-egg-disco")).toBe(true);
    expect(screen.getByTestId("egg-crt")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId("egg-pet")).toHaveTextContent("🦀");
    act(() => useEggs.getState().reset());
    expect(document.documentElement.hasAttribute("data-egg-crt")).toBe(false);
    expect(document.documentElement.hasAttribute("data-egg-disco")).toBe(false);
    expect(screen.queryByTestId("egg-pet")).toBeNull();
  });
});
