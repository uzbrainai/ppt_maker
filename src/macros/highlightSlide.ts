/**
 * Highlight slide.
 *
 * A two-column statement layout: on the left a large statement (title +
 * supporting paragraph) on a soft panel; on the right a featured gradient card
 * (heading + a small rising-bars motif) above a list of outlined "pill" rows.
 * (The "plays a pivotal role… / key financial highlights" look.)
 */

import type {
  HighlightSlideSpec,
  PPTElement,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, split, rows } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { readableOn } from "../core/color.js";
import { buildIcon } from "../geometry/icons.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, fitText, imageContainer, scrim, uid } from "./shared.js";
import { backgroundRect } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

function normPill(it: string | [string] | { t?: string; title?: string; label?: string }): string {
  if (typeof it === "string") return it;
  if (Array.isArray(it)) return it[0] ?? "";
  return it.title ?? it.t ?? it.label ?? "";
}

export function expandHighlightSlide(
  spec: HighlightSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { highlight } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(highlight.class, where);
  warnings.merge(classWarn);

  const pills = highlight.items.map(normPill);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);
  const [left, right] = split(area, 0.5, theme.spacing.lg);

  // ---- Left statement panel ----
  elements.push({
    id: uid("hlpanel"),
    type: "shape",
    shape: "roundRect",
    box: left,
    style: { fill: { type: "solid", color: theme.colors.surface }, radius: theme.radius.xl },
  });
  const lpad = theme.spacing.lg;
  const lInnerX = left.x + lpad;
  const lInnerW = left.w - lpad * 2;
  const titleH = Math.min(2.6, left.h * 0.5);
  checkBudget(highlight.t, CAPACITY.highlight.title, "highlight title", warnings, where);
  const tf = fitText(highlight.t, { boxW: lInnerW, boxH: titleH, padding: 0.02, base: { ...theme.typography.h1, size: 34, color: theme.colors.text, align: "left" }, minFontSize: 20, maxLines: 4 }, warnings, where);
  elements.push({ id: uid("hltitle"), type: "text", box: { x: lInnerX, y: left.y + lpad, w: lInnerW, h: titleH }, text: tf.text, style: { ...tf.style, vAlign: "top" }, padding: 0.02 });
  if (highlight.s) {
    checkBudget(highlight.s, CAPACITY.highlight.body, "highlight body", warnings, where);
    const by = left.y + lpad + titleH + theme.spacing.md;
    const bh = left.y + left.h - lpad - by;
    const bf = fitText(highlight.s, { boxW: lInnerW, boxH: bh, padding: 0.02, base: { ...theme.typography.body, size: 14, color: theme.colors.textMuted, align: "left" }, minFontSize: 10, maxLines: 8 }, warnings, where);
    elements.push({ id: uid("hlbody"), type: "text", box: { x: lInnerX, y: by, w: lInnerW, h: bh }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
  }

  // ---- Right: featured card + pills ----
  const featH = Math.min(2.0, right.h * 0.36);
  const featBox = { x: right.x, y: right.y, w: right.w, h: featH };
  const fpad = theme.spacing.md;
  const headTxt = highlight.featured ?? "Key highlights";
  checkBudget(headTxt, CAPACITY.highlight.featured, "highlight featured", warnings, where);
  const hasImage = !!highlight.image?.data?.length;
  if (hasImage) {
    // Featured card is the image, with a scrim + the heading overlaid.
    elements.push(...imageContainer(highlight.image, featBox, theme, { fit: "cover", radius: theme.radius.lg }));
    elements.push(scrim(featBox, true));
    const hf = fitText(headTxt, { boxW: featBox.w - fpad * 2, boxH: featH - fpad * 2, padding: 0.02, base: { ...theme.typography.h2, size: 20, color: "#FFFFFF", align: "left" }, minFontSize: 13, maxLines: 2 }, warnings, where);
    elements.push({ id: uid("hlfeattx"), type: "text", box: { x: featBox.x + fpad, y: featBox.y + featH - fpad - 0.6, w: featBox.w - fpad * 2, h: 0.6 }, text: hf.text, style: { ...hf.style, vAlign: "bottom" }, padding: 0.02 });
  } else {
    elements.push({
      id: uid("hlfeat"),
      type: "shape",
      shape: "roundRect",
      box: featBox,
      style: { fill: { type: "linearGradient", angle: 120, stops: [{ color: theme.colors.primaryDark, pos: 0 }, { color: accent, pos: 1 }] }, radius: theme.radius.lg },
    });
    const featFg = readableOn(accent);
    const hf = fitText(headTxt, { boxW: featBox.w * 0.62, boxH: featH - fpad * 2, padding: 0.02, base: { ...theme.typography.h2, size: 20, color: featFg.strong, align: "left" }, minFontSize: 13, maxLines: 2 }, warnings, where);
    elements.push({ id: uid("hlfeattx"), type: "text", box: { x: featBox.x + fpad, y: featBox.y + fpad, w: featBox.w * 0.62, h: featH - fpad * 2 }, text: hf.text, style: { ...hf.style, vAlign: "middle" }, padding: 0.02 });
    // Decorative icon (NOT a chart) on the right of the featured card.
    const iconName = highlight.icon ?? "sparkles";
    const isz = Math.min(featH * 0.55, 1.1);
    const { elements: iconEls } = buildIcon(iconName, { x: featBox.x + featBox.w - isz - fpad, y: featBox.y + (featH - isz) / 2, w: isz, h: isz }, { color: featFg.strong, strokeWidth: 2.2 });
    elements.push(...iconEls);
  }

  // Pills.
  const pillsTop = featBox.y + featH + theme.spacing.md;
  const pillArea = { x: right.x, y: pillsTop, w: right.w, h: right.y + right.h - pillsTop };
  const rowBoxes = rows(pillArea, pills.length, theme.spacing.sm);
  pills.forEach((label, i) => {
    const rb = rowBoxes[i];
    if (!rb) return;
    checkBudget(label, CAPACITY.highlight.item, `highlight item "${label}"`, warnings, where);
    elements.push({
      id: uid("hlpill"),
      type: "shape",
      shape: "roundRect",
      box: { ...rb },
      style: { fill: { type: "solid", color: theme.colors.surface }, stroke: { color: theme.colors.border, width: 1 }, radius: theme.radius.lg },
    });
    const lf = fitText(label, { boxW: rb.w - theme.spacing.lg * 2, boxH: rb.h, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 15, color: theme.colors.text, align: "left" }, minFontSize: 11, maxLines: 1 }, warnings, where);
    elements.push({ id: uid("hlpilltx"), type: "text", box: { x: rb.x + theme.spacing.lg, y: rb.y, w: rb.w - theme.spacing.lg * 2, h: rb.h }, text: lf.text, style: { ...lf.style, vAlign: "middle" }, padding: 0.02 });
  });

  return { slide: { id: slideId, background: bg, elements, notes: highlight.notes }, warnings };
}
