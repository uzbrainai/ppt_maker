/**
 * Shared helpers for macro expanders: background fills from class tokens,
 * accent color resolution, card styling, and conservative text fitting.
 */

import type {
  Box,
  FillSpec,
  ImageSpec,
  PPTElement,
  ResolvedTheme,
  ShadowSpec,
  ShapeStyle,
  TextStyle,
} from "../core/types.js";
import type { ResolvedClasses } from "../classes/classMap.js";
import { tint, shade, luminance, mix, readableOn, type ReadableSet } from "../core/color.js";
import { palette, paletteColor } from "../core/palette.js";
import { buildIcon } from "../geometry/icons.js";
import type { Warnings } from "../validation/warnings.js";

/**
 * Render an image into `box` — or a tidy theme-tinted placeholder (rounded panel
 * + a muted image glyph) when no image bytes are present. Lets every image
 * container lay out identically with or without a generated picture.
 */
export function imageContainer(
  spec: ImageSpec | undefined,
  box: Box,
  theme: ResolvedTheme,
  opts: { fit?: "cover" | "contain"; radius?: number } = {}
): PPTElement[] {
  const radius = opts.radius ?? theme.radius.lg;
  if (spec?.data && spec.data.length) {
    return [{ id: uid("img"), type: "image", box: { ...box }, data: spec.data, fit: opts.fit ?? "cover", radius, alt: spec.alt }];
  }
  const dark = luminance(theme.colors.background) < 0.4;
  const fill = mix(theme.colors.background, theme.colors.text, dark ? 0.1 : 0.06);
  const els: PPTElement[] = [
    { id: uid("imgph"), type: "shape", shape: "roundRect", box: { ...box }, style: { fill: { type: "solid", color: fill }, stroke: { color: theme.colors.border, width: 1 }, radius } },
  ];
  const s = Math.max(0.4, Math.min(box.w, box.h) * 0.2);
  const { elements } = buildIcon("image", { x: box.x + (box.w - s) / 2, y: box.y + (box.h - s) / 2, w: s, h: s }, { color: theme.colors.textMuted, strokeWidth: 2 });
  els.push(...elements);
  return els;
}

/** A semi-transparent overlay so text stays readable over a full-bleed image. */
export function scrim(box: Box, dark: boolean, opacity = dark ? 0.5 : 0.42): PPTElement {
  return {
    id: uid("scrim"),
    type: "shape",
    shape: "rect",
    box: { ...box },
    style: { fill: { type: "solid", color: "#000000", opacity } },
  };
}

let idCounter = 0;
export function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * Color-named accent classes are interpreted as THEME-RELATIVE slots, not
 * absolute hues — so `accent-blue` / `accent-purple` pick distinct colors from
 * the active theme's palette instead of fixed brand hexes. This keeps every
 * slide on-theme while still letting different slides differ from each other.
 */
const ACCENT_SLOT: Record<string, number> = {
  blue: 0, // theme primary
  purple: 1, // theme accent
  teal: 2,
  pink: 3,
  orange: 4,
  green: 5,
};

/** Accent class → theme-derived hex; "multi" and unset fall back to theme accent. */
export function accentColor(tokens: ResolvedClasses, theme: ResolvedTheme): string {
  if (tokens.accent && tokens.accent !== "multi") {
    const slot = ACCENT_SLOT[tokens.accent];
    return slot === undefined ? theme.colors.accent : paletteColor(theme, slot);
  }
  return theme.colors.accent;
}

/**
 * Color for the i-th card/item. When `colorful` (or accent "multi") is set,
 * each item draws a distinct color from the palette tool; otherwise the single
 * resolved accent is used throughout.
 */
export function itemColor(
  tokens: ResolvedClasses,
  theme: ResolvedTheme,
  index: number
): string {
  if (tokens.colorful || tokens.accent === "multi") {
    return palette(theme, index + 1, undefined)[index];
  }
  return accentColor(tokens, theme);
}

