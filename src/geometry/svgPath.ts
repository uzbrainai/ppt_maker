/**
 * SVG path parser → normalized absolute segments.
 *
 * Supports the full path grammar (M m L l H h V v C c S s Q q T t A a Z z).
 * Everything is reduced to four segment kinds that map 1:1 onto DrawingML
 * custom geometry:
 *   - moveTo  (M)
 *   - lineTo  (L)
 *   - cubicTo (C)  — H/V become lineTo; S becomes cubic via control reflection
 *   - quadTo  (Q)  — T becomes quad via control reflection
 *   - close   (Z)
 * Elliptical arcs (A) are converted to a sequence of cubic Béziers.
 *
 * Coordinates are returned in the source coordinate space (lucide uses 24×24).
 */

import type { PathSeg } from "../core/types.js";

export type { PathSeg };

const NUMBER_RE = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g;

interface Cmd {
  code: string;
  args: number[];
}

function tokenize(d: string): Cmd[] {
  const cmds: Cmd[] = [];
  const re = /([astvzqmhlcASTVZQMHLC])([^astvzqmhlcASTVZQMHLC]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    const code = m[1];
    const args = (m[2].match(NUMBER_RE) ?? []).map(Number);
    cmds.push({ code, args });
  }
  return cmds;
}

/** Parse an SVG path `d` string into absolute segments. */
export function parsePath(d: string): PathSeg[] {
  const segs: PathSeg[] = [];
  const cmds = tokenize(d);

  let cx = 0; // current point
  let cy = 0;
  let sx = 0; // subpath start
  let sy = 0;
  // reflection control points for S/T
  let prevCubicCtrlX = 0;
  let prevCubicCtrlY = 0;
  let prevQuadCtrlX = 0;
  let prevQuadCtrlY = 0;
  let prevType = "";

  for (const { code, args } of cmds) {
    const rel = code === code.toLowerCase();
    const up = code.toUpperCase();
    let i = 0;

    const take = () => args[i++];

    // Commands may repeat their parameter set (e.g. "L 1 2 3 4").
    do {
      switch (up) {
        case "M": {
          let x = take();
          let y = take();
          if (rel) {
            x += cx;
            y += cy;
          }
          cx = x;
          cy = y;
          sx = x;
          sy = y;
          segs.push({ type: "M", x, y });
          // subsequent implicit pairs are lineTo
          while (i + 1 < args.length) {
            let lx = take();
            let ly = take();
            if (rel) {
              lx += cx;
              ly += cy;
            }
            cx = lx;
            cy = ly;
            segs.push({ type: "L", x: lx, y: ly });
          }
          break;
        }
        case "L": {
          let x = take();
          let y = take();
          if (rel) {
            x += cx;
            y += cy;
          }
          cx = x;
          cy = y;
          segs.push({ type: "L", x, y });
          break;
        }
        case "H": {
          let x = take();
          if (rel) x += cx;
          cx = x;
          segs.push({ type: "L", x, y: cy });
          break;
        }
        case "V": {
          let y = take();
          if (rel) y += cy;
          cy = y;
          segs.push({ type: "L", x: cx, y });
          break;
        }
        case "C": {
          let x1 = take();
          let y1 = take();
          let x2 = take();
          let y2 = take();
          let x = take();
          let y = take();
          if (rel) {
            x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy;
          }
          segs.push({ type: "C", x1, y1, x2, y2, x, y });
          prevCubicCtrlX = x2;
          prevCubicCtrlY = y2;
          cx = x; cy = y;
          break;
        }
        case "S": {
          let x2 = take();
          let y2 = take();
          let x = take();
          let y = take();
          if (rel) {
            x2 += cx; y2 += cy; x += cx; y += cy;
          }
          // reflect previous cubic control point
          const x1 = prevType === "C" || prevType === "S" ? 2 * cx - prevCubicCtrlX : cx;
          const y1 = prevType === "C" || prevType === "S" ? 2 * cy - prevCubicCtrlY : cy;
          segs.push({ type: "C", x1, y1, x2, y2, x, y });
          prevCubicCtrlX = x2;
          prevCubicCtrlY = y2;
          cx = x; cy = y;
          break;
        }
        case "Q": {
          let x1 = take();
          let y1 = take();
          let x = take();
          let y = take();
          if (rel) {
            x1 += cx; y1 += cy; x += cx; y += cy;
          }
          segs.push({ type: "Q", x1, y1, x, y });
          prevQuadCtrlX = x1;
          prevQuadCtrlY = y1;
          cx = x; cy = y;
          break;
        }
        case "T": {
          let x = take();
          let y = take();
          if (rel) {
            x += cx; y += cy;
          }
          const x1 = prevType === "Q" || prevType === "T" ? 2 * cx - prevQuadCtrlX : cx;
          const y1 = prevType === "Q" || prevType === "T" ? 2 * cy - prevQuadCtrlY : cy;
          segs.push({ type: "Q", x1, y1, x, y });
          prevQuadCtrlX = x1;
          prevQuadCtrlY = y1;
          cx = x; cy = y;
          break;
        }
        case "A": {
          const rx = take();
          const ry = take();
          const rot = take();
          const large = take();
          const sweep = take();
          let x = take();
          let y = take();
          if (rel) {
            x += cx; y += cy;
          }
          for (const c of arcToCubics(cx, cy, rx, ry, rot, large, sweep, x, y)) {
            segs.push(c);
          }
          cx = x; cy = y;
          break;
        }
        case "Z": {
          segs.push({ type: "Z" });
          cx = sx; cy = sy;
          break;
        }
      }
      prevType = up;
    } while (i < args.length && up !== "Z");
  }

  return segs;
}

