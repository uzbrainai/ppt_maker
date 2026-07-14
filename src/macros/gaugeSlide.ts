/**
 * Gauge slide expander — KPI cards, each with a circular progress ring showing a
 * percentage, the value in the center, a title and a short description.
 */

import type {
  GaugeSlideSpec,
  GaugeTuple,
  GroupElement,
  PPTElement,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { autoGrid, gridCells } from "../layout/grid.js";
import { contentArea, reserveTitle } from "../layout/boxes.js";
import { buildRing } from "../geometry/charts.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { Warnings } from "../validation/warnings.js";
import { backgroundFill, cardLook, fitText, groupColors } from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import { uid } from "./shared.js";
import type { ExpandedSlide } from "./titleSlide.js";

interface Gauge {
  value: string;
  title: string;
  body?: string;
  group?: string;
}

function normalize(it: GaugeTuple): Gauge {
  if (Array.isArray(it)) {
    return it.length >= 3
      ? { value: it[0], title: it[1], body: it[2] }
      : { value: it[0], title: it[1] };
  }
  return { value: it.value ?? it.v ?? "", title: it.title ?? it.t ?? it.label ?? "", body: it.body ?? it.s };
}

function pct(value: string): number {
  const m = value.match(/-?\d+(?:\.\d+)?/);
  return m ? Math.max(0, Math.min(100, Number(m[0]))) : 0;
}

export function expandGaugeSlide(
  spec: GaugeSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { gauge } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(gauge.class, where);
  warnings.merge(classWarn);

  const items = gauge.items.map(normalize);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const gap = theme.spacing[tokens.gap ?? "md"];
  const colors = groupColors(items, tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);
  const hasTitle = !!gauge.t;
  const { title: titleBox, rest } = hasTitle ? reserveTitle(area, 0.9, theme.spacing.md) : { title: undefined, rest: area };
  if (hasTitle && titleBox) elements.push(titleElement(gauge.t!, titleBox, theme, bg, warnings, where));

  const grid =
    tokens.layout && tokens.layout.kind === "grid"
      ? { cols: tokens.layout.cols, rows: tokens.layout.rows }
      : autoGrid(items.length);
  const rowsNeeded = Math.max(grid.rows, Math.ceil(items.length / grid.cols));
  let tileArea = rest;
  if (rowsNeeded === 1 && rest.h > 3.4) {
    const h = Math.min(rest.h, 3.2);
    tileArea = { x: rest.x, y: rest.y + (rest.h - h) / 2, w: rest.w, h };
  }
  const { cells } = gridCells(tileArea, grid.cols, rowsNeeded, gap);

  items.forEach((item, i) => {
    const cell = cells[i];
    if (!cell) return;
    elements.push(buildGauge(item, cell, colors[i], { theme, tokens, warnings, where }));
  });

  return { slide: { id: slideId, background: bg, elements, notes: gauge.notes }, warnings };
}

function buildGauge(
  item: Gauge,
  cell: { x: number; y: number; w: number; h: number },
  color: string,
  opts: { theme: ResolvedTheme; tokens: ReturnType<typeof resolveClasses>["tokens"]; warnings: Warnings; where: string }
): GroupElement {
  const { theme } = opts;
  const look = cardLook(opts.tokens, theme, color);
  const children: PPTElement[] = [];

  children.push({ id: uid("gcard"), type: "shape", shape: "roundRect", box: { ...cell }, style: look.style });

  const pad = theme.spacing.md;
  // Ring fills the upper portion of the card (larger so the value reads clearly).
  const ringSize = Math.min(cell.w - pad * 2, cell.h * 0.56);
  const ringBox = { x: cell.x + (cell.w - ringSize) / 2, y: cell.y + pad, w: ringSize, h: ringSize };
  children.push(...buildRing(ringBox, pct(item.value), color, { theme, label: item.value }));

  let y = ringBox.y + ringSize + theme.spacing.sm;

  // Title.
  const titleH = 0.4;
  checkBudget(item.title, CAPACITY.card.title, `gauge title "${item.title}"`, opts.warnings, opts.where);
  const tf = fitText(item.title, { boxW: cell.w - pad * 2, boxH: titleH, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 15, color: look.textColor, align: "center" }, minFontSize: 11, maxLines: 2 }, opts.warnings, opts.where);
  children.push({ id: uid("gtitle"), type: "text", box: { x: cell.x + pad, y, w: cell.w - pad * 2, h: titleH }, text: tf.text, style: { ...tf.style, vAlign: "top" }, padding: 0.02 });
  y += titleH + theme.spacing.xs;

  if (item.body) {
    checkBudget(item.body, CAPACITY.card.body, "gauge body", opts.warnings, opts.where);
    const bodyH = cell.y + cell.h - pad - y;
    const bf = fitText(item.body, { boxW: cell.w - pad * 2, boxH: bodyH, padding: 0.02, base: { ...theme.typography.body, size: 12, color: look.mutedTextColor, align: "center" }, minFontSize: 9, maxLines: 3 }, opts.warnings, opts.where);
    children.push({ id: uid("gbody"), type: "text", box: { x: cell.x + pad, y, w: cell.w - pad * 2, h: bodyH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
  }

  return { id: uid("ggrp"), type: "group", box: { ...cell }, children };
}
