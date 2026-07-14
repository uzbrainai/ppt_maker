/**
 * Radial slide — a ring split into N equal, numbered segments on the left, and a
 * matching color-coded item list (title + detail) on the right. (Perceptis
 * "Radial Diagram" templates.)
 */

import type {
  PPTElement,
  RadialSlideSpec,
  RadialTuple,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, reserveTitle, split, rows } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { parsePath } from "../geometry/svgPath.js";
import { Warnings } from "../validation/warnings.js";
import { backgroundFill, fitText, groupColors, onColor, uid } from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

const VB = 1000;

interface Seg {
  title: string;
  body?: string;
  group?: string;
}

function normalize(it: RadialTuple): Seg {
  if (Array.isArray(it)) return { title: it[0], body: it[1] };
  return { title: it.title ?? it.t ?? "", body: it.body ?? it.s };
}

export function expandRadialSlide(
  spec: RadialSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { radial } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(radial.class, where);
  warnings.merge(classWarn);

  const items = radial.items.map(normalize).slice(0, 6);
  const bg = backgroundFill(tokens, theme, warnings, where);
  // Distinct color per segment.
  const colors = groupColors(items.map((_, i) => ({ group: `g${i}` })), { ...tokens, colorful: true, accent: "multi" }, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);
  const hasTitle = !!radial.t;
  const { title: titleBox, rest } = hasTitle ? reserveTitle(area, 0.9, theme.spacing.md) : { title: undefined, rest: area };
  if (hasTitle && titleBox) elements.push(titleElement(radial.t!, titleBox, theme, bg, warnings, where));

  const [ringCol, listCol] = split(rest, 0.42, theme.spacing.lg);

  // ---- Ring of equal segments ----
  const n = items.length;
  const dia = Math.min(ringCol.w, ringCol.h) - 0.2;
  const ring = { x: ringCol.x + (ringCol.w - dia) / 2, y: ringCol.y + (ringCol.h - dia) / 2, w: dia, h: dia };
  const cx = dia / 2;
  const cy = dia / 2;
  const rO = dia / 2 - 0.02;
  const rI = rO * 0.58;
  const gapDeg = n > 1 ? 4 : 0; // small gaps between segments
  const toXY = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: (cx + r * Math.cos(a)) * VB, y: (cy + r * Math.sin(a)) * VB };
  };
  let angle = -90;
  items.forEach((_, i) => {
    const sweep = 360 / n - gapDeg;
    const a0 = angle + gapDeg / 2;
    const a1 = a0 + sweep;
    angle += 360 / n;
    const large = sweep > 180 ? 1 : 0;
    const oS = toXY(rO, a0), oE = toXY(rO, a1), iE = toXY(rI, a1), iS = toXY(rI, a0);
    const path = `M${oS.x} ${oS.y} A${rO * VB} ${rO * VB} 0 ${large} 1 ${oE.x} ${oE.y} L${iE.x} ${iE.y} A${rI * VB} ${rI * VB} 0 ${large} 0 ${iS.x} ${iS.y} Z`;
    elements.push({
      id: uid("rseg"),
      type: "shape",
      shape: "freeform",
      box: { ...ring },
      style: { fill: { type: "solid", color: colors[i] } },
      geometry: { segments: parsePath(path), viewBox: { w: dia * VB, h: dia * VB }, filled: true, path },
    });
    // number label centered on the segment band
    const mid = ((a0 + a1) / 2) * (Math.PI / 180);
    const lr = (rO + rI) / 2;
    const lx = ring.x + cx + lr * Math.cos(mid);
    const ly = ring.y + cy + lr * Math.sin(mid);
    elements.push({
      id: uid("rsegn"),
      type: "text",
      box: { x: lx - 0.3, y: ly - 0.2, w: 0.6, h: 0.4 },
      text: String(i + 1),
      style: { size: 18, bold: true, color: onColor(colors[i]), align: "center", vAlign: "middle" },
      padding: 0,
      noWrap: true,
    });
  });
  if (radial.center) {
    checkBudget(radial.center, CAPACITY.radial.center, "radial center", warnings, where);
    elements.push({
      id: uid("rcenter"),
      type: "text",
      box: { x: ring.x + cx - rI, y: ring.y + cy - rI, w: rI * 2, h: rI * 2 },
      text: radial.center,
      style: { ...theme.typography.bodyStrong, size: 16, color: theme.colors.text, align: "center", vAlign: "middle" },
      padding: 0.04,
    });
  }

  // ---- Item list (matching colors) ----
  const rowBoxes = rows(listCol, n, theme.spacing.sm);
  items.forEach((s, i) => {
    const r = rowBoxes[i];
    if (!r) return;
    const color = colors[i];
    const chip = Math.min(0.5, r.h * 0.66);
    elements.push({ id: uid("rchip"), type: "shape", shape: "ellipse", box: { x: r.x, y: r.y + (r.h - chip) / 2, w: chip, h: chip }, style: { fill: { type: "solid", color } } });
    elements.push({ id: uid("rchipn"), type: "text", box: { x: r.x, y: r.y + (r.h - chip) / 2, w: chip, h: chip }, text: String(i + 1), style: { size: 13, bold: true, color: onColor(color), align: "center", vAlign: "middle" }, padding: 0, noWrap: true });
    const tx = r.x + chip + theme.spacing.sm;
    const tw = r.x + r.w - tx;
    const hasBody = !!s.body;
    const tH = hasBody ? Math.min(0.34, r.h * 0.45) : r.h;
    const titleLines = checkBudget(s.title, CAPACITY.radial.title, `radial title "${s.title}"`, warnings, where);
    const tf = fitText(s.title, { boxW: tw, boxH: tH, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 15, color: theme.colors.text, align: "left" }, minFontSize: 11, maxLines: titleLines }, warnings, where);
    elements.push({ id: uid("rtitle"), type: "text", box: { x: tx, y: r.y, w: tw, h: tH }, text: tf.text, style: { ...tf.style, vAlign: hasBody ? "top" : "middle" }, padding: 0.02 });
    if (hasBody) {
      const bH = r.y + r.h - (r.y + tH);
      const bodyLines = checkBudget(s.body, CAPACITY.radial.body, "radial body", warnings, where);
      const bf = fitText(s.body!, { boxW: tw, boxH: bH, padding: 0.02, base: { ...theme.typography.body, size: 12, color: theme.colors.textMuted, align: "left" }, minFontSize: 9, maxLines: bodyLines }, warnings, where);
      elements.push({ id: uid("rbody"), type: "text", box: { x: tx, y: r.y + tH, w: tw, h: bH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
    }
  });

  return { slide: { id: slideId, background: bg, elements, notes: radial.notes }, warnings };
}
