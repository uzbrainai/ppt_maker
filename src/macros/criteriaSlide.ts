/**
 * Criteria / comparison-points slide.
 *
 * A centered title + subtitle, then items laid out in two columns. Each item is
 * a numbered circle joined by a rounded connector bar to a white card with a
 * bold title and a short description. (The "Key Comparison Points" look.) Circle
 * colors follow the theme's intensity ramp.
 */

import type {
  CriteriaSlideSpec,
  CriteriaTuple,
  GroupElement,
  PPTElement,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, split, rows } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { tint, mix } from "../core/color.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, fitText, onColor, uid } from "./shared.js";
import { backgroundRect } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

interface Criterion {
  title: string;
  body?: string;
}

function normalize(it: CriteriaTuple): Criterion {
  if (Array.isArray(it)) return { title: it[0], body: it[1] };
  return { title: it.title ?? it.t ?? "", body: it.body ?? it.s };
}

export function expandCriteriaSlide(
  spec: CriteriaSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { criteria } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(criteria.class, where);
  warnings.merge(classWarn);

  const items = criteria.items.map(normalize);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);

  // Centered title + subtitle.
  let top = area.y;
  if (criteria.t) {
    const tf = fitText(criteria.t, { boxW: area.w, boxH: 0.7, padding: 0.02, base: { ...theme.typography.h1, size: 30, color: theme.colors.text, align: "center" }, minFontSize: 20, maxLines: 1 }, warnings, where);
    elements.push({ id: uid("crtitle"), type: "text", box: { x: area.x, y: top, w: area.w, h: 0.7 }, text: tf.text, style: { ...tf.style, vAlign: "middle" }, padding: 0.02 });
    top += 0.72;
  }
  if (criteria.s) {
    const sf = fitText(criteria.s, { boxW: area.w, boxH: 0.4, padding: 0.02, base: { ...theme.typography.body, size: 15, color: theme.colors.textMuted, align: "center" }, minFontSize: 11, maxLines: 1 }, warnings, where);
    elements.push({ id: uid("crsub"), type: "text", box: { x: area.x, y: top, w: area.w, h: 0.4 }, text: sf.text, style: { ...sf.style, vAlign: "middle" }, padding: 0.02 });
    top += 0.5;
  }

  const region = { x: area.x, y: top + theme.spacing.sm, w: area.w, h: area.y + area.h - (top + theme.spacing.sm) };
  const n = items.length;
  const perCol = Math.ceil(n / 2);
  const [colL, colR] = split(region, 0.5, theme.spacing.lg);
  const light = tint(accent, 0.55);
  const dark = mix(accent, "#000000", 0.25);

  items.forEach((it, i) => {
    const colIdx = Math.floor(i / perCol);
    const rowInCol = i % perCol;
    const col = colIdx === 0 ? colL : colR;
    const rb = rows(col, perCol, theme.spacing.md)[rowInCol];
    if (!rb) return;
    // Intensity ramp top→bottom within the deck order.
    const t = n > 1 ? i / (n - 1) : 0;
    const color = mix(light, dark, t);
    elements.push(buildCriterion(it, i, rb, color, { theme, warnings, where }));
  });

  return { slide: { id: slideId, background: bg, elements, notes: criteria.notes }, warnings };
}

function buildCriterion(
  it: Criterion,
  index: number,
  row: { x: number; y: number; w: number; h: number },
  color: string,
  opts: { theme: ResolvedTheme; warnings: Warnings; where: string }
): GroupElement {
  const { theme } = opts;
  const children: PPTElement[] = [];
  const cyc = row.y + row.h / 2;

  const circ = Math.min(1.0, row.h * 0.9);
  const circBox = { x: row.x, y: cyc - circ / 2, w: circ, h: circ };

  // Rounded connector bar behind, between circle and card.
  const barW = 0.16;
  children.push({
    id: uid("crbar"),
    type: "shape",
    shape: "roundRect",
    box: { x: circBox.x + circ - barW / 2, y: row.y + 0.05, w: barW, h: row.h - 0.1 },
    style: { fill: { type: "solid", color: tintLike(color, theme), }, radius: theme.radius.pill },
  });

  // Card.
  const cardX = circBox.x + circ + 0.34;
  const cardBox = { x: cardX, y: row.y, w: row.x + row.w - cardX, h: row.h };
  children.push({
    id: uid("crcard"),
    type: "shape",
    shape: "roundRect",
    box: cardBox,
    style: { fill: { type: "solid", color: theme.colors.surface }, stroke: { color: theme.colors.border, width: 1 }, radius: theme.radius.lg, shadow: theme.shadows.soft },
  });
  // small connector dot where the bar meets the card
  children.push({ id: uid("crdot"), type: "shape", shape: "ellipse", box: { x: cardX - 0.18, y: cyc - 0.06, w: 0.12, h: 0.12 }, style: { fill: { type: "solid", color } } });

  // Numbered circle (on top).
  children.push({
    id: uid("crcirc"),
    type: "shape",
    shape: "ellipse",
    box: circBox,
    style: { fill: { type: "solid", color }, shadow: theme.shadows.soft },
  });
  children.push({
    id: uid("crnum"),
    type: "text",
    box: circBox,
    text: String(index + 1).padStart(2, "0"),
    style: { ...theme.typography.h2, size: Math.round(circ * 26), bold: true, color: onColor(color), align: "center", vAlign: "middle" },
    padding: 0,
    noWrap: true,
  });

  // Card text.
  const pad = theme.spacing.md;
  const innerX = cardBox.x + pad;
  const innerW = cardBox.w - pad * 2;
  let y = cardBox.y + pad * 0.8;
  const titleLines = checkBudget(it.title, CAPACITY.criteria.title, `criteria title "${it.title}"`, opts.warnings, opts.where);
  const th = 0.36;
  const tf = fitText(it.title, { boxW: innerW, boxH: th, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 15, color: theme.colors.text, align: "left" }, minFontSize: 11, maxLines: titleLines }, opts.warnings, opts.where);
  children.push({ id: uid("crttl"), type: "text", box: { x: innerX, y, w: innerW, h: th }, text: tf.text, style: { ...tf.style, vAlign: "top" }, padding: 0.02 });
  y += th + theme.spacing.xs;
  if (it.body) {
    const bodyLines = checkBudget(it.body, CAPACITY.criteria.body, "criteria body", opts.warnings, opts.where);
    const bodyH = cardBox.y + cardBox.h - pad * 0.8 - y;
    const bf = fitText(it.body, { boxW: innerW, boxH: bodyH, padding: 0.02, base: { ...theme.typography.body, size: 12, color: theme.colors.textMuted, align: "left" }, minFontSize: 9, maxLines: bodyLines }, opts.warnings, opts.where);
    children.push({ id: uid("crbody"), type: "text", box: { x: innerX, y, w: innerW, h: bodyH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
  }

  return { id: uid("crgrp"), type: "group", box: { ...row }, children };
}

function tintLike(color: string, theme: ResolvedTheme): string {
  return mix(color, theme.colors.background, 0.35);
}
