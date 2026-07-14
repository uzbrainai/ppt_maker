import { describe, it, expect } from "vitest";
import { parsePath, pointsToPath } from "../src/geometry/svgPath.js";

describe("parsePath", () => {
  it("parses absolute move/line/close", () => {
    const segs = parsePath("M1 2 L3 4 Z");
    expect(segs).toEqual([
      { type: "M", x: 1, y: 2 },
      { type: "L", x: 3, y: 4 },
      { type: "Z" },
    ]);
  });

  it("resolves relative commands to absolute", () => {
    const segs = parsePath("m1 1 l2 0 l0 2");
    expect(segs).toEqual([
      { type: "M", x: 1, y: 1 },
      { type: "L", x: 3, y: 1 },
      { type: "L", x: 3, y: 3 },
    ]);
  });

  it("expands H and V into lineTo", () => {
    const segs = parsePath("M0 0 H5 V5");
    expect(segs).toEqual([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 5, y: 0 },
      { type: "L", x: 5, y: 5 },
    ]);
  });

  it("keeps cubic beziers", () => {
    const segs = parsePath("M0 0 C1 2 3 4 5 6");
    expect(segs[1]).toEqual({ type: "C", x1: 1, y1: 2, x2: 3, y2: 4, x: 5, y: 6 });
  });

  it("handles implicit repeated lineTo pairs after moveTo", () => {
    const segs = parsePath("M0 0 1 1 2 2");
    expect(segs).toEqual([
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 1, y: 1 },
      { type: "L", x: 2, y: 2 },
    ]);
  });

  it("converts an elliptical arc into cubic segments ending at the target point", () => {
    const segs = parsePath("M2 7 a2 2 0 0 1 2 -2");
    expect(segs[0]).toEqual({ type: "M", x: 2, y: 7 });
    // remaining segments are all cubics
    expect(segs.slice(1).every((s) => s.type === "C")).toBe(true);
    const last = segs[segs.length - 1] as Extract<(typeof segs)[number], { type: "C" }>;
    expect(last.x).toBeCloseTo(4, 1);
    expect(last.y).toBeCloseTo(5, 1);
  });

  it("parses a real lucide path (mail flap) without throwing", () => {
    const segs = parsePath("m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7");
    expect(segs[0].type).toBe("M");
    expect(segs.length).toBeGreaterThan(2);
  });
});

describe("pointsToPath", () => {
  it("builds an open polyline path", () => {
    expect(pointsToPath("0,0 1,1 2,0", false)).toBe("M0 0 L1 1 L2 0");
  });
  it("closes a polygon", () => {
    expect(pointsToPath("0,0 1,1 2,0", true)).toBe("M0 0 L1 1 L2 0 Z");
  });
});
