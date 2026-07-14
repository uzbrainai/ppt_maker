/**
 * Unit conversions. PowerPoint OOXML measures geometry in EMUs
 * (English Metric Units): 914400 EMU = 1 inch = 2.54 cm.
 *
 * PPTScene works entirely in inches; the compiler converts at the boundary.
 */

import type { SlideSize } from "./types.js";

export const EMU_PER_INCH = 914400;
export const EMU_PER_POINT = 12700; // 72 points = 1 inch
export const POINTS_PER_INCH = 72;

/** Round to a finite integer; non-finite (NaN/Infinity) → 0. OOXML needs ints. */
function safeInt(n: number): number {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** inches → EMU (rounded to integer; OOXML requires integers) */
export function emu(inches: number): number {
  return safeInt(inches * EMU_PER_INCH);
}

/** points → EMU */
export function ptToEmu(points: number): number {
  return safeInt(points * EMU_PER_POINT);
}

/** font size in points → OOXML hundredths of a point (sz attribute) */
export function fontSizeToOoxml(points: number): number {
  return Math.max(100, safeInt(points * 100)); // PowerPoint min 1pt (sz=100)
}

/** stroke width in points → EMU (line width `w` attribute) */
export function lineWidthToEmu(points: number): number {
  return Math.max(0, safeInt(points * EMU_PER_POINT));
}

export const SLIDE_SIZES: Record<"wide" | "standard", SlideSize> = {
  // 16:9
  wide: { width: 13.333, height: 7.5 },
  // 4:3
  standard: { width: 10, height: 7.5 },
};

export function slideSize(size: "wide" | "standard" | undefined): SlideSize {
  return SLIDE_SIZES[size ?? "wide"];
}
