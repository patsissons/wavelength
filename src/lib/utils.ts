export { cn } from "cn";

/** Distinct hue per player colour index. */
export function playerHue(color: number): number {
  return (color * 137.508) % 360;
}

export function playerColor(color: number, lightness = 0.78): string {
  return `oklch(${lightness} 0.16 ${playerHue(color).toFixed(1)})`;
}
