/**
 * Editable vector charts.
 *
 * Charts are built from native, editable PowerPoint primitives — rectangles
 * (bars), ellipses (scatter dots, donut), connectors (axes), and freeform
 * `<a:custGeom>` paths (lines, areas, donut sectors). They are NOT raster images
 * and NOT native `c:chart` parts (which embed a workbook); see the README
 * roadmap. Every series color comes from the palette tool, so charts match the
 * rest of the deck.
 *
 * All geometry is in inches within the provided box. Freeform paths are emitted
 * by building an SVG path string and parsing it (reusing the arc→bézier +
 * custGeom pipeline in svgPath.ts / ooxmlShape.ts).
 */

import type { PPTElement, ResolvedTheme, ShapeElement, TextStyle } from "../core/types.js";
import { parsePath } from "./svgPath.js";
import { tint, luminance } from "../core/color.js";

/** Ink or white, whichever reads on the given fill color. */
function onFill(color: string): string {
  return luminance(color) > 0.6 ? "#0F172A" : "#FFFFFF";
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

export interface ChartSeries {
  name?: string;
  color?: string;
  /** y values aligned to categories (line/area/bar) */
  data?: number[];
  /** raw points (scatter) */
  points?: Array<{ x: number; y: number }>;
}

export interface ChartOptions {
  theme: ResolvedTheme;
  /** palette colors to cycle through */
  colors: string[];
  type: "bar" | "barh" | "line" | "area" | "scatter" | "donut";
  /** category labels (bar/line/area) */
  categories?: string[];
  showValues?: boolean;
  /** fill segments with thin white patterns (distinct per segment) */
  pattern?: boolean;
}

let n = 0;
const id = (p: string) => `${p}-${++n}`;

const VB = 1000; // path coordinate units per inch (custGeom precision)

/** Thin, distinct patterns cycled per segment (lines, dots, zebra). */
const PATTERN_PRESETS = ["ltUpDiag", "ltHorz", "ltVert", "dotGrid", "ltDnDiag", "smGrid", "wdUpDiag", "pct20"];

/** Fill for chart segment i: a pattern over the color, or a solid color. */
function segFill(color: string, i: number, pattern: boolean | undefined): import("../core/types.js").FillSpec {
  if (!pattern) return { type: "solid", color };
  return { type: "pattern", preset: PATTERN_PRESETS[i % PATTERN_PRESETS.length], fg: "#FFFFFF", bg: color, fgOpacity: 0.55 };
}

function axisStroke(theme: ResolvedTheme) {
  return { color: theme.colors.border, width: 1 } as const;
}
function gridStroke(theme: ResolvedTheme) {
  return { color: tint(theme.colors.border, 0.3), width: 0.75 } as const;
}
function labelStyle(theme: ResolvedTheme, size = 10): TextStyle {
  return { ...theme.typography.caption, size, color: theme.colors.textMuted, align: "center", vAlign: "middle" };
}

/** Round a max value up to a "nice" number for axis ticks. */
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n1 = max / pow;
  const nice = n1 <= 1 ? 1 : n1 <= 2 ? 2 : n1 <= 5 ? 5 : 10;
  return nice * pow;
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + "k";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** A freeform shape from an SVG path string in `box` local space (inches→VB). */
function freeform(
  box: Box,
  path: string,
  opts: { fill?: string; fillSpec?: import("../core/types.js").FillSpec; stroke?: { color: string; width: number }; opacity?: number; filled: boolean }
): ShapeElement {
  const fill = opts.fillSpec
    ? opts.fillSpec
    : opts.fill
      ? ({ type: "solid", color: opts.fill, opacity: opts.opacity } as const)
      : ({ type: "none" } as const);
  return {
    id: id("chart-pt"),
    type: "shape",
    shape: "freeform",
    box: { ...box },
    style: {
      fill,
      stroke: opts.stroke ? { ...opts.stroke, round: true } : undefined,
    },
    geometry: { segments: parsePath(path), viewBox: { w: box.w * VB, h: box.h * VB }, filled: opts.filled, path },
  };
}

/** Plot frame: inner plot box + axis lines + y gridlines/ticks + x labels. */
function frame(box: Box, opts: ChartOptions, maxY: number, categories: string[]): { plot: Box; elements: PPTElement[] } {
  const theme = opts.theme;
  const left = 0.55;
  const bottom = 0.45;
  const top = 0.2;
  const right = 0.2;
  const plot: Box = { x: box.x + left, y: box.y + top, w: box.w - left - right, h: box.h - top - bottom };
  const elements: PPTElement[] = [];

  // Y gridlines + tick labels.
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = (maxY / ticks) * i;
    const y = plot.y + plot.h - (i / ticks) * plot.h;
    elements.push({
      id: id("grid"),
      type: "line",
      box: { x: plot.x, y, w: plot.w, h: 0 },
      from: { x: plot.x, y },
      to: { x: plot.x + plot.w, y },
      stroke: i === 0 ? axisStroke(theme) : gridStroke(theme),
    });
    elements.push({
      id: id("ytick"),
      type: "text",
      box: { x: box.x, y: y - 0.12, w: left - 0.08, h: 0.24 },
      text: fmt(v),
      style: { ...labelStyle(theme, 9), align: "right" },
      padding: 0.01,
    });
  }

  // X category labels.
  if (categories.length) {
    const slot = plot.w / categories.length;
    categories.forEach((c, i) => {
      elements.push({
        id: id("xlab"),
        type: "text",
        box: { x: plot.x + i * slot, y: plot.y + plot.h + 0.04, w: slot, h: bottom - 0.06 },
        text: c,
        style: labelStyle(theme, 9),
        padding: 0.01,
      });
    });
  }

  return { plot, elements };
}

