/**
 * Mapping from slidewind shape names to OOXML DrawingML preset geometries
 * (`<a:prstGeom prst="...">`). These render as fully editable native shapes in
 * PowerPoint.
 *
 * Freeform custom geometry (points/path) is stored on the element but the
 * compiler currently approximates it with a rectangle — see ooxmlShape.ts TODO.
 */

import type { ShapeName } from "../core/types.js";

/** slidewind shape → OOXML preset name. */
export const SHAPE_PRESETS: Record<Exclude<ShapeName, "freeform">, string> = {
  rect: "rect",
  roundRect: "roundRect",
  ellipse: "ellipse",
  triangle: "triangle",
  diamond: "diamond",
  parallelogram: "parallelogram",
  hexagon: "hexagon",
  pentagon: "pentagon",
  chevron: "chevron",
  rightArrow: "rightArrow",
  leftRightArrow: "leftRightArrow",
};

/** Whether a shape preset accepts an `adj` guide list we know how to populate. */
export function presetFor(shape: ShapeName): string {
  if (shape === "freeform") return "rect"; // TODO: real freeform path compiler
  return SHAPE_PRESETS[shape];
}

/**
 * roundRect's first adjust guide `adj` is the corner radius as a fraction of
 * the shorter side, expressed in 1000ths of a percent (0..100000, but PPT caps
 * the visual at 50000 = 50%). Convert an inch radius + box size into that guide.
 */
export function roundRectAdj(radiusInches: number, boxW: number, boxH: number): number {
  const shorter = Math.max(0.0001, Math.min(boxW, boxH));
  const frac = Math.max(0, Math.min(0.5, radiusInches / shorter));
  return Math.round(frac * 100000);
}
