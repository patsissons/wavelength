import { useEffect, useRef, useState } from "react";
import { burst } from "@/components/effects/burst";
import { eggBus } from "@/lib/eggs/bus";
import { useEggs } from "@/lib/eggs/store";
import { installTriggers } from "@/lib/eggs/triggers";
import { usePrefs } from "@/lib/prefs";

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

  // Lets the egg styles skip motion without each rule checking prefs.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-egg-reduce", reduce);
    return () => document.documentElement.removeAttribute("data-egg-reduce");
  }, [reduce]);

  useEffect(() => installTriggers(), []);

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
              direction: "fall",
            });
          }
          return;
        case "chip":
          setChip({ id: event.id, text: event.text, key: Date.now() });
          return;
        case "konami":
          return;
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

function barrelRoll() {
  const root = document.getElementById("root");
  if (!root) return;
  root.animate(
    [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
    { duration: 1200, easing: "cubic-bezier(.4,0,.2,1)" },
  );
}
