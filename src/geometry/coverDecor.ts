/**
 * Cover-slide geometric decorations.
 *
 * A set of layered, fully-editable geometric "effects" for the title slide —
 * concentric rings, dot grids, organic blobs, low-poly meshes, wave bands,
 * confetti scatter, and sweeping arcs. Every effect is built from native
 * PowerPoint primitives (ellipses, triangles, hexagons, rounded rects) and
 * freeform `<a:custGeom>` paths, so nothing is rasterized and the user can move
 * or restyle each piece.
 *
 * Colors are derived from the active theme/accent and kept low-opacity so the
 * (contrast-aware) title text stays readable. Effects are placed toward the
 * corners/edges, leaving the central title block relatively clear.
 */

import type { PPTElement, ResolvedTheme, ShapeElement, SlideSize } from "../core/types.js";
import type { CoverDecor } from "../classes/classMap.js";
import { parsePath } from "./svgPath.js";
import { tint, shade, mix, luminance } from "../core/color.js";

interface Box { x: number; y: number; w: number; h: number }

const VB = 1000; // custGeom precision (units per inch)
let dn = 0;
const did = (p: string) => `decor-${p}-${++dn}`;

/** Tonal ramp derived from the accent, adapted to light/dark backgrounds. */
function tones(accent: string, theme: ResolvedTheme) {
  const dark = luminance(theme.colors.background) < 0.4;
  return {
    dark,
    strong: dark ? tint(accent, 0.2) : shade(accent, 0.04),
    soft: dark ? tint(accent, 0.34) : tint(accent, 0.45),
    faint: dark ? tint(accent, 0.55) : tint(accent, 0.74),
    bg: theme.colors.background,
  };
}

function ellipse(box: Box, opts: { fill?: string; opacity?: number; stroke?: { color: string; width: number; opacity?: number; dash?: "solid" | "dash" | "dot" } }, rotation?: number): ShapeElement {
  return {
    id: did("el"),
    type: "shape",
    shape: "ellipse",
    box: { ...box },
    rotation,
    style: {
      fill: opts.fill ? { type: "solid", color: opts.fill, opacity: opts.opacity } : { type: "none" },
      stroke: opts.stroke ? { color: opts.stroke.color, width: opts.stroke.width, opacity: opts.stroke.opacity, dash: opts.stroke.dash, round: true } : undefined,
    },
  };
}

function poly(shape: "triangle" | "hexagon" | "diamond" | "roundRect" | "rect", box: Box, opts: { fill?: string; opacity?: number; stroke?: { color: string; width: number; opacity?: number }; radius?: number }, rotation?: number): ShapeElement {
  return {
    id: did(shape),
    type: "shape",
    shape,
    box: { ...box },
    rotation,
    style: {
      fill: opts.fill ? { type: "solid", color: opts.fill, opacity: opts.opacity } : { type: "none" },
      stroke: opts.stroke ? { color: opts.stroke.color, width: opts.stroke.width, opacity: opts.stroke.opacity, round: true } : undefined,
      radius: opts.radius,
    },
  };
}

/** Freeform from an SVG path (coords in box-local inches × VB). */
function freeform(box: Box, path: string, opts: { fill?: string; opacity?: number; stroke?: { color: string; width: number; opacity?: number }; filled: boolean }): ShapeElement {
  return {
    id: did("ff"),
    type: "shape",
    shape: "freeform",
    box: { ...box },
    style: {
      fill: opts.fill ? { type: "solid", color: opts.fill, opacity: opts.opacity } : { type: "none" },
      stroke: opts.stroke ? { color: opts.stroke.color, width: opts.stroke.width, opacity: opts.stroke.opacity, round: true } : undefined,
    },
    geometry: { segments: parsePath(path), viewBox: { w: box.w * VB, h: box.h * VB }, filled: opts.filled, path },
  };
}

