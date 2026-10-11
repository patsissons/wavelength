import confetti from "canvas-confetti";
import { useEffect, useRef, useState } from "react";
import { effectById, type ScreenFx } from "@shared/effects/catalog";
import { audio } from "@/lib/audio";
import { effectBus, type EffectPayload } from "@/lib/effect-bus";
import { vibrate } from "@/lib/haptics";
import { usePrefs } from "@/lib/prefs";
import { useGameStore } from "@/lib/store";

const MAX_GLYPHS = 40;

/**
 * Renders incoming effects on top of everything: emoji bursts, confetti,
 * full-screen effects, sound and haptics. Pointer-events are off so play
 * continues underneath.
 */
export function EffectsLayer() {
  const layer = useRef<HTMLDivElement | null>(null);
  const [fx, setFx] = useState<{ kind: ScreenFx; key: number } | null>(null);

  useEffect(() => {
    return effectBus.subscribe((effect) => {
      const def = effectById(effect.effectId);
      if (!def) return;
      const prefs = usePrefs.getState();
      const from = useGameStore.getState().game?.players[effect.from]?.name;
      if (def.burst && layer.current) {
        burst(
          layer.current,
          def.burst.glyphs,
          prefs.reduceEffects ? 3 : def.burst.count,
          from,
          effect,
        );
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
    if (!fx) return;
    const t = setTimeout(() => setFx(null), fx.kind === "flash" ? 500 : 2200);
    return () => clearTimeout(t);
  }, [fx]);

  return (
    <div
      ref={layer}
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      aria-hidden
      data-testid="effects-layer"
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

function burst(
  root: HTMLElement,
  glyphs: ReadonlyArray<string>,
  count: number,
  from: string | undefined,
  effect: EffectPayload,
) {
  const live = root.querySelectorAll("[data-testid=effect-burst]").length;
  const n = Math.max(1, Math.min(count, MAX_GLYPHS - live));
  const width = root.clientWidth || 360;
  const height = root.clientHeight || 640;
  const baseX = 40 + Math.random() * (width - 80);
  for (let i = 0; i < n; i++) {
    const el = document.createElement("span");
    el.textContent = glyphs[i % glyphs.length]!;
    el.dataset.testid = "effect-burst";
    el.dataset.effect = effect.effectId;
    el.style.cssText = `position:absolute;left:${baseX + (Math.random() - 0.5) * 120}px;top:${height - 80}px;font-size:${28 + Math.random() * 20}px;will-change:transform,opacity;`;
    root.appendChild(el);
    const drift = (Math.random() - 0.5) * 160;
    const rise = 300 + Math.random() * 300;
    const duration = 1400 + Math.random() * 900;
    const anim = el.animate(
      [
        { transform: "translate(0,0) rotate(0deg) scale(0.6)", opacity: 0 },
        {
          transform: `translate(${drift * 0.3}px,-${rise * 0.3}px) rotate(${drift / 8}deg) scale(1.1)`,
          opacity: 1,
          offset: 0.2,
        },
        {
          transform: `translate(${drift}px,-${rise}px) rotate(${drift / 4}deg) scale(1)`,
          opacity: 0,
        },
      ],
      {
        duration,
        delay: i * 40,
        easing: "cubic-bezier(.2,.8,.3,1)",
        fill: "forwards",
      },
    );
    anim.onfinish = () => el.remove();
  }
  if (from) {
    const chip = document.createElement("span");
    chip.textContent = from;
    chip.dataset.testid = "effect-from";
    chip.style.cssText = `position:absolute;left:${baseX}px;top:${height - 60}px;transform:translateX(-50%);padding:2px 10px;border-radius:999px;background:var(--color-card);color:var(--color-foreground);font-size:12px;font-weight:600;`;
    root.appendChild(chip);
    chip.animate(
      [
        { opacity: 0, transform: "translate(-50%,10px)" },
        { opacity: 1, transform: "translate(-50%,0)", offset: 0.15 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0, transform: "translate(-50%,-30px)" },
      ],
      { duration: 1800, fill: "forwards" },
    ).onfinish = () => chip.remove();
  }
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
