/**
 * Roadmap slide.
 *
 * A horizontal sequence of phase circles joined by a dashed, gently-looping
 * path, with phase descriptions alternating above and below the line. Circle
 * fills alternate accent/surface. (The "Product Development Roadmap" look.)
 */

import type {
  PPTElement,
  ResolvedTheme,
  RoadmapSlideSpec,
  RoadmapTuple,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { parsePath } from "../geometry/svgPath.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, eyebrowHeader, fitText, noteBlock, onColor, uid } from "./shared.js";
import { backgroundRect } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

const VB = 1000;

interface Phase {
  node: string;
  title?: string;
  body?: string;
}

function normalize(it: RoadmapTuple, i: number): Phase {
  if (Array.isArray(it)) {
    return it.length === 3
      ? { node: it[0], title: it[1], body: it[2] }
      : { node: it[0], body: it[1] };
  }
  return { node: it.phase ?? it.n ?? `PHASE ${i + 1}`, title: it.title ?? it.t, body: it.body ?? it.s };
}

export function expandRoadmapSlide(
  spec: RoadmapSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { roadmap } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(roadmap.class, where);
  warnings.merge(classWarn);

  const items = roadmap.items.map((it, i) => normalize(it, i));
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);
  const header = eyebrowHeader(area, { eyebrow: roadmap.eyebrow ?? "ROADMAP", title: roadmap.t, bg, accent, theme, warnings, where });
  elements.push(...header.elements);

  let regionBottom = area.y + area.h;
  if (roadmap.callout) {
    checkBudget(roadmap.callout, CAPACITY.roadmap.callout, "roadmap callout", warnings, where);
    const calloutH = 0.7;
    const calloutBox = { x: area.x, y: area.y + area.h - calloutH, w: area.w, h: calloutH };
    elements.push(...noteBlock(calloutBox, { label: "Roadmap:", text: roadmap.callout, color: accent, theme, warnings, where }));
    regionBottom = calloutBox.y - theme.spacing.md;
  }

  const region = { x: area.x, y: header.bottom + theme.spacing.md, w: area.w, h: regionBottom - (header.bottom + theme.spacing.md) };
  const n = items.length;
  const slot = region.w / n;
  const cy = region.y + region.h * 0.5;
  const r = Math.min(0.66, slot * 0.28, region.h * 0.15);
  const centers = items.map((_, i) => ({ x: region.x + slot * i + slot / 2, y: cy }));

  // Dashed connector: per-gap semicircle arcs that bow over (above) / under
  // (below) alternately, anchored at the circle edges — so the line appears to
  // wrap around each circle, entering one side and leaving the other.
  if (n > 1) {
    const lx = (px: number) => (px - region.x) * VB;
    const ly = (py: number) => (py - region.y) * VB;
    const hump = Math.min(0.82, region.h * 0.17);
    let d = "";
    for (let i = 0; i < n - 1; i++) {
      const above = i % 2 === 0;
      const ax = centers[i].x + r; // right edge of circle i
      const bx = centers[i + 1].x - r; // left edge of circle i+1
      const rx = (bx - ax) / 2;
      const sweep = above ? 0 : 1; // 0 → bows up, 1 → bows down (screen coords)
      d += `M${lx(ax).toFixed(1)} ${ly(cy).toFixed(1)} A${(rx * VB).toFixed(1)} ${(hump * VB).toFixed(1)} 0 0 ${sweep} ${lx(bx).toFixed(1)} ${ly(cy).toFixed(1)} `;
    }
    elements.push({
      id: uid("rmpath"),
      type: "shape",
      shape: "freeform",
      box: { ...region },
      style: { fill: { type: "none" }, stroke: { color: theme.colors.border, width: 1.5, dash: "dash", round: true } },
      geometry: { segments: parsePath(d), viewBox: { w: region.w * VB, h: region.h * VB }, filled: false, path: d },
    });
    // small accent dots flanking the chain (entry / exit)
    elements.push({ id: uid("rmcap"), type: "shape", shape: "ellipse", box: { x: centers[0].x - r - 0.18, y: cy - 0.05, w: 0.1, h: 0.1 }, style: { fill: { type: "solid", color: accent } } });
    elements.push({ id: uid("rmcap"), type: "shape", shape: "ellipse", box: { x: centers[n - 1].x + r + 0.08, y: cy - 0.05, w: 0.1, h: 0.1 }, style: { fill: { type: "solid", color: accent } } });
  }

  items.forEach((p, i) => {
    const c = centers[i];
    const filled = i % 2 === 1; // alternate accent / surface
    const fill = filled ? accent : theme.colors.surface;
    const labelColor = filled ? onColor(accent) : theme.colors.text;

    // Circle.
    elements.push({
      id: uid("rmcirc"),
      type: "shape",
      shape: "ellipse",
      box: { x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 },
      style: { fill: { type: "solid", color: fill }, stroke: { color: filled ? accent : theme.colors.border, width: 1.5 }, shadow: theme.shadows.soft },
    });
    checkBudget(p.node, CAPACITY.roadmap.node, `roadmap node "${p.node}"`, warnings, where);
    elements.push({
      id: uid("rmnode"),
      type: "text",
      box: { x: c.x - r, y: c.y - r, w: r * 2, h: r * 2 },
      text: p.node,
      style: { ...theme.typography.bodyStrong, size: p.node.length <= 8 ? 12 : 10, bold: true, color: labelColor, align: "center", vAlign: "middle" },
      padding: 0.02,
      noWrap: true,
    });

    // Description block: above for even index, below for odd. Title then body,
    // stacked top-down (no overlap). Leave room for the looping connector.
    const above = i % 2 === 0;
    const gap = 0.2;
    const blockH = Math.max(0.6, Math.min(1.3, region.h / 2 - r - gap - 0.1));
    const blockW = Math.min(slot - 0.2, 2.6);
    const blockX = c.x - blockW / 2;
    const blockY = above ? c.y - r - gap - blockH : c.y + r + gap;
    let ty = blockY;
    const th = 0.34;
    if (p.title) {
      checkBudget(p.title, CAPACITY.roadmap.title, `roadmap title "${p.title}"`, warnings, where);
      const tf = fitText(p.title, { boxW: blockW, boxH: th, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 13, color: theme.colors.text, align: "center" }, minFontSize: 10, maxLines: 1 }, warnings, where);
      elements.push({ id: uid("rmtitle"), type: "text", box: { x: blockX, y: ty, w: blockW, h: th }, text: tf.text, style: { ...tf.style, vAlign: "top" }, padding: 0.02 });
      ty += th + 0.04;
    }
    if (p.body) {
      const bodyLines = checkBudget(p.body, CAPACITY.roadmap.body, "roadmap body", warnings, where);
      const bodyH = Math.max(0.4, blockY + blockH - ty);
      const bf = fitText(p.body, { boxW: blockW, boxH: bodyH, padding: 0.02, base: { ...theme.typography.body, size: 11, color: theme.colors.textMuted, align: "center" }, minFontSize: 9, maxLines: bodyLines }, warnings, where);
      elements.push({ id: uid("rmbody"), type: "text", box: { x: blockX, y: ty, w: blockW, h: bodyH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
    }
  });

  return { slide: { id: slideId, background: bg, elements, notes: roadmap.notes }, warnings };
}
