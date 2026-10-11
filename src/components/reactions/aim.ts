export interface Point {
  x: number;
  y: number;
}

export interface Target extends Point {
  id: string;
}

export interface Sample extends Point {
  t: number;
}

/**
 * `n` points spread evenly along a semicircle of radius `r` above (cx, cy):
 * equal arc spacing with a gap at both ends, so nobody sits on the baseline
 * next to the thrower.
 */
export function arcLayout(
  n: number,
  cx: number,
  cy: number,
  r: number,
): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = Math.PI - (Math.PI * (i + 1)) / (n + 1);
    return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
  });
}

/** Stage geometry for a body of w × h with a tray at the bottom. */
export function arenaLayout(
  w: number,
  h: number,
  n: number,
  { trayHeight = 84, nodeRadius = 44 } = {},
): { cx: number; cy: number; r: number; points: Point[] } {
  const cx = w / 2;
  const cy = h - trayHeight - nodeRadius - 12;
  const r = Math.max(80, Math.min(cx - nodeRadius, cy - nodeRadius - 36));
  return { cx, cy, r, points: arcLayout(n, cx, cy, r) };
}

export interface AimOptions {
  /** Releasing within this distance of a player is a direct hit. */
  hitRadius: number;
  /** Below this (px per ms) a release is a drop, not a flick. */
  minSpeed: number;
  /** A flick must point within this angle (radians) of the player. */
  maxAngle: number;
}

export const AIM: AimOptions = {
  hitRadius: 48,
  minSpeed: 0.25,
  maxAngle: Math.PI / 7,
};

/**
 * Pointer velocity from the last `windowMs` of samples. Synthetic input can
 * stamp several moves in the same millisecond; a zero interval with real
 * distance is treated as a very fast flick rather than a stall.
 */
export function velocityOf(
  samples: ReadonlyArray<Sample>,
  windowMs = 120,
): Point {
  const last = samples[samples.length - 1];
  if (!last || samples.length < 2) return { x: 0, y: 0 };
  let first = last;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i]!.t > windowMs) break;
    first = samples[i]!;
  }
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const dt = last.t - first.t;
  if (dx === 0 && dy === 0) return { x: 0, y: 0 };
  const scale = dt > 0 ? 1 / dt : 10;
  return { x: dx * scale, y: dy * scale };
}

/**
 * Who a thrown emoji hits: the player it was dropped on, else the player
 * the flick points at most directly (within `maxAngle`), else nobody.
 */
export function pickTarget(
  release: Point,
  velocity: Point,
  targets: ReadonlyArray<Target>,
  opts: AimOptions = AIM,
): string | null {
  let nearest: { id: string; d: number } | null = null;
  for (const t of targets) {
    const d = Math.hypot(t.x - release.x, t.y - release.y);
    if (d <= opts.hitRadius && (!nearest || d < nearest.d)) {
      nearest = { id: t.id, d };
    }
  }
  if (nearest) return nearest.id;

  const speed = Math.hypot(velocity.x, velocity.y);
  if (speed < opts.minSpeed) return null;
  let best: string | null = null;
  let bestAngle = Infinity;
  for (const t of targets) {
    const dx = t.x - release.x;
    const dy = t.y - release.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) continue;
    const cos = (dx * velocity.x + dy * velocity.y) / (dist * speed);
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle <= opts.maxAngle && angle < bestAngle) {
      best = t.id;
      bestAngle = angle;
    }
  }
  return best;
}