/** Build a path from normalized (0..1) coordinate tuples within a box. */
function normPath(box: Box, pts: Array<[string, ...number[]]>): string {
  const X = (f: number) => (f * box.w * VB).toFixed(1);
  const Y = (f: number) => (f * box.h * VB).toFixed(1);
  return pts
    .map(([cmd, ...n]) => {
      if (cmd === "Z") return "Z";
      const coords = n.map((v, i) => (i % 2 === 0 ? X(v) : Y(v))).join(" ");
      return `${cmd}${coords}`;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------

function rings(size: SlideSize, t: ReturnType<typeof tones>): PPTElement[] {
  const els: PPTElement[] = [];
  const cx = size.width - 0.7;
  const cy = 0.5;
  for (let i = 0; i < 6; i++) {
    const r = 0.85 + i * 0.62;
    els.push(ellipse({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 }, { stroke: { color: t.soft, width: 1.6, opacity: 0.5 - i * 0.06 } }));
  }
  // a small solid accent dot riding one ring + a faint disc bottom-left
  els.push(ellipse({ x: cx - 1.9, y: cy + 1.0, w: 0.22, h: 0.22 }, { fill: t.strong, opacity: 0.9 }));
  els.push(ellipse({ x: -1.3, y: size.height - 1.6, w: 3.0, h: 3.0 }, { fill: t.faint, opacity: t.dark ? 0.18 : 0.5 }));
  els.push(ellipse({ x: -0.5, y: size.height - 1.0, w: 1.4, h: 1.4 }, { stroke: { color: t.soft, width: 1.4, opacity: 0.5 } }));
  return els;
}

function grid(size: SlideSize, t: ReturnType<typeof tones>): PPTElement[] {
  const els: PPTElement[] = [];
  const dot = 0.07;
  const step = 0.42;
  // top-right block fading toward the title
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const x = size.width - 0.5 - c * step;
      const y = 0.5 + r * step;
      const fade = 1 - (r + c) / 14;
      if (fade <= 0.12) continue;
      els.push(ellipse({ x, y, w: dot, h: dot }, { fill: t.soft, opacity: 0.18 + fade * 0.45 }));
    }
  }
  // bottom-left mirror block
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 6; c++) {
      const x = 0.5 + c * step;
      const y = size.height - 0.6 - r * step;
      const fade = 1 - (r + c) / 12;
      if (fade <= 0.14) continue;
      els.push(ellipse({ x, y, w: dot, h: dot }, { fill: t.faint, opacity: 0.16 + fade * 0.4 }));
    }
  }
  return els;
}

function blobs(size: SlideSize, t: ReturnType<typeof tones>): PPTElement[] {
  const els: PPTElement[] = [];
  // Top-right organic blob (partly off-canvas).
  const b1: Box = { x: size.width - 3.6, y: -1.6, w: 5.2, h: 5.2 };
  const p1 = normPath(b1, [
    ["M", 0.5, 0.05], ["C", 0.78, 0.06, 0.97, 0.25, 0.95, 0.5],
    ["C", 0.93, 0.73, 0.8, 0.96, 0.54, 0.95], ["C", 0.3, 0.94, 0.05, 0.82, 0.06, 0.55],
    ["C", 0.07, 0.3, 0.22, 0.04, 0.5, 0.05], ["Z"],
  ]);
  els.push(freeform(b1, p1, { fill: t.soft, opacity: t.dark ? 0.16 : 0.32, filled: true }));

  // A concentric thin outline blob for depth.
  const b1b: Box = { x: b1.x + 0.4, y: b1.y + 0.4, w: b1.w - 0.8, h: b1.h - 0.8 };
  els.push(freeform(b1b, p1, { stroke: { color: t.strong, width: 1.4, opacity: 0.4 }, filled: false }));

  // Bottom-left organic blob.
  const b2: Box = { x: -2.0, y: size.height - 3.4, w: 4.6, h: 4.6 };
  const p2 = normPath(b2, [
    ["M", 0.45, 0.04], ["C", 0.7, 0.02, 0.98, 0.18, 0.96, 0.46],
    ["C", 0.94, 0.72, 0.86, 0.98, 0.56, 0.97], ["C", 0.28, 0.96, 0.02, 0.86, 0.04, 0.58],
    ["C", 0.06, 0.28, 0.2, 0.06, 0.45, 0.04], ["Z"],
  ]);
  els.push(freeform(b2, p2, { fill: t.faint, opacity: t.dark ? 0.2 : 0.45, filled: true }));
  els.push(ellipse({ x: size.width - 1.4, y: size.height - 1.3, w: 0.3, h: 0.3 }, { fill: t.strong, opacity: 0.8 }));
  return els;
}

