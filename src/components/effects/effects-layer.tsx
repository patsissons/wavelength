import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { effectById, type ScreenFx } from "@shared/effects/catalog";
import { useArena } from "@/lib/arena";
import { audio } from "@/lib/audio";
import { celebrationBus, effectBus, type Celebration } from "@/lib/effect-bus";
import { vibrate } from "@/lib/haptics";
import { burst } from "./burst";
import { usePrefs } from "@/lib/prefs";
import { useGameStore } from "@/lib/store";

/**
 * Renders incoming effects on top of everything: emoji bursts, confetti,
 * full-screen effects, sound and haptics. Pointer-events are off so play
 * continues underneath.
 */
export function EffectsLayer() {
  const layer = useRef<HTMLDivElement | null>(null);
  const [fx, setFx] = useState<{ kind: ScreenFx; key: number } | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);
  const [poke, setPoke] = useState<string | null>(null);
  const [reacted, setReacted] = useState<string | null>(null);

  useEffect(() => {
    return effectBus.subscribe((effect) => {
      const prefs = usePrefs.getState();
      const state = useGameStore.getState();
      const from = state.game?.players[effect.from]?.name;
      if (effect.kind === "poke") {
        const me = state.you?.playerId;
        const target = state.game?.players[effect.to]?.name ?? "someone";
        const mine = effect.to === me;
        if (layer.current) {
          burst(layer.current, {
            glyphs: ["👉"],
            count: prefs.reduceEffects ? 2 : mine ? 10 : 4,
            label: mine
              ? `${from ?? "Someone"} poked you!`
              : `${from} 👉 ${target}`,
            effect: "poke",
          });
        }
        if (mine) {
          setPoke(from ?? "someone");
          if (!prefs.reduceEffects) shake();
          audio.play("poke");
          vibrate([60, 40, 60]);
        }
        return;
      }
      if (effect.kind === "reaction") {
        // In the arena the reaction flies between seats; this layer only
        // covers players still looking at the results.
        if (useArena.getState().open) return;
        const me = state.you?.playerId;
        const target = state.game?.players[effect.to]?.name ?? "someone";
        const mine = effect.to === me;
        if (layer.current) {
          burst(layer.current, {
            glyphs: [effect.emoji],
            count: prefs.reduceEffects ? 2 : mine ? 8 : 4,
            label: mine
              ? `${from ?? "Someone"} threw ${effect.emoji} at you!`
              : `${from ?? "Someone"} ${effect.emoji} ${target}`,
            effect: "reaction",
          });
        }
        if (mine) {
          setReacted(from ?? "someone");
          audio.play("squeak");
          vibrate([40, 30, 40]);
        }
        return;
      }
      const def = effectById(effect.effectId);
      if (!def) return;
      if (def.burst && layer.current) {
        burst(layer.current, {
          glyphs: def.burst.glyphs,
          count: prefs.reduceEffects ? 3 : def.burst.count,
          label: def.caption ? `${from ?? "Someone"} ${def.caption}` : from,
          effect: effect.effectId,
        });
      }
      if (def.confetti && !prefs.reduceEffects) {
        void confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.7 },
          disableForReducedMotion: true,
        });
      }
      if (def.fx && !prefs.reduceEffects) {
        setFx({ kind: def.fx, key: Date.now() });
        if (def.fx === "shake") shake();
      }
      if (def.sound) audio.play(def.sound);
      if (def.haptic) vibrate(def.haptic);
    });
  }, []);

  useEffect(() => {
    return celebrationBus.subscribe((c) => {
      if (c.kind === "clue") return; // the eggs layer's business
      setCelebration(c.kind === "score" ? `score-${c.points}` : c.kind);
      celebrate(c, usePrefs.getState().reduceEffects);
    });
  }, []);

  useEffect(() => {
    if (!fx) return;
    const t = setTimeout(() => setFx(null), fx.kind === "flash" ? 500 : 2200);
    return () => clearTimeout(t);
  }, [fx]);

  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 3000);
    return () => clearTimeout(t);
  }, [celebration]);

  useEffect(() => {
    if (!poke) return;
    const t = setTimeout(() => setPoke(null), 2000);
    return () => clearTimeout(t);
  }, [poke]);

  useEffect(() => {
    if (!reacted) return;
    const t = setTimeout(() => setReacted(null), 2000);
    return () => clearTimeout(t);
  }, [reacted]);

  return (
    <div
      ref={layer}
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden
      data-testid="effects-layer"
      data-celebration={celebration ?? undefined}
      data-poked-by={poke ?? undefined}
      data-reacted-by={reacted ?? undefined}
    >
      {fx && fx.kind !== "shake" && (
        <div
          key={fx.key}
          className={`fx fx-${fx.kind} absolute inset-0`}
          data-testid={`fx-${fx.kind}`}
        />
      )}
    </div>
  );
}