/**
 * Assign a color to each item, honoring grouping.
 *
 *  - Single-accent decks: every item uses the one accent color.
 *  - Colorful / multi decks: each item gets the next palette color, EXCEPT
 *    items that share a `group` key, which all get one identical color (the lib
 *    picks it from the palette). This keeps a "family" of related cards visually
 *    unified while still distinguishing unrelated ones.
 */
export function groupColors(
  items: Array<{ group?: string }>,
  tokens: ResolvedClasses,
  theme: ResolvedTheme
): string[] {
  if (!(tokens.colorful || tokens.accent === "multi")) {
    const accent = accentColor(tokens, theme);
    return items.map(() => accent);
  }
  // Pre-size the palette to the number of distinct color slots needed.
  const distinct = new Set<string>();
  let ungrouped = 0;
  for (const it of items) {
    if (it.group) distinct.add(it.group);
    else ungrouped += 1;
  }
  const pal = palette(theme, distinct.size + ungrouped + 1, undefined);
  const groupColor = new Map<string, string>();
  let next = 0;
  return items.map((it) => {
    if (it.group) {
      let c = groupColor.get(it.group);
      if (!c) {
        c = pal[next++ % pal.length];
        groupColor.set(it.group, c);
      }
      return c;
    }
    return pal[next++ % pal.length];
  });
}

/** Pick a text color that reads on the given background. */
export function onColor(bg: string): string {
  return luminance(bg) > 0.55 ? "#0F172A" : "#FFFFFF";
}

/** Representative solid color of a (possibly gradient) fill, for contrast math. */
export function bgColor(fill: FillSpec | undefined, fallback: string): string {
  if (!fill) return fallback;
  if (fill.type === "solid") return fill.color;
  if (fill.type === "pattern") return fill.bg;
  if (fill.type === "none") return fallback;
  const stops = fill.stops;
  if (!stops.length) return fallback;
  // Mid-mix of the endpoints approximates the average background tone.
  return mix(stops[0].color, stops[stops.length - 1].color, 0.5);
}

/** Readable heading/body/caption colors for content over a background fill. */
export function readableColors(fill: FillSpec | undefined, fallback: string): ReadableSet {
  return readableOn(bgColor(fill, fallback));
}

/**
 * A heading block with a small uppercase eyebrow, a vertical accent bar, and a
 * big contrast-aware title (the look from a polished timeline/section header).
 * Returns the elements and the y-coordinate just below the block.
 */
export function eyebrowHeader(
  area: Box,
  opts: {
    eyebrow?: string;
    title?: string;
    bg: FillSpec | undefined;
    accent: string;
    theme: ResolvedTheme;
    warnings?: Warnings;
    where?: string;
  }
): { elements: PPTElement[]; bottom: number } {
  const { theme } = opts;
  const elements: PPTElement[] = [];
  const readable = readableColors(opts.bg, theme.colors.background);
  const eyebrowColor = ensureReadableOn(opts.accent, opts.bg, theme);
  const hasEyebrow = !!opts.eyebrow;
  const titleH = 0.95;
  const eyebrowH = hasEyebrow ? 0.3 : 0;
  const blockH = eyebrowH + titleH;
  const textX = area.x + 0.28;

  // vertical accent bar
  elements.push({
    id: uid("hbar"),
    type: "shape",
    shape: "roundRect",
    box: { x: area.x, y: area.y + 0.04, w: 0.11, h: blockH - 0.08 },
    style: { fill: { type: "solid", color: opts.accent }, radius: theme.radius.pill },
  });

  if (hasEyebrow) {
    elements.push({
      id: uid("eyebrow"),
      type: "text",
      box: { x: textX, y: area.y, w: area.w - 0.28, h: eyebrowH },
      text: opts.eyebrow!.toUpperCase(),
      style: { ...theme.typography.caption, size: 12, bold: true, color: eyebrowColor, align: "left", vAlign: "middle", letterSpacing: 1.2 },
      padding: 0.01,
    });
  }
  if (opts.title) {
    const base = { ...theme.typography.h1, size: 34, color: readable.strong, align: "left" as const };
    const fit = fitText(opts.title, { boxW: area.w - 0.28, boxH: titleH, padding: 0.02, base, minFontSize: 22, maxLines: 2 }, opts.warnings, opts.where);
    elements.push({
      id: uid("htitle"),
      type: "text",
      box: { x: textX, y: area.y + eyebrowH, w: area.w - 0.28, h: titleH },
      text: fit.text,
      style: { ...fit.style, vAlign: "middle" },
      padding: 0.02,
    });
  }

  return { elements, bottom: area.y + blockH };
}