function barChart(box: Box, data: ChartDatum[], opts: ChartOptions): PPTElement[] {
  const maxY = niceMax(Math.max(...data.map((d) => d.value), 0));
  const cats = data.map((d) => d.label);
  const { plot, elements } = frame(box, opts, maxY, cats);
  const slot = plot.w / data.length;
  const bw = slot * 0.6;

  data.forEach((d, i) => {
    const h = (d.value / maxY) * plot.h;
    const x = plot.x + i * slot + (slot - bw) / 2;
    const y = plot.y + plot.h - h;
    const color = d.color ?? opts.colors[i % opts.colors.length];
    elements.push({
      id: id("bar"),
      type: "shape",
      shape: "roundRect",
      box: { x, y, w: bw, h: Math.max(0.02, h) },
      style: { fill: segFill(color, i, opts.pattern), radius: 0.04 },
    });
    if (opts.showValues) {
      elements.push({
        id: id("bval"),
        type: "text",
        box: { x: x - 0.1, y: y - 0.26, w: bw + 0.2, h: 0.24 },
        text: fmt(d.value),
        style: { ...labelStyle(opts.theme, 10), color: opts.theme.colors.text, vAlign: "bottom" },
        padding: 0.01,
      });
    }
  });
  return elements;
}

function horizontalBarChart(box: Box, data: ChartDatum[], opts: ChartOptions): PPTElement[] {
  const theme = opts.theme;
  const maxX = niceMax(Math.max(...data.map((d) => d.value), 0));
  const leftLabel = Math.min(1.5, box.w * 0.22);
  const bottom = 0.4;
  const top = 0.15;
  const right = 0.3;
  const plot: Box = { x: box.x + leftLabel, y: box.y + top, w: box.w - leftLabel - right, h: box.h - top - bottom };
  const elements: PPTElement[] = [];

  // Vertical gridlines + value tick labels along the bottom.
  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const v = (maxX / ticks) * i;
    const x = plot.x + (i / ticks) * plot.w;
    elements.push({
      id: id("vgrid"),
      type: "line",
      box: { x, y: plot.y, w: 0, h: plot.h },
      from: { x, y: plot.y },
      to: { x, y: plot.y + plot.h },
      stroke: i === 0 ? axisStroke(theme) : gridStroke(theme),
    });
    elements.push({
      id: id("xtick"),
      type: "text",
      box: { x: x - 0.35, y: plot.y + plot.h + 0.04, w: 0.7, h: bottom - 0.06 },
      text: fmt(v),
      style: labelStyle(theme, 9),
      padding: 0.01,
    });
  }

  const slot = plot.h / data.length;
  const bh = Math.min(slot * 0.62, 0.7);
  data.forEach((d, i) => {
    const w = (d.value / maxX) * plot.w;
    const y = plot.y + i * slot + (slot - bh) / 2;
    const color = d.color ?? opts.colors[i % opts.colors.length];
    elements.push({
      id: id("hbar"),
      type: "shape",
      shape: "roundRect",
      box: { x: plot.x, y, w: Math.max(0.02, w), h: bh },
      style: { fill: segFill(color, i, opts.pattern), radius: 0.04 },
    });
    // category label (left of axis)
    elements.push({
      id: id("hlab"),
      type: "text",
      box: { x: box.x, y, w: leftLabel - 0.12, h: bh },
      text: d.label,
      style: { ...labelStyle(theme, 10), color: theme.colors.text, align: "right", vAlign: "middle" },
      padding: 0.01,
    });
    if (opts.showValues) {
      elements.push({
        id: id("hval"),
        type: "text",
        box: { x: plot.x + Math.max(0.02, w) + 0.06, y, w: 0.7, h: bh },
        text: fmt(d.value),
        style: { ...labelStyle(theme, 10), color: theme.colors.text, align: "left", vAlign: "middle" },
        padding: 0.01,
      });
    }
  });
  return elements;
}

