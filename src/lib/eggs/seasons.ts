import { useMemo } from "react";
import { useEggs, type Season } from "./store";

export const SEASONS: ReadonlyArray<Season> = [
  "halloween",
  "winter",
  "newyear",
  "fools",
];

/**
 * Seasonal dressing by the calendar: Halloween week, the winter holidays,
 * New Year's Eve and Day (on top of winter: the fireworks win), and
 * April Fools'. The console override previews any of them.
 */
export function seasonFor(
  date: Date,
  override: Season | null = null,
): Season | null {
  if (override) return override;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month === 12 && day === 31) || (month === 1 && day === 1))
    return "newyear";
  if (month === 12 && day >= 20) return "winter";
  if (month === 10 && day >= 25) return "halloween";
  if (month === 4 && day === 1) return "fools";
  return null;
}

export function isSeason(value: unknown): value is Season {
  return SEASONS.includes(value as Season);
}

/** The home-screen tagline, seasonally adjusted. */
export function tagline(season: Season | null): string {
  switch (season) {
    case "fools":
      return "Read your friends' minds. Results may vary.";
    case "halloween":
      return "Read your friends' minds. If you dare.";
    case "newyear":
      return "Read your friends' minds. New year, same wavelength.";
    default:
      return "Read your friends' minds.";
  }
}

export function useSeason(): Season | null {
  const override = useEggs((s) => s.season);
  return useMemo(() => seasonFor(new Date(), override), [override]);
}
