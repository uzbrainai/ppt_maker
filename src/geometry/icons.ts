/**
 * Icon system — backed by lucide.
 *
 * Lucide ships every icon as structured node data (`[tag, attrs]` in a 24×24
 * viewBox). slidewind converts that data into *editable PowerPoint geometry*:
 *
 *   - <path>            → freeform shape with a DrawingML <a:custGeom>
 *                         (SVG path parsed + arcs→béziers; see svgPath.ts)
 *   - <polyline>/<polygon> → freeform path
 *   - <circle>/<ellipse>   → ellipse preset
 *   - <rect>               → rect / roundRect preset
 *   - <line>               → straight connector
 *
 * Every primitive is stroked (no fill) with round caps/joins, matching lucide's
 * line style — so the icon is a small group of real, selectable PPT shapes, not
 * a raster image.
 *
 * Resolution order for a requested name:
 *   1. friendly alias  (e.g. "gear" → "settings")
 *   2. the name used directly as a lucide id (kebab-case)
 *   3. lettered-circle placeholder (known:false)
 */

import { createRequire } from "node:module";
import type {
  IconElement,
  LineElement,
  PPTElement,
  ShapeElement,
  StrokeSpec,
} from "../core/types.js";
import { parsePath, pointsToPath } from "./svgPath.js";

const require = createRequire(import.meta.url);

type IconAttrs = Record<string, string>;
type IconNode = Array<[string, IconAttrs]>;

let nodeCache: Record<string, IconNode> | null = null;
function lucideNodes(): Record<string, IconNode> {
  if (!nodeCache) {
    nodeCache = require("lucide-static/icon-nodes.json") as Record<string, IconNode>;
  }
  return nodeCache;
}

/** Friendly slidewind names → lucide icon ids. */
export const ICON_ALIASES: Record<string, string> = {
  // originals
  bot: "bot",
  mail: "mail",
  shield: "shield",
  "file-search": "file-search",
  "user-check": "user-check",
  workflow: "workflow",
  mic: "mic",
  chart: "chart-column",
  zap: "zap",
  camera: "camera",
  // semantic UI names commonly emitted by the LLM
  layout: "layout-dashboard",
  shape: "shapes",
  shapes: "shapes",
  gradient: "blend",
  text: "type",
  gear: "settings",
  settings: "settings",
  prompt: "message-square",
  message: "message-square",
  code: "code",
  ppt: "presentation",
  slides: "presentation",
  edit: "square-pen",
  pencil: "pencil",
  document: "file-text",
  doc: "file-text",
  file: "file-text",
  search: "search",
  scan: "scan-search",
  check: "check",
  lock: "lock",
  brain: "brain",
  cpu: "cpu",
  robot: "bot",
  scoring: "trending-up",
  trend: "trending-up",
};

const VIEWBOX = { w: 24, h: 24 } as const;
const LUCIDE_STROKE = 2; // lucide default stroke-width in the 24×24 space