function lineChart(box: Box, series: ChartSeries[], opts: ChartOptions, area: boolean): PPTElement[] {
  const cats = opts.categories ?? [];
  const allVals = series.flatMap((s) => s.data ?? []);
  const maxY = niceMax(Math.max(...allVals, 0));
  const { plot, elements } = frame(box, opts, maxY, cats);

  series.forEach((s, si) => {
    const data = s.data ?? [];
    const color = s.color ?? opts.colors[si % opts.colors.length];
    const stepX = data.length > 1 ? plot.w / (data.length - 1) : 0;
    const pts = data.map((v, i) => ({
      x: plot.x + i * stepX,
      y: plot.y + plot.h - (v / maxY) * plot.h,
    }));
    if (pts.length < 2) return;

    // local-space path (relative to plot box)
    const lx = (px: number) => (px - plot.x) * VB;
    const ly = (py: number) => (py - plot.y) * VB;

    if (area) {
      const d =
        `M${lx(pts[0].x)} ${ly(plot.y + plot.h)} ` +
        pts.map((p) => `L${lx(p.x)} ${ly(p.y)}`).join(" ") +
        ` L${lx(pts[pts.length - 1].x)} ${ly(plot.y + plot.h)} Z`;
      elements.push(freeform(plot, d, { fill: color, opacity: 0.18, filled: true }));
    }

    const line = `M${lx(pts[0].x)} ${ly(pts[0].y)} ` + pts.slice(1).map((p) => `L${lx(p.x)} ${ly(p.y)}`).join(" ");
    elements.push(freeform(plot, line, { stroke: { color, width: 2.25 }, filled: false }));

    // point dots
    const dot = 0.09;
    for (const p of pts) {
      elements.push({
        id: id("dot"),
        type: "shape",
        shape: "ellipse",
        box: { x: p.x - dot / 2, y: p.y - dot / 2, w: dot, h: dot },
        style: { fill: { type: "solid", color }, stroke: { color: "#FFFFFF", width: 1 } },
      });
    }
  });
  return elements;
}