/** Accent color adjusted to be readable on a background fill. */
function ensureReadableOn(accent: string, bg: FillSpec | undefined, theme: ResolvedTheme): string {
  const b = bgColor(bg, theme.colors.background);
  const dark = luminance(b) < 0.45;
  // On dark backgrounds, lighten the accent so it pops; else use as-is.
  return dark ? tint(accent, 0.35) : accent;
}

/**
 * A note / callout / summary block: a rounded panel with a left accent bar and
 * an optional bold label followed by text. Used for roadmap callouts and the
 * card-slide summary that fills freed whitespace.
 */
export function noteBlock(
  box: Box,
  opts: {
    label?: string;
    text: string;
    color: string;
    theme: ResolvedTheme;
    warnings?: Warnings;
    where?: string;
  }
): PPTElement[] {
  const { theme, color } = opts;
  const dark = luminance(theme.colors.background) < 0.4;
  // Dark: a panel clearly lifted above the (near-black) background tinted toward
  // the accent. Light: a soft accent tint. Both stay readable.
  const fill = dark ? mix(theme.colors.background, color, 0.16) : tint(color, 0.9);
  const labelColor = dark ? tint(color, 0.45) : shade(color, 0.05);
  const textColor = dark ? "#FFFFFF" : theme.colors.text;
  const elements: PPTElement[] = [];

  elements.push({
    id: uid("note"),
    type: "shape",
    shape: "roundRect",
    box: { ...box },
    style: { fill: { type: "solid", color: fill }, radius: theme.radius.lg },
  });
  // left accent bar
  elements.push({
    id: uid("notebar"),
    type: "shape",
    shape: "roundRect",
    box: { x: box.x, y: box.y, w: 0.1, h: box.h },
    style: { fill: { type: "solid", color }, radius: theme.radius.pill },
  });

  const padX = theme.spacing.lg;
  const padY = theme.spacing.sm;
  const textBox = { x: box.x + padX, y: box.y + padY, w: box.w - padX - theme.spacing.md, h: box.h - padY * 2 };
  const base = { ...theme.typography.body, size: 14, color: textColor, align: "left" as const };
  const maxLines = Math.max(1, Math.floor((textBox.h * 72) / (base.size * 1.25)));
  const labelTxt = opts.label ? `${opts.label}  ` : "";
  // Render label + text as a single paragraph (label bolded via a leading run is
  // not supported by our single-run text element, so emphasize via color size).
  const fit = fitText(labelTxt + opts.text, { boxW: textBox.w, boxH: textBox.h, padding: 0.02, base, minFontSize: 10, maxLines }, opts.warnings, opts.where);
  if (opts.label) {
    // label chip on its own line color
    elements.push({
      id: uid("notelbl"),
      type: "text",
      box: { x: textBox.x, y: textBox.y, w: 1.4, h: textBox.h },
      text: opts.label,
      style: { ...theme.typography.bodyStrong, size: 14, color: labelColor, align: "left", vAlign: "middle" },
      padding: 0.02,
      noWrap: true,
    });
    const offset = Math.min(2.0, 0.34 + opts.label.length * 0.1);
    const tb = { x: textBox.x + offset, y: textBox.y, w: textBox.w - offset, h: textBox.h };
    const tf = fitText(opts.text, { boxW: tb.w, boxH: tb.h, padding: 0.02, base, minFontSize: 10, maxLines }, opts.warnings, opts.where);
    elements.push({ id: uid("notetx"), type: "text", box: tb, text: tf.text, style: { ...tf.style, vAlign: "middle" }, padding: 0.02 });
  } else {
    elements.push({ id: uid("notetx"), type: "text", box: textBox, text: fit.text, style: { ...fit.style, vAlign: "middle" }, padding: 0.02 });
  }
  return elements;
}

