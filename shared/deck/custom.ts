import type { Spectrum } from "../game/types";
import { LIMITS } from "../game/types";

const SEPARATORS = /\s*(?:<->|<=>|↔|\||\/|--|—|–| - | vs\.? )\s*/i;

/**
 * Parse host-entered custom spectra, one per line, e.g. "Cold | Hot",
 * "Cold - Hot", "Cold <-> Hot" or "Cold vs Hot". Invalid lines are dropped;
 * duplicates (case-insensitive) are removed.
 */
export function parseCustomSpectra(text: string): Spectrum[] {
  const seen = new Set<string>();
  const result: Spectrum[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(SEPARATORS).map((p) => p.trim());
    if (parts.length !== 2) continue;
    const [left, right] = parts as [string, string];
    if (!left || !right) continue;
    if (left.length > LIMITS.labelMax || right.length > LIMITS.labelMax)
      continue;
    const key = `${left.toLowerCase()}|${right.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ left, right });
    if (result.length >= LIMITS.customSpectraMax) break;
  }
  return result;
}

export function formatCustomSpectra(spectra: Spectrum[]): string {
  return spectra.map((s) => `${s.left} | ${s.right}`).join("\n");
}