function scatterChart(box: Box, series: ChartSeries[], opts: ChartOptions): PPTElement[] {
  const pts = series.flatMap((s) => s.points ?? []);
  const maxX = niceMax(Math.max(...pts.map((p) => p.x), 0));
  const maxY = niceMax(Math.max(...pts.map((p) => p.y), 0));
  const { plot, elements } = frame(box, opts, maxY, []);

  series.forEach((s, si) => {
    const color = s.color ?? opts.colors[si % opts.colors.length];
    for (const p of s.points ?? []) {
      const cx = plot.x + (p.x / maxX) * plot.w;
      const cy = plot.y + plot.h - (p.y / maxY) * plot.h;
      const d = 0.13;
      elements.push({
        id: id("pt"),
        type: "shape",
        shape: "ellipse",
        box: { x: cx - d / 2, y: cy - d / 2, w: d, h: d },
        style: { fill: { type: "solid", color, opacity: 0.85 } },
      });
    }
  });
  return elements;
}

function donutChart(box: Box, data: ChartDatum[], opts: ChartOptions): PPTElement[] {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const size = Math.min(box.w, box.h);
  const ring: Box = { x: box.x + (box.w - size) / 2, y: box.y + (box.h - size) / 2, w: size, h: size };
  const cx = size / 2;
  const cy = size / 2;
  const rO = size / 2 - 0.05;
  const rI = rO * 0.6;
  const elements: PPTElement[] = [];

  let angle = -90; // start at top
  const toXY = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: (cx + r * Math.cos(a)) * VB, y: (cy + r * Math.sin(a)) * VB };
  };

  data.forEach((d, i) => {
    const frac = d.value / total;
    const sweep = frac * 360;
    const a0 = angle;
    const a1 = angle + sweep;
    angle = a1;
    const large = sweep > 180 ? 1 : 0;
    const oS = toXY(rO, a0);
    const oE = toXY(rO, a1);
    const iE = toXY(rI, a1);
    const iS = toXY(rI, a0);
    const path =
      `M${oS.x} ${oS.y} ` +
      `A${rO * VB} ${rO * VB} 0 ${large} 1 ${oE.x} ${oE.y} ` +
      `L${iE.x} ${iE.y} ` +
      `A${rI * VB} ${rI * VB} 0 ${large} 0 ${iS.x} ${iS.y} Z`;
    const color = d.color ?? opts.colors[i % opts.colors.length];
    elements.push(freeform(ring, path, { fillSpec: segFill(color, i, opts.pattern), filled: true }));

    // Percentage label centered on the segment (skip tiny slivers).
    if (frac >= 0.05) {
      const mid = ((a0 + a1) / 2) * (Math.PI / 180);
      const lr = (rO + rI) / 2;
      const lx = ring.x + cx + lr * Math.cos(mid);
      const ly = ring.y + cy + lr * Math.sin(mid);
      const lw = 0.7;
      const lh = 0.3;
      elements.push({
        id: id("dpct"),
        type: "text",
        box: { x: lx - lw / 2, y: ly - lh / 2, w: lw, h: lh },
        text: `${Math.round(frac * 100)}%`,
        style: { size: 11, bold: true, color: onFill(color), align: "center", vAlign: "middle" },
        padding: 0,
      });
    }
  });

  // Center total label.
  elements.push({
    id: id("dcenter"),
    type: "text",
    box: { x: ring.x + rI * 0.2, y: ring.y + cy - 0.3, w: size - rI * 0.4, h: 0.6 },
    text: fmt(total),
    style: { ...opts.theme.typography.kpi, size: Math.round(size * 22), color: opts.theme.colors.text, align: "center", vAlign: "middle" },
    padding: 0.01,
  });

  return elements;
}

/**
 * A ring gauge: a faint full track + a colored arc showing `percent`, with the
 * value text in the center. Built from an editable ellipse (track) and a stroked
 * freeform arc (progress). Used by the `gauge` macro.
 */