/**
 * Turn a background class token into a slide FillSpec. Radial gradients are
 * supported in the abstraction; the compiler falls back to a path/solid fill.
 */
export function backgroundFill(
  tokens: ResolvedClasses,
  theme: ResolvedTheme,
  warnings?: Warnings,
  where?: string
): FillSpec {
  const c = theme.colors;
  switch (tokens.background) {
    case "muted":
      return { type: "solid", color: c.backgroundMuted };
    case "dark":
      return { type: "solid", color: shade(c.primaryDark, 0.4) };
    case "gradient-soft":
      return {
        type: "linearGradient",
        angle: 135,
        stops: [
          { color: c.background, pos: 0 },
          { color: tint(c.primary, 0.86), pos: 1 },
        ],
      };
    case "gradient-primary":
      return {
        type: "linearGradient",
        angle: 135,
        stops: [
          { color: c.primaryDark, pos: 0 },
          { color: c.primary, pos: 1 },
        ],
      };
    case "gradient-radial-soft":
      warnings?.add(
        "radial-gradient-fallback",
        "Radial gradient compiled via OOXML path gradient; appearance may differ from browsers.",
        where
      );
      return {
        type: "radialGradient",
        cx: 0.5,
        cy: 0.35,
        r: 0.75,
        stops: [
          { color: tint(c.primary, 0.8), pos: 0 },
          { color: c.background, pos: 1 },
        ],
        fallback: "solid",
      };
    case "clean":
      return { type: "solid", color: c.background };
    default:
      return { type: "solid", color: c.background };
  }
}

export interface CardLook {
  style: ShapeStyle;
  /** text color that reads on the card surface */
  textColor: string;
  mutedTextColor: string;
}

/**
 * Resolve a card's fill/stroke/shadow from variant + theme. When `color` is
 * supplied (the card's accent), the `tinted` variant uses it for a soft tinted
 * background and matching border.
 */
export function cardLook(
  tokens: ResolvedClasses,
  theme: ResolvedTheme,
  color?: string
): CardLook {
  const c = theme.colors;
  const variant = tokens.card?.variant ?? (tokens.elevated || tokens.useCards ? "elevated" : "flat");
  const radius = theme.radius.lg;
  let fill: FillSpec = { type: "solid", color: c.surface };
  let strokeColor: string | undefined = c.border;
  let shadow: ShadowSpec = theme.shadows.none;
  let textColor = c.text;
  let mutedTextColor = c.textMuted;

  switch (variant) {
    case "flat":
      strokeColor = undefined;
      fill = { type: "solid", color: c.surface };
      break;
    case "outline":
      strokeColor = c.border;
      shadow = theme.shadows.none;
      break;
    case "muted":
      fill = { type: "solid", color: c.surfaceMuted };
      strokeColor = undefined;
      break;
    case "elevated":
      shadow = theme.shadows.md;
      strokeColor = c.border;
      break;
    case "tinted": {
      const dark = luminance(c.background) < 0.4;
      const base = color ?? c.primary;
      fill = { type: "solid", color: dark ? shade(base, 0.62) : tint(base, 0.9) };
      strokeColor = dark ? shade(base, 0.4) : tint(base, 0.62);
      textColor = dark ? "#F8FAFC" : shade(base, 0.45);
      mutedTextColor = dark ? c.textMuted : shade(base, 0.2);
      break;
    }
  }
  if (tokens.elevated && variant !== "elevated") {
    shadow = theme.shadows.md;
  }

  return {
    style: {
      fill,
      stroke: strokeColor ? { color: strokeColor, width: 1 } : undefined,
      radius,
      shadow,
    },
    textColor,
    mutedTextColor,
  };
}

/** Density → multiplier applied to base font sizes inside content blocks. */
export function densityScale(tokens: ResolvedClasses): number {
  switch (tokens.density) {
    case "low":
      return 1.12;
    case "high":
      return 0.88;
    case "medium":
    default:
      return 1;
  }
}

