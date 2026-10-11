/**
 * Board geometry shared by rendering, input mapping, spin physics and
 * scoring. Positions are 0..1 along the spectrum (0 = left end, 1 = right
 * end); angles are radians measured counter-clockwise from the right-hand
 * end of the baseline, so position 0 is π, 0.5 is π/2 (top) and 1 is 0.
 */

export const VIEW = { width: 400, height: 230 } as const;
export const CX = 200;
export const CY = 205;
export const R = 180;

/** Segments across the 180° window; odd so the 4-point segment is centred. */
export const SEGMENTS = 23;
export const SEGMENT = 1 / SEGMENTS;
/** The scoring wedge is five segments: [2, 3, 4, 3, 2]. */
export const WEDGE_HALF = 2.5 * SEGMENT;
export const WEDGE_SCORES = [2, 3, 4, 3, 2] as const;

export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function positionToAngle(position: number): number {
  return Math.PI * (1 - position);
}

export function angleToPosition(angle: number): number {
  return 1 - angle / Math.PI;
}

export function positionToPoint(
  position: number,
  radius: number = R,
): { x: number; y: number } {
  const angle = positionToAngle(position);
  return { x: CX + radius * Math.cos(angle), y: CY - radius * Math.sin(angle) };
}

/**
 * Map a point in viewBox space to a spectrum position. Points below the
 * baseline snap to the nearest end so a finger sliding off the arc keeps
 * the dial pinned.
 */
export function pointToPosition(x: number, y: number): number {
  const dx = x - CX;
  const dy = CY - y;
  if (dy < 0) return dx < 0 ? 0 : 1;
  const angle = Math.atan2(dy, dx);
  return clamp(angleToPosition(angle), 0, 1);
}

/** Keep the whole wedge inside the window. */
export function clampTarget(target: number): number {
  return clamp(target, WEDGE_HALF, 1 - WEDGE_HALF);
}

export function randomTarget(random: () => number): number {
  return WEDGE_HALF + random() * (1 - 2 * WEDGE_HALF);
}

/** SVG path for an annular sector between two positions and two radii. */
export function sectorPath(
  p0: number,
  p1: number,
  innerRadius: number,
  outerRadius: number,
): string {
  const lo = Math.min(p0, p1);
  const hi = Math.max(p0, p1);
  const a = positionToPoint(lo, outerRadius);
  const b = positionToPoint(hi, outerRadius);
  const c = positionToPoint(hi, innerRadius);
  const d = positionToPoint(lo, innerRadius);
  const large = hi - lo > 0.5 ? 1 : 0;
  const f = (n: number) => n.toFixed(2);
  return [
    `M ${f(a.x)} ${f(a.y)}`,
    `A ${f(outerRadius)} ${f(outerRadius)} 0 ${large} 1 ${f(b.x)} ${f(b.y)}`,
    `L ${f(c.x)} ${f(c.y)}`,
    `A ${f(innerRadius)} ${f(innerRadius)} 0 ${large} 0 ${f(d.x)} ${f(d.y)}`,
    "Z",
  ].join(" ");
}

export interface WedgeSector {
  score: (typeof WEDGE_SCORES)[number];
  p0: number;
  p1: number;
}

/** The five scoring sectors around a target, left to right. */
export function wedgeSectors(target: number): WedgeSector[] {
  return WEDGE_SCORES.map((score, i) => {
    const offset = i - 2;
    return {
      score,
      p0: target + (offset - 0.5) * SEGMENT,
      p1: target + (offset + 0.5) * SEGMENT,
    };
  });
}

/* ---------- Spin ---------- */

export const SPIN = {
  minVelocity: 4,
  maxVelocity: 40,
  minTurns: 1,
  maxTurns: 5,
  baseMs: 1400,
  perTurnMs: 450,
} as const;

/**
 * Derive the cosmetic spin parameters from the psychic's flick velocity
 * (rad/s, sign = direction). The target itself is chosen separately.
 */
export function spinParams(velocity: number): {
  direction: 1 | -1;
  turns: number;
  durationMs: number;
} {
  const direction: 1 | -1 = velocity < 0 ? -1 : 1;
  const speed = clamp(Math.abs(velocity), SPIN.minVelocity, SPIN.maxVelocity);
  const turns = clamp(Math.round(speed / 8), SPIN.minTurns, SPIN.maxTurns);
  return { direction, turns, durationMs: SPIN.baseMs + SPIN.perTurnMs * turns };
}

/**
 * The wedge is painted on an invisible disc; at disc angle 0 the wedge
 * centre sits at the top (position 0.5). This is the disc angle that puts
 * the wedge centre on `target`.
 */
export function discAngleForTarget(target: number): number {
  return normalizeAngle(positionToAngle(target) - Math.PI / 2);
}

export function normalizeAngle(angle: number): number {
  const a = angle % TAU;
  return a < 0 ? a + TAU : a;
}

/**
 * Total signed rotation from `from` so that the disc completes `turns` full
 * revolutions in `direction` and lands exactly on `to`.
 */
export function spinDelta(
  from: number,
  to: number,
  direction: 1 | -1,
  turns: number,
): number {
  const partial = normalizeAngle(direction * (to - from));
  return direction * (TAU * turns + partial);
}

export function easeOutCubic(t: number): number {
  const u = 1 - clamp(t, 0, 1);
  return 1 - u * u * u;
}

/** Disc angle at normalised time t ∈ [0, 1] of a spin. */
export function spinAngleAt(from: number, delta: number, t: number): number {
  return from + delta * easeOutCubic(t);
}

/** Position of the wedge centre for a disc angle. */
export function discAngleToPosition(discAngle: number): number {
  return angleToPosition(normalizeAngle(discAngle + Math.PI / 2));
}
