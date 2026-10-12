import { useMemo } from "react";
import type { Season } from "@/lib/eggs/seasons";
import { usePrefs } from "@/lib/prefs";

const FLAKES = 14;

interface Dressing {
  /** The one still glyph shown under "Reduce effects". */
  still: string;
  /** Glyphs that fall like snow, cycled across the flakes. */
  fall?: { glyphs: ReadonlyArray<string>; className?: string };
  /** Glyphs that drift across the screen like ghosts. */
  drift?: ReadonlyArray<string>;
}

const DRESSING: Record<Exclude<Season, "fools">, Dressing> = {
  winter: { still: "❄️", fall: { glyphs: ["❄"], className: "text-white/80" } },
  newyear: { still: "❄️", fall: { glyphs: ["❄"], className: "text-white/80" } },
  halloween: { still: "🎃", drift: ["👻", "🦇", "🎃"] },
  thanksgiving: { still: "🦃", fall: { glyphs: ["🍂", "🍁"] }, drift: ["🦃"] },
  stpatricks: { still: "☘️", drift: ["☘️", "🍀", "🌈"] },
};

/**
 * Seasonal background life: snow for the winter holidays, leaves and a
 * turkey for Thanksgiving, drifting ghosts for Halloween, shamrocks for
 * St Patrick's. Pure CSS animation; under "Reduce effects" a single still
 * glyph sits in the corner instead.
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
  const dressing = DRESSING[season];
  if (reduce) {
    return (
      <span
        className="safe-top absolute top-0 right-4 text-2xl opacity-70"
        data-testid="egg-ambient"
        data-season={season}
      >
        {dressing.still}
      </span>
    );
  }
  return (
    <div
      className="absolute inset-0"
      data-testid="egg-ambient"
      data-season={season}
    >
      {dressing.fall &&
        flakes.map((f, i) => (
          <span
            key={`fall-${i}`}
            className={`egg-snow absolute -top-6 ${dressing.fall!.className ?? ""}`}
            style={{
              left: f.left,
              animationDelay: f.delay,
              animationDuration: f.duration,
              fontSize: f.size,
            }}
          >
            {dressing.fall!.glyphs[i % dressing.fall!.glyphs.length]}
          </span>
        ))}
      {dressing.drift?.map((g, i) => (
        <span
          key={`drift-${g}`}
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