function mesh(size: SlideSize, t: ReturnType<typeof tones>): PPTElement[] {
  const els: PPTElement[] = [];
  // Low-poly cluster of triangles + a hexagon in the top-right corner.
  const cfg: Array<[Box, number, string, number]> = [
    [{ x: size.width - 2.6, y: -0.5, w: 1.8, h: 1.8 }, 12, t.soft, 0.3],
    [{ x: size.width - 1.5, y: 0.4, w: 1.4, h: 1.4 }, 195, t.strong, 0.22],
    [{ x: size.width - 3.3, y: 0.7, w: 1.2, h: 1.2 }, 70, t.faint, 0.4],
    [{ x: size.width - 2.0, y: 1.4, w: 1.0, h: 1.0 }, 250, t.soft, 0.26],
  ];
  for (const [box, rot, color, op] of cfg) els.push(poly("triangle", box, { fill: color, opacity: op }, rot));
  els.push(poly("hexagon", { x: size.width - 1.2, y: 1.6, w: 1.0, h: 1.0 }, { stroke: { color: t.strong, width: 1.6, opacity: 0.5 } }, 15));

  // A smaller echo cluster bottom-left.
  els.push(poly("triangle", { x: -0.3, y: size.height - 1.7, w: 1.6, h: 1.6 }, { fill: t.faint, opacity: t.dark ? 0.18 : 0.4 }, 200));
  els.push(poly("triangle", { x: 0.8, y: size.height - 1.2, w: 1.1, h: 1.1 }, { fill: t.soft, opacity: 0.24 }, 30));
  return els;
}

function waves(size: SlideSize, t: ReturnType<typeof tones>): PPTElement[] {
  const els: PPTElement[] = [];
  const layers: Array<[number, number, string, number]> = [
    [2.4, 0.12, t.faint, t.dark ? 0.16 : 0.4],
    [1.7, -0.1, t.soft, t.dark ? 0.2 : 0.34],
    [1.0, 0.08, t.strong, t.dark ? 0.24 : 0.26],
  ];
  for (const [h, amp, color, op] of layers) {
    const box: Box = { x: 0, y: size.height - h, w: size.width, h };
    // top edge: two cubic humps; then close down the sides to the slide bottom.
    const top = 0.42; // baseline fraction within the band
    const path = normPath(box, [
      ["M", 0, top],
      ["C", 0.25, top - amp, 0.25, top + amp, 0.5, top],
      ["C", 0.75, top - amp, 0.75, top + amp, 1.0, top],
      ["L", 1.0, 1.0], ["L", 0, 1.0], ["Z"],
    ]);
    els.push(freeform(box, path, { fill: color, opacity: op, filled: true }));
  }
  return els;
}

function scatter(size: SlideSize, t: ReturnType<typeof tones>): PPTElement[] {
  const els: PPTElement[] = [];
  // Fixed "confetti" of mixed primitives around the edges (center kept clear).
  const W = size.width;
  const H = size.height;
  els.push(ellipse({ x: W - 1.2, y: 0.5, w: 0.5, h: 0.5 }, { stroke: { color: t.soft, width: 2, opacity: 0.6 } }));
  els.push(ellipse({ x: W - 2.3, y: 1.2, w: 0.2, h: 0.2 }, { fill: t.strong, opacity: 0.85 }));
  els.push(poly("roundRect", { x: W - 1.6, y: 1.9, w: 0.42, h: 0.42 }, { fill: t.soft, opacity: 0.5, radius: 0.06 }, 28));
  els.push(poly("triangle", { x: W - 0.9, y: 1.5, w: 0.45, h: 0.45 }, { fill: t.faint, opacity: 0.7 }, 18));
  // a plus sign (two thin rounded bars)
  els.push(poly("roundRect", { x: W - 2.7, y: 0.55, w: 0.4, h: 0.1 }, { fill: t.strong, opacity: 0.7, radius: 0.05 }));
  els.push(poly("roundRect", { x: W - 2.55, y: 0.4, w: 0.1, h: 0.4 }, { fill: t.strong, opacity: 0.7, radius: 0.05 }));
  els.push(poly("diamond", { x: 0.5, y: H - 1.4, w: 0.45, h: 0.45 }, { fill: t.soft, opacity: 0.55 }, 0));
  els.push(ellipse({ x: 1.3, y: H - 1.0, w: 0.3, h: 0.3 }, { stroke: { color: t.strong, width: 2, opacity: 0.6 } }));
  els.push(ellipse({ x: 0.6, y: H - 2.2, w: 0.16, h: 0.16 }, { fill: t.faint, opacity: 0.8 }));
  els.push(poly("triangle", { x: 1.9, y: H - 1.6, w: 0.4, h: 0.4 }, { fill: t.faint, opacity: 0.6 }, 200));
  els.push(poly("roundRect", { x: 0.4, y: 0.6, w: 0.36, h: 0.36 }, { stroke: { color: t.soft, width: 2, opacity: 0.5 }, radius: 0.06 }, 16));
  return els;
}

/** A gradient-filled triangular "shard" (deep base → bright tip). */
function shard(box: Box, deep: string, bright: string, rotation?: number, angle = 90): ShapeElement {
  return {
    id: did("shard"),
    type: "shape",
    shape: "triangle",
    box: { ...box },
    rotation,
    style: { fill: { type: "linearGradient", angle, stops: [{ color: deep, pos: 0 }, { color: bright, pos: 1 }] } },
  };
}

