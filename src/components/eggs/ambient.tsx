import { useMemo } from "react";
import type { Season } from "@/lib/eggs/store";
import { usePrefs } from "@/lib/prefs";

const FLAKES = 14;

/**
 * Seasonal background life: snow for the winter holidays, drifting ghosts
 * for Halloween. Pure CSS animation; under "Reduce effects" a single
 * still glyph sits in the corner instead.
 */
export function Ambient({ season }: { season: Season }) {
  const reduce = usePrefs((s) => s.reduceEffects);
  const flakes = useMemo(
    () =>
      Array.from({ length: FLAKES }, (_, i) => ({
        left: `${(i * 7.3 + 3) % 100}%`,
        delay: `${-((i * 1.7) % 9)}s`,
        duration: `${8 + (i % 5) * 1.5}s`,
        size: `${12 + (i % 3) * 5}px`,
      })),
    [],
  );
  if (season === "fools") return null;
  const glyph = season === "halloween" ? "🎃" : "❄️";
  if (reduce) {
    return (
      <span
        className="safe-top absolute top-0 right-4 text-2xl opacity-70"
        data-testid="egg-ambient"
        data-season={season}
      >
        {glyph}
      </span>
    );
  }
  if (season === "halloween") {
    return (
      <div
        className="absolute inset-0"
        data-testid="egg-ambient"
        data-season={season}
      >
        {["👻", "🦇", "🎃"].map((g, i) => (
          <span
            key={g}
            className="egg-ghost absolute text-3xl"
            style={{
              top: `${12 + i * 14}%`,
              animationDelay: `${-i * 7}s`,
              animationDuration: `${22 + i * 6}s`,
            }}
          >
            {g}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div
      className="absolute inset-0"
      data-testid="egg-ambient"
      data-season={season}
    >
      {flakes.map((f, i) => (
        <span
          key={i}
          className="egg-snow absolute -top-6 text-white/80"
          style={{
            left: f.left,
            animationDelay: f.delay,
            animationDuration: f.duration,
            fontSize: f.size,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}
