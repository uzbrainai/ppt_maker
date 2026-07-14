/**
 * Problem / big-number cards slide.
 *
 * A row of large cards, each led by an oversized 01/02/03 number, then a bold
 * title and a paragraph of detail. Card fills alternate accent → ink → light so
 * the row has rhythm (the "What's Broken in Today's Market" look). Text color is
 * contrast-aware on every fill.
 */

import type {
  GroupElement,
  PPTElement,
  ProblemSlideSpec,
  ProblemTuple,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, reserveTitle, columns } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { mix, readableOn } from "../core/color.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, fitText, uid } from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

interface Problem {
  title: string;
  body?: string;
}

function normalize(it: ProblemTuple): Problem {
  if (Array.isArray(it)) return { title: it[0], body: it[1] };
  return { title: it.title ?? it.t ?? "", body: it.body ?? it.s };
}

export function expandProblemSlide(
  spec: ProblemSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { problem } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(problem.class, where);
  warnings.merge(classWarn);

  const items = problem.items.map(normalize);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);
  const hasTitle = !!problem.t;
  const { title: titleBox, rest } = hasTitle
    ? reserveTitle(area, problem.s ? 1.5 : 1.2, theme.spacing.md)
    : { title: undefined, rest: area };
  if (hasTitle && titleBox) elements.push(titleElement(problem.t!, titleBox, theme, bg, warnings, where));

  // Alternating fills: accent, an ink panel, a light panel.
  const ink = mix(theme.colors.text, theme.colors.background, 0.12);
  const light = theme.colors.surfaceMuted;
  const fills = [accent, ink, light];

  const cells = columns(rest, items.length, theme.spacing.md);
  items.forEach((p, i) => {
    const cell = cells[i];
    if (!cell) return;
    elements.push(buildProblemCard(p, i, cell, fills[i % fills.length], { theme, warnings, where }));
  });

  return { slide: { id: slideId, background: bg, elements, notes: problem.notes }, warnings };
}

function buildProblemCard(
  p: Problem,
  index: number,
  cell: { x: number; y: number; w: number; h: number },
  fill: string,
  opts: { theme: ResolvedTheme; warnings: Warnings; where: string }
): GroupElement {
  const { theme } = opts;
  const fg = readableOn(fill);
  const children: PPTElement[] = [];

  children.push({
    id: uid("pcard"),
    type: "shape",
    shape: "roundRect",
    box: { ...cell },
    style: { fill: { type: "solid", color: fill }, radius: theme.radius.xl, shadow: theme.shadows.soft },
  });

  const pad = theme.spacing.lg;
  const innerX = cell.x + pad;
  const innerW = cell.w - pad * 2;
  let y = cell.y + pad;

  // Big number.
  const numH = Math.min(1.3, cell.h * 0.26);
  children.push({
    id: uid("pnum"),
    type: "text",
    box: { x: innerX, y, w: innerW, h: numH },
    text: `${String(index + 1).padStart(2, "0")}.`,
    style: { ...theme.typography.h1, size: Math.round(numH * 58), bold: true, color: fg.strong, align: "left", vAlign: "middle" },
    padding: 0,
    noWrap: true,
  });
  y += numH + theme.spacing.md;

  // Title.
  const titleLines = checkBudget(p.title, CAPACITY.problem.title, `problem title "${p.title}"`, opts.warnings, opts.where);
  const titleH = 0.9;
  const tf = fitText(p.title, { boxW: innerW, boxH: titleH, padding: 0.02, base: { ...theme.typography.h2, size: 19, color: fg.strong, align: "left" }, minFontSize: 14, maxLines: titleLines }, opts.warnings, opts.where);
  children.push({ id: uid("ptitle"), type: "text", box: { x: innerX, y, w: innerW, h: titleH }, text: tf.text, style: { ...tf.style, vAlign: "top" }, padding: 0.02 });
  y += titleH + theme.spacing.sm;

  // Body.
  if (p.body) {
    const bodyLines = checkBudget(p.body, CAPACITY.problem.body, "problem body", opts.warnings, opts.where);
    const bodyH = cell.y + cell.h - pad - y;
    const bf = fitText(p.body, { boxW: innerW, boxH: bodyH, padding: 0.02, base: { ...theme.typography.body, size: 13, color: fg.soft, align: "left" }, minFontSize: 10, maxLines: bodyLines }, opts.warnings, opts.where);
    children.push({ id: uid("pbody"), type: "text", box: { x: innerX, y, w: innerW, h: bodyH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
  }

  return { id: uid("pgrp"), type: "group", box: { ...cell }, children };
}
