/**
 * Spine slide.
 *
 * A left title block (brand + big title) and, on the right, a list of items —
 * each a heading + paragraph — hung off a single curved vertical "spine" with a
 * node dot per item. (The "Solutions" reference look.) Right-side text is
 * right-aligned toward the spine.
 */

import type {
  PPTElement,
  ResolvedTheme,
  SlideSize,
  SpineSlideSpec,
  SpineTuple,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, split, rows } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { parsePath } from "../geometry/svgPath.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, fitText, uid } from "./shared.js";
import { backgroundRect } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

const VB = 1000;

interface Item {
  title: string;
  body?: string;
}

function normalize(it: SpineTuple): Item {
  if (Array.isArray(it)) return { title: it[0], body: it[1] };
  return { title: it.title ?? it.t ?? "", body: it.body ?? it.s };
}

export function expandSpineSlide(
  spec: SpineSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { spine } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(spine.class, where);
  warnings.merge(classWarn);

  const items = spine.items.map(normalize);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);
  const [left, right] = split(area, 0.4, theme.spacing.lg);

  // ---- Left: brand + big title (vertically centered) ----
  const titleH = 1.4;
  let ly = left.y + (left.h - titleH - 0.4) / 2;
  if (spine.brand) {
    elements.push({
      id: uid("spbrand"),
      type: "text",
      box: { x: left.x, y: ly, w: left.w, h: 0.34 },
      text: spine.brand,
      style: { ...theme.typography.bodyStrong, size: 15, color: accent, align: "left", vAlign: "middle" },
      padding: 0.02,
      noWrap: true,
    });
    ly += 0.4;
  }
  if (spine.t) {
    const tf = fitText(spine.t, { boxW: left.w, boxH: titleH, padding: 0.02, base: { ...theme.typography.h1, size: 48, color: theme.colors.text, align: "left" }, minFontSize: 28, maxLines: 2 }, warnings, where);
    elements.push({ id: uid("sptitle"), type: "text", box: { x: left.x, y: ly, w: left.w, h: titleH }, text: tf.text, style: { ...tf.style, vAlign: "top" }, padding: 0.02 });
  }

  // ---- Right: items hung off a single curved spine (one big arc) ----
  const box = { x: right.x, y: right.y, w: right.w, h: right.h };
  const spineX = right.x + right.w - 0.2; // rightmost extent of the arc
  const rowBoxes = rows({ x: right.x, y: right.y, w: right.w, h: right.h }, items.length, theme.spacing.lg);
  const centersY = rowBoxes.map((rb) => (rb ? rb.y + rb.h / 2 : right.y));
  const cyArc = right.y + right.h / 2;
  // Big-circle arc: endpoints at spineX (top/bottom), bowing left by `bow` in the
  // middle — a clean single arc that the node dots sit on.
  const span = Math.max(...centersY.map((y) => Math.abs(y - cyArc)), right.h * 0.4);
  const bow = Math.min(1.0, right.w * 0.17);
  const R = (span * span + bow * bow) / (2 * bow);
  const centerX = spineX - bow + R;
  const arcX = (y: number) => centerX - Math.sqrt(Math.max(0, R * R - (y - cyArc) * (y - cyArc)));

  const lx = (px: number) => (px - box.x) * VB;
  const lyy = (py: number) => (py - box.y) * VB;
  const topY = right.y + 0.12;
  const botY = right.y + right.h - 0.12;
  const steps = 28;
  let d = "";
  for (let s = 0; s <= steps; s++) {
    const y = topY + (botY - topY) * (s / steps);
    d += `${s === 0 ? "M" : "L"}${lx(arcX(y)).toFixed(1)} ${lyy(y).toFixed(1)} `;
  }
  elements.push({
    id: uid("spspine"),
    type: "shape",
    shape: "freeform",
    box,
    style: { fill: { type: "none" }, stroke: { color: theme.colors.border, width: 1.3, round: true } },
    geometry: { segments: parsePath(d), viewBox: { w: box.w * VB, h: box.h * VB }, filled: false, path: d },
  });

  items.forEach((it, i) => {
    const rb = rowBoxes[i];
    if (!rb) return;
    const cyN = centersY[i];
    const dotX = arcX(cyN);
    // node dot on the arc
    elements.push({ id: uid("spnode"), type: "shape", shape: "ellipse", box: { x: dotX - 0.11, y: cyN - 0.11, w: 0.22, h: 0.22 }, style: { fill: { type: "solid", color: accent }, stroke: { color: theme.colors.background, width: 2 } } });

    // text right-aligned, ending just left of this item's dot
    const textRight = dotX - 0.34;
    const textW = textRight - rb.x;
    const titleLines = checkBudget(it.title, CAPACITY.spine.title, `spine title "${it.title}"`, warnings, where);
    const th = 0.4;
    const tf = fitText(it.title, { boxW: textW, boxH: th, padding: 0.02, base: { ...theme.typography.h2, size: 18, color: accent, align: "right" }, minFontSize: 13, maxLines: titleLines }, warnings, where);
    elements.push({ id: uid("sptl"), type: "text", box: { x: rb.x, y: rb.y, w: textW, h: th }, text: tf.text, style: { ...tf.style, vAlign: "top" }, padding: 0.02 });
    if (it.body) {
      const bodyLines = checkBudget(it.body, CAPACITY.spine.body, "spine body", warnings, where);
      const bodyH = rb.y + rb.h - (rb.y + th + 0.04);
      const bf = fitText(it.body, { boxW: textW, boxH: bodyH, padding: 0.02, base: { ...theme.typography.body, size: 13, color: theme.colors.textMuted, align: "right" }, minFontSize: 10, maxLines: bodyLines }, warnings, where);
      elements.push({ id: uid("spbd"), type: "text", box: { x: rb.x, y: rb.y + th + 0.04, w: textW, h: bodyH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
    }
  });

  return { slide: { id: slideId, background: bg, elements, notes: spine.notes }, warnings };
}
