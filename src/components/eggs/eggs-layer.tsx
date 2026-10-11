import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { burst } from "@/components/effects/burst";
import { celebrationBus } from "@/lib/effect-bus";
import { eggBus } from "@/lib/eggs/bus";
import { fireClueEgg, matchClue } from "@/lib/eggs/clues";
import { celebrateHatTrick, hatTrick } from "@/lib/eggs/round";
import { useSeason } from "@/lib/eggs/seasons";
import { useEggs } from "@/lib/eggs/store";
import { installTriggers } from "@/lib/eggs/triggers";
import { Ambient } from "./ambient";
import { usePrefs } from "@/lib/prefs";
import { useGameStore } from "@/lib/store";

/**
 * Global overlay for easter eggs: one-shot moments from the egg bus (rain,
 * chips, the barrel roll) and persistent modes from the egg store (CRT,
 * the pet). Mounted once in App so every screen gets them. Pointer events
 * are off and the box clips, so nothing here can widen the page.
 */
export function EggsLayer() {
  const layer = useRef<HTMLDivElement | null>(null);
  const crt = useEggs((s) => s.crt);
  const pet = useEggs((s) => s.pet);
  const party = useEggs((s) => s.party);
  const disco = useEggs((s) => s.disco);
  const season = useSeason();
  const phase = useGameStore((s) => s.game?.phase ?? null);
  const inGame = useLocation().pathname.startsWith("/game/");
  // Ambient dressing stays off the round itself.
  const ambient =
    season !== null &&
    (!inGame || phase === "lobby" || phase === "gameover" || phase === null);
  const reduce = usePrefs((s) => s.reduceEffects);
  const [chip, setChip] = useState<{
    id: string;
    text: string;
    key: number;
  } | null>(null);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-egg-crt", crt);
    return () => document.documentElement.removeAttribute("data-egg-crt");
  }, [crt]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-egg-party", party);
    return () => document.documentElement.removeAttribute("data-egg-party");
  }, [party]);

  useEffect(() => {
    document.documentElement.toggleAttribute("data-egg-disco", disco);
    return () => document.documentElement.removeAttribute("data-egg-disco");
  }, [disco]);

  useEffect(() => {
    if (season)
      document.documentElement.setAttribute("data-egg-season", season);
    else document.documentElement.removeAttribute("data-egg-season");
    return () => document.documentElement.removeAttribute("data-egg-season");
  }, [season]);

  // Lets the egg styles skip motion without each rule checking prefs.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-egg-reduce", reduce);
    return () => document.documentElement.removeAttribute("data-egg-reduce");
  }, [reduce]);

  useEffect(() => installTriggers(), []);

  // Three bullseyes in a row: watch the revealed history grow.
  useEffect(() => {
    let seen = useGameStore.getState().game?.history.length ?? 0;
    return useGameStore.subscribe((state) => {
      const game = state.game;
      const length = game?.history.length ?? 0;
      if (!game || length <= seen) {
        seen = length;
        return;
      }
      seen = length;
      const who = hatTrick(game);
      if (who) celebrateHatTrick(game, who);
    });
  }, []);

  useEffect(() => {
    return celebrationBus.subscribe((c) => {
      if (c.kind === "clue") {
        const egg = matchClue(c.clue);
        if (egg) fireClueEgg(egg);
      } else if (c.kind === "gameover" && season === "newyear") {
        fireworks(usePrefs.getState().reduceEffects);
      }
    });
  }, [season]);

  useEffect(() => {
    return eggBus.subscribe((event) => {
      const reduce = usePrefs.getState().reduceEffects;
      switch (event.kind) {
        case "rain":
          if (layer.current) {
            burst(layer.current, {
              glyphs: event.glyphs,
              count: reduce ? 3 : event.count,
              effect: `egg-${event.id}`,
              direction: event.direction ?? "fall",
            });
          }
          return;
        case "chip":
          setChip({ id: event.id, text: event.text, key: Date.now() });
          return;
        case "konami":
          return;
        case "hot": {
          const html = document.documentElement;
          html.setAttribute("data-egg-hot", "");
          setTimeout(() => html.removeAttribute("data-egg-hot"), 1500);
          return;
        }
        case "roll":
          if (reduce) {
            setChip({
              id: "roll",
              text: "🛩️ (rolled, quietly)",
              key: Date.now(),
            });
          } else {
            barrelRoll();
          }
          return;
      }
    });
  }, []);

  useEffect(() => {
    if (!chip) return;
    const t = setTimeout(() => setChip(null), 2600);
    return () => clearTimeout(t);
  }, [chip]);

  return (
    <div
      ref={layer}
      className="pointer-events-none fixed inset-0 z-[55] overflow-hidden"
      aria-hidden
      data-testid="eggs-layer"
    >
      {ambient && season && <Ambient season={season} />}
      {crt && (
        <div className="egg-crt absolute inset-0" data-testid="egg-crt" />
      )}
      {pet && <Pet glyph={pet} />}
      {chip && (
        <div
          key={chip.key}
          className="egg-chip absolute top-[28%] left-1/2 rounded-full bg-card px-5 py-2 text-lg font-bold whitespace-nowrap shadow-lg"
          data-testid="egg-chip"
          data-egg={chip.id}
        >
          {chip.text}
        </div>
      )}
    </div>
  );
}

const TROT_MS = 12_000;

/** A critter crossing the bottom of the screen every 30–60 s. */
function Pet({ glyph }: { glyph: string }) {
  const reduce = usePrefs((s) => s.reduceEffects);
  const [trip, setTrip] = useState<{ key: number; flip: boolean } | null>(null);

  useEffect(() => {
    if (reduce) return;
    let timer: ReturnType<typeof setTimeout>;
    let flip = false;
    const schedule = (delay: number) => {
      timer = setTimeout(() => {
        flip = !flip;
        setTrip({ key: Date.now(), flip });
        schedule(TROT_MS + 30_000 + Math.random() * 30_000);
      }, delay);
    };
    schedule(1500);
    return () => clearTimeout(timer);
  }, [reduce, glyph]);

  if (reduce) {
    return (
      <span
        className="safe-bottom absolute right-4 bottom-0 text-3xl"
        data-testid="egg-pet"
      >
        {glyph}
      </span>
    );
  }
  if (!trip) return null;
  return (
    <span
      key={trip.key}
      className="egg-pet safe-bottom absolute bottom-0 text-3xl"
      style={{ animationDirection: trip.flip ? "reverse" : "normal" }}
      data-testid="egg-pet"
      onAnimationEnd={() => setTrip(null)}
    >
      <span
        className="egg-pet-step inline-block"
        style={{ transform: trip.flip ? undefined : "scaleX(-1)" }}
      >
        {glyph}
      </span>
    </span>
  );
}

/** New Year at game over: three seconds of fireworks from the bottom corners. */
function fireworks(reduce: boolean) {
  eggBus.emit({ kind: "chip", id: "newyear", text: "🎆 Happy New Year!" });
  if (reduce) return;
  const end = Date.now() + 3000;
  const tick = () => {
    for (const x of [0.1, 0.9]) {
      void confetti({
        particleCount: 40,
        angle: x < 0.5 ? 60 : 120,
        spread: 70,
        startVelocity: 60,
        origin: { x, y: 1 },
        zIndex: 60,
        disableForReducedMotion: true,
      });
    }
    if (Date.now() < end) setTimeout(tick, 350);
  };
  tick();
}

function barrelRoll() {
  const root = document.getElementById("root");
  if (!root) return;
  root.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
    { duration: 1200, easing: "cubic-bezier(.4,0,.2,1)" },
  );
}