/** Length hint → maximum line budget. */
export function lenToLines(len: import("../core/types.js").LenHint): number {
  switch (len) {
    case "xs":
      return 1;
    case "sm":
      return 2;
    case "md":
      return 3;
    case "lg":
      return 5;
    case "xl":
      return 8;
  }
}

/**
 * Conservative, container-aware text fitting.
 *
 * 1. Shrink the font (down to minFontSize) until the text plausibly fits the
 *    box height and the allowed line budget.
 * 2. GUARANTEE containment: if it still doesn't fit at the minimum size, the
 *    text is truncated (word-aware, with an ellipsis) to the line budget the box
 *    can actually show — so an over-long LLM string never overflows the shape.
 *
 * The line budget is the strictest of: explicit `maxLines`, the `len` hint, and
 * what physically fits in the box height. NOT pixel-accurate; pessimistic on
 * purpose. TODO: calibrate against the real PowerPoint text engine.
 */
export interface FitOptions {
  boxW: number;
  boxH: number;
  padding: number;
  base: TextStyle;
  minFontSize?: number;
  maxLines?: number;
  /** author length hint (overridden by explicit maxLines) */
  len?: import("../core/types.js").LenHint;
}

export interface FitResult {
  style: TextStyle;
  /** the text to render — possibly truncated to fit the container */
  text: string;
}

const GLYPH_W = 0.52 / 72; // avg glyph advance (inch per point)

export function fitText(
  text: string,
  opts: FitOptions,
  warnings?: Warnings,
  where?: string
): FitResult {
  const min = opts.minFontSize ?? Math.max(8, opts.base.size * 0.6);
  const availW = Math.max(0.1, opts.boxW - opts.padding * 2);
  const availH = Math.max(0.1, opts.boxH - opts.padding * 2);
  const lineSpacing = opts.base.lineSpacing ?? 1.15;

  // How many lines can the box physically show at the minimum font size?
  const heightLinesAtMin = Math.max(1, Math.floor(availH / ((min * lineSpacing) / 72)));
  const requested = opts.maxLines ?? (opts.len ? lenToLines(opts.len) : Infinity);
  const lineCap = Math.max(1, Math.min(requested, heightLinesAtMin));

  let size = opts.base.size;
  for (;;) {
    const charsPerLine = Math.max(1, Math.floor(availW / (size * GLYPH_W)));
    const lines = estimateLines(text, charsPerLine);
    const lineHeightIn = (size * lineSpacing) / 72;
    const withinHeight = lines * lineHeightIn <= availH;
    const withinLines = lines <= lineCap;
    if ((withinHeight && withinLines) || size <= min) break;
    size = Math.max(min, size - 1);
  }

  const finalSize = Math.round(size * 10) / 10;
  const charsPerLine = Math.max(1, Math.floor(availW / (finalSize * GLYPH_W)));
  let out = text;
  if (estimateLines(text, charsPerLine) > lineCap) {
    out = clampToLines(text, charsPerLine, lineCap);
    warnings?.add(
      "text-overflow-risk",
      `Text truncated to fit its container (${lineCap} line${lineCap === 1 ? "" : "s"}): "${truncate(text)}"`,
      where
    );
  }

  return { style: { ...opts.base, size: finalSize }, text: out };
}

/** Truncate word-aware to at most `maxLines` of `charsPerLine`, adding "…". */
function clampToLines(text: string, charsPerLine: number, maxLines: number): string {
  const budget = Math.max(1, charsPerLine * maxLines - 1);
  if (text.length <= budget) return text;
  const slice = text.slice(0, budget);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > budget * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.replace(/[\s,;:.\-]+$/, "") + "…";
}

function estimateLines(text: string, charsPerLine: number): number {
  // word-aware wrap estimate
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  let lines = 1;
  let col = 0;
  for (const w of words) {
    const add = (col === 0 ? 0 : 1) + w.length;
    if (col + add > charsPerLine) {
      lines += 1;
      col = w.length;
    } else {
      col += add;
    }
  }
  return lines;
}

function truncate(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