function shards(size: SlideSize, t: ReturnType<typeof tones>): PPTElement[] {
  const els: PPTElement[] = [];
  const deep = t.dark ? mix(t.bg, t.strong, 0.35) : mix("#FFFFFF", t.strong, 0.25);
  const bright = t.strong;
  const W = size.width;
  const H = size.height;

  // Soft central glow: a single radial-gradient ellipse (bright core → bg) near
  // the base of the main beam — renders as a smooth bloom, no banding.
  const gx = W * 0.5;
  const gy = H * 0.6;
  const gr = 3.8;
  const core = mix(t.bg, bright, t.dark ? 0.4 : 0.28);
  els.push({
    id: did("glow"),
    type: "shape",
    shape: "ellipse",
    box: { x: gx - gr, y: gy - gr, w: gr * 2, h: gr * 2 },
    style: { fill: { type: "radialGradient", cx: 0.5, cy: 0.5, r: 0.5, stops: [{ color: core, pos: 0 }, { color: t.bg, pos: 1 }], fallback: "solid" } },
  });

  // Mostly upward shards from the bottom, one bright central beam, plus a couple
  // of slashes from the top-right. Kept clear of the left title block.
  const cfg: Array<[Box, number, string, string]> = [
    [{ x: W * 0.47, y: H - 6.4, w: 1.0, h: 6.8 }, 0, deep, bright], // central bright beam (tip up)
    [{ x: -0.4, y: H - 5.2, w: 2.3, h: 5.8 }, 9, deep, bright], // bottom-left big
    [{ x: W * 0.69, y: H - 5.0, w: 1.5, h: 5.6 }, -6, deep, bright], // right cluster
    [{ x: W * 0.85, y: H - 3.6, w: 1.2, h: 4.6 }, 13, deep, bright],
    [{ x: W * 0.6, y: H - 2.6, w: 0.85, h: 3.1 }, -4, deep, bright],
    [{ x: W - 1.15, y: -0.6, w: 1.3, h: 4.2 }, 161, deep, bright], // upper-right downward slash
  ];
  for (const [box, rot, c0, c1] of cfg) els.push(shard(box, c0, c1, rot, 90));
  return els;
}

function arcs(size: SlideSize, t: ReturnType<typeof tones>): PPTElement[] {
  const els: PPTElement[] = [];
  // Big sweeping rings centered off-canvas so only broad arcs cross the slide.
  const c1x = -1.5, c1y = size.height + 1.0;
  for (let i = 0; i < 4; i++) {
    const r = 3.4 + i * 0.9;
    els.push(ellipse({ x: c1x - r, y: c1y - r, w: r * 2, h: r * 2 }, { stroke: { color: t.soft, width: 2, opacity: 0.5 - i * 0.08 } }));
  }
  const c2x = size.width + 1.3, c2y = -1.2;
  for (let i = 0; i < 3; i++) {
    const r = 2.6 + i * 0.9;
    els.push(ellipse({ x: c2x - r, y: c2y - r, w: r * 2, h: r * 2 }, { stroke: { color: t.strong, width: 2, opacity: 0.45 - i * 0.1, dash: "dot" } }));
  }
  els.push(ellipse({ x: size.width - 0.9, y: size.height - 0.9, w: 0.28, h: 0.28 }, { fill: t.strong, opacity: 0.85 }));
  return els;
}

const BUILDERS: Record<Exclude<CoverDecor, "none">, (size: SlideSize, t: ReturnType<typeof tones>) => PPTElement[]> = {
  rings,
  grid,
  blobs,
  mesh,
  waves,
  scatter,
  arcs,
  shards,
};

/** Styles eligible to be chosen as the automatic default. */
export const DEFAULT_DECOR_POOL: Array<Exclude<CoverDecor, "none">> = ["blobs", "rings", "mesh", "waves", "grid", "arcs", "scatter"];

/** Deterministically pick a default decor from a seed (e.g. the deck title). */
export function pickDefaultDecor(seed: string | undefined): Exclude<CoverDecor, "none"> {
  const s = seed ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return DEFAULT_DECOR_POOL[h % DEFAULT_DECOR_POOL.length];
}

/** Build the decoration elements for a cover slide (drawn behind the text). */
export function buildCoverDecor(
  style: CoverDecor,
  size: SlideSize,
  opts: { accent: string; theme: ResolvedTheme }
): PPTElement[] {
  if (style === "none") return [];
  const t = tones(opts.accent, opts.theme);
  return BUILDERS[style](size, t);
}
