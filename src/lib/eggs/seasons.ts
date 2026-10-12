/**
 * Seasonal dressing by the calendar. Pure: the store imports the list of
 * seasons from here, so nothing in this file may import the store (the
 * hook that reads the console override lives in `use-season.ts`).
 */
export type Season =
  "halloween" | "thanksgiving" | "winter" | "newyear" | "stpatricks" | "fools";

export const SEASONS: ReadonlyArray<Season> = [
  "halloween",
  "thanksgiving",
  "winter",
  "newyear",
  "stpatricks",
  "fools",
];

/** Day of the month of the n-th given weekday (0 = Sunday) of a month. */
export function nthWeekday(
  year: number,
  month0: number,
  weekday: number,
  n: number,
): number {
  const first = new Date(year, month0, 1).getDay();
  return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
}

/**
 * Thanksgiving long weekends as [first day, last day] of their month:
 * the US one runs Thursday to Sunday from the fourth Thursday of November,
 * the Canadian one Saturday to Monday up to the second Monday of October.
 */
export function thanksgivingWindow(year: number): {
  us: [number, number];
  ca: [number, number];
} {
  const thursday = nthWeekday(year, 10, 4, 4);
  const monday = nthWeekday(year, 9, 1, 2);
  return { us: [thursday, thursday + 3], ca: [monday - 2, monday] };
}

/**
 * Halloween week, both Thanksgiving weekends, the winter holidays, New
 * Year's Eve and Day (on top of winter: the fireworks win), St Patrick's
 * Day and April Fools'. The calendar switches them on; the console
 * override previews any of them.
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
  const { us, ca } = thanksgivingWindow(date.getFullYear());
  if (month === 11 && day >= us[0] && day <= us[1]) return "thanksgiving";
  if (month === 10 && day >= ca[0] && day <= ca[1]) return "thanksgiving";
  if (month === 3 && day === 17) return "stpatricks";
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
    case "thanksgiving":
      return "Read your friends' minds. Pass the gravy.";
    case "newyear":
      return "Read your friends' minds. New year, same wavelength.";
    case "stpatricks":
      return "Read your friends' minds. Sláinte.";
    default:
      return "Read your friends' minds.";
  }
}
