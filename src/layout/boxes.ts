/**
 * Box arithmetic in inches. The layout engine composes slides from these
 * primitives; the macros never compute raw coordinates themselves.
 */

import type { Box, SlideSize } from "../core/types.js";
import type { ResolvedTheme } from "../core/types.js";
import type { ResolvedClasses, SpacingKey } from "../classes/classMap.js";

/** Default safe-area margins (inches) for a content slide. */
export const DEFAULT_MARGIN = { x: 0.6, top: 0.5, bottom: 0.5 };

export function spacing(theme: ResolvedTheme, key: SpacingKey | undefined, fallback: SpacingKey = "md"): number {
  return theme.spacing[key ?? fallback];
}

/** The full slide as a box. */
export function slideBox(size: SlideSize): Box {
  return { x: 0, y: 0, w: size.width, h: size.height };
}

/** Shrink a box by equal padding on all sides. */
export function inset(box: Box, pad: number): Box {
  return { x: box.x + pad, y: box.y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad };
}

/** Shrink a box by per-side padding. */
export function insetSides(
  box: Box,
  left: number,
  top: number,
  right: number,
  bottom: number
): Box {
  return {
    x: box.x + left,
    y: box.y + top,
    w: box.w - left - right,
    h: box.h - top - bottom,
  };
}

/** The safe content area of a slide, honoring a `safe-*` class override. */
export function contentArea(
  size: SlideSize,
  theme: ResolvedTheme,
  tokens: ResolvedClasses
): Box {
  const m = tokens.safe ? theme.spacing[tokens.safe] : 0;
  const left = DEFAULT_MARGIN.x + m;
  const right = DEFAULT_MARGIN.x + m;
  const top = DEFAULT_MARGIN.top + m;
  const bottom = DEFAULT_MARGIN.bottom + m;
  return insetSides(slideBox(size), left, top, right, bottom);
}

/** Reserve a title band at the top; return {title, rest}. */
export function reserveTitle(area: Box, titleHeight: number, gap: number): { title: Box; rest: Box } {
  const title: Box = { x: area.x, y: area.y, w: area.w, h: titleHeight };
  const rest: Box = {
    x: area.x,
    y: area.y + titleHeight + gap,
    w: area.w,
    h: area.h - titleHeight - gap,
  };
  return { title, rest };
}

/** Split a box horizontally into `n` equal columns separated by `gap`. */
export function columns(box: Box, n: number, gap: number): Box[] {
  const totalGap = gap * (n - 1);
  const w = (box.w - totalGap) / n;
  const out: Box[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: box.x + i * (w + gap), y: box.y, w, h: box.h });
  }
  return out;
}

/** Split a box vertically into `n` equal rows separated by `gap`. */
export function rows(box: Box, n: number, gap: number): Box[] {
  const totalGap = gap * (n - 1);
  const h = (box.h - totalGap) / n;
  const out: Box[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: box.x, y: box.y + i * (h + gap), w: box.w, h });
  }
  return out;
}

/** Two-column split by left ratio. */
export function split(box: Box, ratio: number, gap: number): [Box, Box] {
  const leftW = (box.w - gap) * ratio;
  const rightW = box.w - gap - leftW;
  return [
    { x: box.x, y: box.y, w: leftW, h: box.h },
    { x: box.x + leftW + gap, y: box.y, w: rightW, h: box.h },
  ];
}

/** Center a box of size w×h within `area`. */
export function center(area: Box, w: number, h: number): Box {
  return {
    x: area.x + (area.w - w) / 2,
    y: area.y + (area.h - h) / 2,
    w,
    h,
  };
}
