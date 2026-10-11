import { describe, expect, it } from "vitest";
import {
  CX,
  CY,
  R,
  SEGMENT,
  WEDGE_HALF,
  clampTarget,
  discAngleForTarget,
  discAngleToPosition,
  normalizeAngle,
  pointToPosition,
  positionToAngle,
  positionToPoint,
  randomTarget,
  sectorPath,
  spinAngleAt,
  spinDelta,
  spinParams,
  wedgeSectors,
} from "./geometry";

const close = (a: number, b: number, digits = 6) =>
  expect(a).toBeCloseTo(b, digits);

describe("positions and angles", () => {
  it("maps the ends and the top of the arc", () => {
    close(positionToAngle(0), Math.PI);
    close(positionToAngle(0.5), Math.PI / 2);
    close(positionToAngle(1), 0);
  });

  it("places points on the arc", () => {
    const left = positionToPoint(0);
    close(left.x, CX - R);
    close(left.y, CY);
    const top = positionToPoint(0.5);
    close(top.x, CX);
    close(top.y, CY - R);
    const right = positionToPoint(1);
    close(right.x, CX + R);
    close(right.y, CY);
  });

  it("round-trips point → position", () => {
    for (const p of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const { x, y } = positionToPoint(p, 120);
      close(pointToPosition(x, y), p);
    }
  });

  it("pins positions below the baseline to the nearest end", () => {
    expect(pointToPosition(CX - 50, CY + 40)).toBe(0);
    expect(pointToPosition(CX + 50, CY + 40)).toBe(1);
  });
});

describe("targets and wedges", () => {
  it("keeps the wedge inside the window", () => {
    close(clampTarget(0), WEDGE_HALF);
    close(clampTarget(1), 1 - WEDGE_HALF);
    close(clampTarget(0.5), 0.5);
    close(
      randomTarget(() => 0),
      WEDGE_HALF,
    );
    close(
      randomTarget(() => 0.999999),
      1 - WEDGE_HALF,
      4,
    );
  });

  it("builds five contiguous sectors centred on the target", () => {
    const sectors = wedgeSectors(0.5);
    expect(sectors.map((s) => s.score)).toEqual([2, 3, 4, 3, 2]);
    close(sectors[2]!.p0, 0.5 - SEGMENT / 2);
    close(sectors[2]!.p1, 0.5 + SEGMENT / 2);
    for (let i = 1; i < sectors.length; i++) {
      close(sectors[i]!.p0, sectors[i - 1]!.p1);
    }
    close(sectors[0]!.p0, 0.5 - WEDGE_HALF);
    close(sectors[4]!.p1, 0.5 + WEDGE_HALF);
  });

  it("emits a closed SVG sector path", () => {
    const path = sectorPath(0.4, 0.6, 100, 180);
    expect(path.startsWith("M ")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path.match(/A /g)).toHaveLength(2);
  });
});

describe("spin", () => {
  it("derives direction, turns and duration from the flick", () => {
    expect(spinParams(30)).toEqual({
      direction: 1,
      turns: 4,
      durationMs: 1400 + 450 * 4,
    });
    expect(spinParams(-2).direction).toBe(-1);
    expect(spinParams(-2).turns).toBe(1);
    expect(spinParams(999).turns).toBe(5);
  });

  it("lands exactly on the target after the requested turns", () => {
    for (const target of [0.2, 0.5, 0.83]) {
      for (const direction of [1, -1] as const) {
        const from = 1.234;
        const to = discAngleForTarget(target);
        const delta = spinDelta(from, to, direction, 3);
        expect(Math.sign(delta)).toBe(direction);
        expect(Math.abs(delta)).toBeGreaterThanOrEqual(Math.PI * 2 * 3);
        expect(Math.abs(delta)).toBeLessThan(Math.PI * 2 * 4);
        const final = spinAngleAt(from, delta, 1);
        close(normalizeAngle(final), to);
        close(discAngleToPosition(final), target);
      }
    }
  });

  it("starts where it was and eases out", () => {
    expect(spinAngleAt(2, 10, 0)).toBe(2);
    expect(spinAngleAt(2, 10, 0.5)).toBeGreaterThan(2 + 10 * 0.5);
  });
});
