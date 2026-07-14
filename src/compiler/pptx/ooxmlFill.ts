/**
 * Fill compilation: FillSpec → DrawingML `<a:*Fill>` fragments.
 *
 *  - solid          → <a:solidFill>
 *  - linearGradient → <a:gradFill> with <a:lin>
 *  - radialGradient → <a:gradFill> with <a:path path="circle"> (closest native
 *                     equivalent), or solid fallback per spec.
 *  - none           → <a:noFill>
 */

import type { FillSpec, GradientStop } from "../../core/types.js";
import { alphaToOoxml, angleToOoxml, rgbHexToOoxml } from "../../core/color.js";

/** <a:srgbClr> with optional alpha child. */
export function srgbClr(color: string, opacity?: number): string {
  const val = rgbHexToOoxml(color);
  if (opacity === undefined || opacity >= 1) {
    return `<a:srgbClr val="${val}"/>`;
  }
  return `<a:srgbClr val="${val}"><a:alpha val="${alphaToOoxml(opacity)}"/></a:srgbClr>`;
}

function gsList(stops: GradientStop[]): string {
  const sorted = [...stops].sort((a, b) => a.pos - b.pos);
  const items = sorted
    .map((s) => {
      const pos = Math.round(Math.max(0, Math.min(1, s.pos)) * 100000);
      return `<a:gs pos="${pos}">${srgbClr(s.color, s.opacity)}</a:gs>`;
    })
    .join("");
  return `<a:gsLst>${items}</a:gsLst>`;
}

/**
 * Compile a FillSpec. `fallbackSolid` is used when a radialGradient requests a
 * solid fallback (i.e. when not emitting the path gradient).
 */
export function fillToOoxml(fill: FillSpec | undefined): string {
  if (!fill) return "";
  switch (fill.type) {
    case "none":
      return "<a:noFill/>";
    case "solid":
      return `<a:solidFill>${srgbClr(fill.color, fill.opacity)}</a:solidFill>`;
    case "linearGradient": {
      const ang = angleToOoxml(fill.angle);
      return `<a:gradFill rotWithShape="1">${gsList(fill.stops)}<a:lin ang="${ang}" scaled="1"/></a:gradFill>`;
    }
    case "pattern":
      return (
        `<a:pattFill prst="${fill.preset}">` +
        `<a:fgClr>${srgbClr(fill.fg, fill.fgOpacity)}</a:fgClr>` +
        `<a:bgClr>${srgbClr(fill.bg)}</a:bgClr>` +
        `</a:pattFill>`
      );
    case "radialGradient": {
      // Native path gradient ("circle") is the closest editable equivalent.
      // PowerPoint renders this as a radial-style fill emanating from a focus
      // rectangle. We center the focus per cx/cy.
      const cx = clampPct(fill.cx ?? 0.5);
      const cy = clampPct(fill.cy ?? 0.5);
      // fillToRect expresses the focus rectangle as insets from each edge.
      const l = cx;
      const t = cy;
      const r = 100000 - cx;
      const b = 100000 - cy;
      return (
        `<a:gradFill rotWithShape="1">${gsList(fill.stops)}` +
        `<a:path path="circle"><a:fillToRect l="${l}" t="${t}" r="${r}" b="${b}"/></a:path>` +
        `</a:gradFill>`
      );
    }
  }
}

function clampPct(n: number): number {
  return Math.round(Math.max(0, Math.min(1, n)) * 100000);
}

/** Solid fallback color extraction for previews / radial solid fallback. */
export function representativeColor(fill: FillSpec | undefined): string | undefined {
  if (!fill) return undefined;
  switch (fill.type) {
    case "solid":
      return fill.color;
    case "pattern":
      return fill.bg;
    case "linearGradient":
    case "radialGradient":
      return fill.stops[fill.stops.length - 1]?.color ?? fill.stops[0]?.color;
    case "none":
      return undefined;
  }
}