export function buildRing(
  box: Box,
  percent: number,
  color: string,
  opts: { theme: ResolvedTheme; trackColor?: string; label?: string }
): PPTElement[] {
  const size = Math.min(box.w, box.h);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rMid = size / 2 - 0.1;
  const thickness = Math.max(0.08, size * 0.1);
  const strokePt = thickness * 72;
  const elements: PPTElement[] = [];

  // Track (full ring) = stroked ellipse, no fill.
  elements.push({
    id: id("gtrack"),
    type: "shape",
    shape: "ellipse",
    box: { x: cx - rMid, y: cy - rMid, w: rMid * 2, h: rMid * 2 },
    style: { fill: { type: "none" }, stroke: { color: opts.trackColor ?? tint(color, 0.82), width: strokePt, round: true } },
  });

  // Progress arc (open path, stroked).
  const pct = Math.max(0, Math.min(100, percent));
  const sweep = Math.min(359.9, (pct / 100) * 360);
  if (sweep > 0.5) {
    // local box for the arc = the gauge box; coords in box-local inches * VB.
    const local = { x: box.x, y: box.y, w: box.w, h: box.h };
    const lcx = box.w / 2;
    const lcy = box.h / 2;
    const pt = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      return { x: (lcx + rMid * Math.cos(a)) * VB, y: (lcy + rMid * Math.sin(a)) * VB };
    };
    const a0 = -90;
    const a1 = -90 + sweep;
    const large = sweep > 180 ? 1 : 0;
    const s = pt(a0);
    const e = pt(a1);
    const path = `M${s.x} ${s.y} A${rMid * VB} ${rMid * VB} 0 ${large} 1 ${e.x} ${e.y}`;
    elements.push(freeform(local, path, { stroke: { color, width: strokePt }, filled: false }));
  }

  // Center value — sized to fit inside the ring's hole (not the whole gauge).
  const hole = (rMid - thickness / 2) * 2;
  const valSize = Math.max(14, Math.min(Math.round(size * 20), Math.round((hole / Math.max(2, (opts.label ?? "").length)) * 72 * 1.5)));
  elements.push({
    id: id("gval"),
    type: "text",
    box: { x: cx - hole / 2, y: cy - hole / 2, w: hole, h: hole },
    text: opts.label ?? `${Math.round(pct)}%`,
    style: { ...opts.theme.typography.kpi, size: valSize, color: opts.theme.colors.text, align: "center", vAlign: "middle" },
    padding: 0,
    noWrap: true,
  });

  return elements;
}

/** Legend chips (colored square + label) laid out vertically in `box`. */
export function buildLegend(box: Box, entries: Array<{ label: string; color: string }>, theme: ResolvedTheme): PPTElement[] {
  const elements: PPTElement[] = [];
  const rowH = Math.min(0.42, box.h / Math.max(1, entries.length));
  entries.forEach((e, i) => {
    const y = box.y + i * rowH;
    const sw = Math.min(0.2, rowH * 0.5);
    elements.push({
      id: id("legsw"),
      type: "shape",
      shape: "roundRect",
      box: { x: box.x, y: y + (rowH - sw) / 2, w: sw, h: sw },
      style: { fill: { type: "solid", color: e.color }, radius: 0.03 },
    });
    elements.push({
      id: id("leglbl"),
      type: "text",
      box: { x: box.x + sw + 0.1, y, w: box.w - sw - 0.1, h: rowH },
      text: e.label,
      style: { ...theme.typography.body, size: 12, color: theme.colors.text, align: "left", vAlign: "middle" },
      padding: 0.01,
    });
  });
  return elements;
}

/** Main entry: build a chart of `opts.type` inside `box`. */
export function buildChart(
  box: Box,
  data: ChartDatum[],
  series: ChartSeries[],
  opts: ChartOptions
): PPTElement[] {
  switch (opts.type) {
    case "bar":
      return barChart(box, data, opts);
    case "barh":
      return horizontalBarChart(box, data, opts);
    case "line":
      return lineChart(box, series.length ? series : [{ data: data.map((d) => d.value) }], opts, false);
    case "area":
      return lineChart(box, series.length ? series : [{ data: data.map((d) => d.value) }], opts, true);
    case "scatter":
      return scatterChart(box, series, opts);
    case "donut":
      return donutChart(box, data, opts);
  }
}