let iconCounter = 0;
function nid(prefix: string): string {
  iconCounter += 1;
  return `${prefix}-${iconCounter}`;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BuildIconOptions {
  color: string;
  /** stroke weight multiplier relative to lucide's default (1 = lucide weight) */
  strokeWidth?: number;
  variant?: "line" | "filled";
}

function num(attrs: IconAttrs, key: string, fallback = 0): number {
  const v = attrs[key];
  return v === undefined ? fallback : Number(v);
}

/** Stroke width (points) for an icon of this size, scaled from lucide weight. */
function strokeWidthPts(box: Box, mult: number): number {
  const minDim = Math.min(box.w, box.h);
  const pts = (LUCIDE_STROKE / VIEWBOX.w) * minDim * 72 * mult;
  return Math.max(0.6, Math.round(pts * 100) / 100);
}

function nodeToElements(node: IconNode, box: Box, color: string, widthPts: number): PPTElement[] {
  const mapX = (v: number) => box.x + (v / VIEWBOX.w) * box.w;
  const mapY = (v: number) => box.y + (v / VIEWBOX.h) * box.h;
  const mapW = (v: number) => (v / VIEWBOX.w) * box.w;
  const mapH = (v: number) => (v / VIEWBOX.h) * box.h;

  const stroke: StrokeSpec = { color, width: widthPts, round: true };
  const out: PPTElement[] = [];

  for (const [tag, attrs] of node) {
    switch (tag) {
      case "path": {
        const d = attrs.d ?? "";
        if (!d) break;
        out.push(freeformFromPath(d, box, stroke));
        break;
      }
      case "polyline":
      case "polygon": {
        const d = pointsToPath(attrs.points ?? "", tag === "polygon");
        if (!d) break;
        out.push(freeformFromPath(d, box, stroke));
        break;
      }
      case "circle": {
        const cx = num(attrs, "cx");
        const cy = num(attrs, "cy");
        const r = num(attrs, "r");
        out.push(strokedShape("ellipse", { x: mapX(cx - r), y: mapY(cy - r), w: mapW(2 * r), h: mapH(2 * r) }, stroke));
        break;
      }
      case "ellipse": {
        const cx = num(attrs, "cx");
        const cy = num(attrs, "cy");
        const rx = num(attrs, "rx");
        const ry = num(attrs, "ry");
        out.push(strokedShape("ellipse", { x: mapX(cx - rx), y: mapY(cy - ry), w: mapW(2 * rx), h: mapH(2 * ry) }, stroke));
        break;
      }
      case "rect": {
        const x = num(attrs, "x");
        const y = num(attrs, "y");
        const w = num(attrs, "width");
        const h = num(attrs, "height");
        const rx = num(attrs, "rx");
        const shape = rx > 0 ? "roundRect" : "rect";
        const el = strokedShape(shape, { x: mapX(x), y: mapY(y), w: mapW(w), h: mapH(h) }, stroke);
        if (rx > 0) el.style.radius = mapW(rx);
        out.push(el);
        break;
      }
      case "line": {
        const line: LineElement = {
          id: nid("ic-ln"),
          type: "line",
          box: {
            x: Math.min(mapX(num(attrs, "x1")), mapX(num(attrs, "x2"))),
            y: Math.min(mapY(num(attrs, "y1")), mapY(num(attrs, "y2"))),
            w: Math.abs(mapX(num(attrs, "x2")) - mapX(num(attrs, "x1"))),
            h: Math.abs(mapY(num(attrs, "y2")) - mapY(num(attrs, "y1"))),
          },
          from: { x: mapX(num(attrs, "x1")), y: mapY(num(attrs, "y1")) },
          to: { x: mapX(num(attrs, "x2")), y: mapY(num(attrs, "y2")) },
          stroke,
        };
        out.push(line);
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function freeformFromPath(d: string, box: Box, stroke: StrokeSpec): ShapeElement {
  return {
    id: nid("ic-pt"),
    type: "shape",
    shape: "freeform",
    box: { ...box },
    style: { fill: { type: "none" }, stroke },
    geometry: {
      segments: parsePath(d),
      viewBox: { ...VIEWBOX },
      filled: false,
      path: d,
    },
  };
}

function strokedShape(shape: "rect" | "roundRect" | "ellipse", box: Box, stroke: StrokeSpec): ShapeElement {
  return {
    id: nid("ic-sp"),
    type: "shape",
    shape,
    box,
    style: { fill: { type: "none" }, stroke },
  };
}

/** Resolve a requested name to a lucide node, if any. */
function resolveNode(name: string): IconNode | undefined {
  const nodes = lucideNodes();
  const aliased = ICON_ALIASES[name];
  if (aliased && nodes[aliased]) return nodes[aliased];
  if (nodes[name]) return nodes[name];
  // try kebab normalization (e.g. "fileSearch" → "file-search")
  const kebab = name.replace(/([a-z])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
  if (nodes[kebab]) return nodes[kebab];
  return undefined;
}

export function isKnownIcon(name: string): boolean {
  return resolveNode(name) !== undefined;
}

/** Lettered-circle placeholder for unknown names. */
function fallbackIcon(name: string, box: Box, color: string): PPTElement[] {
  const d = Math.min(box.w, box.h);
  const circle: Box = { x: box.x + (box.w - d) / 2, y: box.y + (box.h - d) / 2, w: d, h: d };
  const label = (name[0] ?? "•").toUpperCase();
  return [
    {
      id: nid("ic-fb"),
      type: "shape",
      shape: "ellipse",
      box: circle,
      style: { fill: { type: "none" }, stroke: { color, width: strokeWidthPts(box, 1), round: true } },
    },
    {
      id: nid("ic-fbtx"),
      type: "text",
      box: circle,
      text: label,
      style: { size: Math.max(8, Math.round(d * 36)), bold: true, color, align: "center", vAlign: "middle" },
      padding: 0,
    },
  ];
}

/**
 * Build editable shapes for an icon. `known` is false when the name could not
 * be resolved to a lucide icon and a placeholder was used instead.
 */
export function buildIcon(
  name: string,
  box: Box,
  opts: BuildIconOptions
): { elements: PPTElement[]; known: boolean } {
  const node = resolveNode(name);
  const width = strokeWidthPts(box, opts.strokeWidth ?? 1);
  if (node) {
    return { elements: nodeToElements(node, box, opts.color, width), known: true };
  }
  return { elements: fallbackIcon(name, box, opts.color), known: false };
}

/** Convenience: a high-level IconElement (macros call buildIcon directly). */
export function iconElement(name: string, box: Box, opts: BuildIconOptions): IconElement {
  return {
    id: nid("icon"),
    type: "icon",
    name,
    box,
    style: { color: opts.color, strokeWidth: opts.strokeWidth, variant: opts.variant ?? "line" },
  };
}