/**
 * Confetti scaled to the moment: a modest puff when the dial locks, more
 * for 2 and 3 points, and an absurd barrage with shaking and haptics for
 * a bullseye. "Reduce effects" trims it to a single small burst.
 */
function celebrate(c: Exclude<Celebration, { kind: "clue" }>, reduce: boolean) {
  const common = { disableForReducedMotion: true, zIndex: 60 } as const;
  if (c.kind === "newround") {
    audio.play("newround");
    return;
  }
  if (c.kind === "timeup") {
    toast("⏰ Time's up! Dials locked where they were.");
    audio.play("buzz");
    vibrate([80, 40, 80]);
    return;
  }
  if (c.kind === "gameover") {
    audio.play("celebrate");
    if (!reduce) {
      void confetti({
        ...common,
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
      });
    }
    return;
  }
  if (reduce) {
    void confetti({
      ...common,
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 },
    });
    audio.play("ding");
    return;
  }
  if (c.kind === "lock") {
    void confetti({
      ...common,
      particleCount: 80,
      spread: 70,
      origin: { y: 0.75 },
    });
    audio.play("ding");
    vibrate(30);
    return;
  }
  if (c.points === 2) {
    void confetti({
      ...common,
      particleCount: 120,
      spread: 80,
      origin: { y: 0.7 },
    });
    audio.play("ding");
    vibrate(40);
    return;
  }
  if (c.points === 3) {
    for (const x of [0.15, 0.85]) {
      void confetti({
        ...common,
        particleCount: 125,
        angle: x < 0.5 ? 60 : 120,
        spread: 60,
        origin: { x, y: 0.75 },
      });
    }
    audio.play("fanfare");
    vibrate([60, 40, 60]);
    return;
  }
  // Bullseye: 2.5 s of staggered cannons from both sides and the middle.
  audio.play("celebrate");
  vibrate([80, 40, 80, 40, 160]);
  shake();
  setTimeout(shake, 600);
  const end = Date.now() + 2500;
  const tick = () => {
    void confetti({
      ...common,
      particleCount: 90,
      angle: 60,
      spread: 70,
      startVelocity: 55,
      origin: { x: 0, y: 0.8 },
    });
    void confetti({
      ...common,
      particleCount: 90,
      angle: 120,
      spread: 70,
      startVelocity: 55,
      origin: { x: 1, y: 0.8 },
    });
    void confetti({
      ...common,
      particleCount: 60,
      spread: 360,
      startVelocity: 35,
      origin: { x: 0.5, y: 0.4 },
    });
    if (Date.now() < end) setTimeout(tick, 250);
  };
  tick();
}

function shake() {
  const root = document.getElementById("root");
  if (!root) return;
  root.animate(
    [0, -8, 8, -6, 6, -3, 3, 0].map((x) => ({
      transform: `translateX(${x}px)`,
    })),
    { duration: 500, easing: "ease-in-out" },
  );
}
