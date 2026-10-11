export { cn } from "cn";

/** Distinct hue per player colour index. */
export function playerHue(color: number): number {
  return (color * 137.508) % 360;
}

export function playerColor(color: number, lightness = 0.78): string {
  return `oklch(${lightness} 0.16 ${playerHue(color).toFixed(1)})`;
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/**
 * The first user-perceived character of a name: a whole emoji (including
 * skin tones and ZWJ sequences) rather than half a surrogate pair.
 */
export function firstGrapheme(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const first = segmenter
    ? (segmenter.segment(trimmed)[Symbol.iterator]().next().value?.segment ??
      "")
    : (Array.from(trimmed)[0] ?? "");
  return first.length === 1 ? first.toUpperCase() : first;
}