/**
 * Convert an SVG elliptical arc (endpoint parameterization) into a sequence of
 * cubic Bézier segments. Based on the SVG implementation notes (F.6).
 */
function arcToCubics(
  x1: number,
  y1: number,
  rxIn: number,
  ryIn: number,
  rotDeg: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number
): Array<Extract<PathSeg, { type: "C" }>> {
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) {
    return [{ type: "C", x1, y1, x2, y2, x: x2, y: y2 }];
  }
  const phi = (rotDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // correct out-of-range radii
  let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const sign = largeArc !== sweep ? 1 : -1;
  let num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  num = Math.max(0, num);
  const co = sign * Math.sqrt(num / den || 0);
  const cxp = (co * (rx * y1p)) / ry;
  const cyp = (co * -(ry * x1p)) / rx;

  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (sweep === 0 && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep === 1 && dTheta < 0) dTheta += 2 * Math.PI;

  const segments = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / segments;
  const t = (4 / 3) * Math.tan(delta / 4);

  const out: Array<Extract<PathSeg, { type: "C" }>> = [];
  let startX = x1;
  let startY = y1;
  for (let k = 0; k < segments; k++) {
    const a1 = theta1 + k * delta;
    const a2 = theta1 + (k + 1) * delta;

    const cos1 = Math.cos(a1);
    const sin1 = Math.sin(a1);
    const cos2 = Math.cos(a2);
    const sin2 = Math.sin(a2);

    const e2x = cx + rx * cosPhi * cos2 - ry * sinPhi * sin2;
    const e2y = cy + rx * sinPhi * cos2 + ry * cosPhi * sin2;

    const d1x = -rx * cosPhi * sin1 - ry * sinPhi * cos1;
    const d1y = -rx * sinPhi * sin1 + ry * cosPhi * cos1;
    const d2x = -rx * cosPhi * sin2 - ry * sinPhi * cos2;
    const d2y = -rx * sinPhi * sin2 + ry * cosPhi * cos2;

    out.push({
      type: "C",
      x1: startX + t * d1x,
      y1: startY + t * d1y,
      x2: e2x - t * d2x,
      y2: e2y - t * d2y,
      x: e2x,
      y: e2y,
    });
    startX = e2x;
    startY = e2y;
  }
  return out;
}

/** Build a path string for a polyline/polygon point list (lucide `points`). */
export function pointsToPath(points: string, close: boolean): string {
  const nums = (points.match(NUMBER_RE) ?? []).map(Number);
  if (nums.length < 4) return "";
  const parts: string[] = [`M${nums[0]} ${nums[1]}`];
  for (let i = 2; i + 1 < nums.length; i += 2) {
    parts.push(`L${nums[i]} ${nums[i + 1]}`);
  }
  if (close) parts.push("Z");
  return parts.join(" ");
}
