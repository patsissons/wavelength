import { describe, expect, it } from "vitest";
import {
  AIM,
  arcLayout,
  arenaLayout,
  pickTarget,
  velocityOf,
  type Target,
} from "./aim";

describe("arcLayout", () => {
  it("spaces players evenly along the semicircle with end gaps", () => {
    const pts = arcLayout(3, 100, 200, 100);
    expect(pts).toHaveLength(3);
    // Equal arc spacing: 45° apart, so x = cx ± r·cos 45°, top at the apex.
    expect(pts[0]!.x).toBeCloseTo(100 - 100 * Math.SQRT1_2, 5);
    expect(pts[1]).toEqual({ x: 100, y: 100 });
    expect(pts[2]!.x).toBeCloseTo(100 + 100 * Math.SQRT1_2, 5);
    // Everyone is the same distance from the thrower.
    for (const p of pts) {
      expect(Math.hypot(p.x - 100, p.y - 200)).toBeCloseTo(100, 5);
      expect(p.y).toBeLessThan(200);
    }
    expect(arcLayout(0, 0, 0, 10)).toEqual([]);
    expect(arcLayout(1, 0, 0, 10)[0]!.x).toBeCloseTo(0, 5);
  });

  it("fits the arena into the body with room for the tray", () => {
    const { cx, cy, r, points } = arenaLayout(390, 600, 4);
    expect(cx).toBe(195);
    expect(cy).toBeLessThan(600 - 84);
    expect(r).toBeLessThanOrEqual(cx - 44);
    expect(points).toHaveLength(4);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("velocityOf", () => {
  it("measures px/ms over the recent window", () => {
    expect(velocityOf([])).toEqual({ x: 0, y: 0 });
    expect(velocityOf([{ x: 0, y: 0, t: 0 }])).toEqual({ x: 0, y: 0 });
    const v = velocityOf([
      { x: 0, y: 0, t: 0 }, // too old: outside the 120 ms window
      { x: 0, y: 500, t: 1000 },
      { x: 0, y: 500, t: 1050 },
      { x: 100, y: 400, t: 1100 },
    ]);
    expect(v.x).toBeCloseTo(1, 5);
    expect(v.y).toBeCloseTo(-1, 5);
  });

  it("treats an instantaneous move as a hard flick", () => {
    const v = velocityOf([
      { x: 0, y: 0, t: 5 },
      { x: 10, y: -20, t: 5 },
    ]);
    expect(v).toEqual({ x: 100, y: -200 });
    expect(
      velocityOf([
        { x: 3, y: 3, t: 5 },
        { x: 3, y: 3, t: 5 },
      ]),
    ).toEqual({ x: 0, y: 0 });
  });
});

describe("pickTarget", () => {
  const targets: Target[] = [
    { id: "left", x: 50, y: 100 },
    { id: "top", x: 200, y: 50 },
    { id: "right", x: 350, y: 100 },
  ];
  const you = { x: 200, y: 300 };

  it("hits the player the emoji was dropped on", () => {
    expect(pickTarget({ x: 60, y: 110 }, { x: 0, y: 0 }, targets)).toBe("left");
    expect(pickTarget({ x: 340, y: 90 }, { x: 0.1, y: 0 }, targets)).toBe(
      "right",
    );
  });

  it("aims a flick by direction", () => {
    expect(pickTarget(you, { x: 0, y: -2 }, targets)).toBe("top");
    expect(pickTarget(you, { x: -1.5, y: -2 }, targets)).toBe("left");
    expect(pickTarget(you, { x: 1.5, y: -2 }, targets)).toBe("right");
  });

  it("misses on a slow release, a wild angle or a throw away from everyone", () => {
    expect(pickTarget(you, { x: 0, y: -0.1 }, targets)).toBeNull();
    expect(pickTarget(you, { x: 0, y: 2 }, targets)).toBeNull();
    expect(pickTarget(you, { x: 3, y: 0 }, targets)).toBeNull();
    expect(pickTarget(you, { x: 0, y: -2 }, [])).toBeNull();
    expect(
      pickTarget(you, { x: 0, y: -2 }, targets, {
        ...AIM,
        maxAngle: 0.001,
      }),
    ).toBe("top");
  });
});
