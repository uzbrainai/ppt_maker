/**
 * KPI / stat slide expander.
 *
 * Produces a row (or grid) of stat tiles: a big colored number/value and a
 * caption label, optionally an icon. Great for "impact in numbers" slides.
 */

import type {
  GroupElement,
  KpiSlideSpec,
  KpiTuple,
  PPTElement,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { autoGrid, gridCells } from "../layout/grid.js";
import { contentArea, reserveTitle } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { buildIcon } from "../geometry/icons.js";
import { tint } from "../core/color.js";
import { Warnings } from "../validation/warnings.js";
import {
  backgroundFill,
  cardLook,
  fitText,
  groupColors,
  uid,
} from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

interface Kpi {
  value: string;
  label: string;
  icon?: string;
  group?: string;
}

function normalizeKpi(item: KpiTuple): Kpi {
  if (Array.isArray(item)) {
    return item.length === 3
      ? { value: item[0], label: item[1], icon: item[2] }
      : { value: item[0], label: item[1] };
  }
  return { value: item.value ?? item.v ?? "", label: item.label ?? item.l ?? "", icon: item.icon };
}

export function expandKpiSlide(
  spec: KpiSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { kpi } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(kpi.class, where);
  warnings.merge(classWarn);

  const items = kpi.items.map(normalizeKpi);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const gap = theme.spacing[tokens.gap ?? "md"];

  const elements: PPTElement[] = [backgroundRect(bg, size)];

  const area = contentArea(size, theme, tokens);
  const hasTitle = !!kpi.t;
  const { title: titleBox, rest } = hasTitle
    ? reserveTitle(area, 0.9, theme.spacing.md)
    : { title: undefined, rest: area };
  if (hasTitle && titleBox) elements.push(titleElement(kpi.t!, titleBox, theme, bg, warnings, where));

  const grid =
    tokens.layout && tokens.layout.kind === "grid"
      ? { cols: tokens.layout.cols, rows: tokens.layout.rows }
      : autoGrid(items.length);
  const rowsNeeded = Math.max(grid.rows, Math.ceil(items.length / grid.cols));
  // Space-aware: tiles fill the whole content area (no empty band below a
  // single row). For one tall row we cap height a little so tiles don't become
  // awkwardly stretched, but otherwise they grow to use the page.
  let tileArea = rest;
  if (rowsNeeded === 1 && rest.h > 3.6) {
    const h = Math.min(rest.h, 3.4);
    tileArea = { x: rest.x, y: rest.y + (rest.h - h) / 2, w: rest.w, h };
  }
  const { cells } = gridCells(tileArea, grid.cols, rowsNeeded, gap);
  const colors = groupColors(items, tokens, theme);

  items.forEach((item, i) => {
    const cell = cells[i];
    if (!cell) return;
    elements.push(buildTile(item, cell, { theme, tokens, color: colors[i], warnings, where }));
  });

  return { slide: { id: slideId, background: bg, elements, notes: kpi.notes }, warnings };
}

function buildTile(
  item: Kpi,
  cell: { x: number; y: number; w: number; h: number },
  opts: { theme: ResolvedTheme; tokens: ReturnType<typeof resolveClasses>["tokens"]; color: string; warnings: Warnings; where: string }
): GroupElement {
  const { theme, color } = opts;
  const look = cardLook(opts.tokens, theme, color);
  const children: PPTElement[] = [];

  children.push({
    id: uid("kpi"),
    type: "shape",
    shape: "roundRect",
    box: { ...cell },
    style: look.style,
  });

  const pad = theme.spacing.md;
  const innerX = cell.x + pad;
  const innerW = cell.w - pad * 2;
  const bottom = cell.y + cell.h - pad;

  // Icon chip top-left (optional).
  let topY = cell.y + pad;
  if (item.icon) {
    const chip = Math.min(0.62, cell.h * 0.22);
    children.push({
      id: uid("kpichip"),
      type: "shape",
      shape: "roundRect",
      box: { x: innerX, y: topY, w: chip, h: chip },
      style: { fill: { type: "solid", color: tint(color, 0.84) }, radius: theme.radius.md },
    });
    const s = chip * 0.6;
    const { elements: ic } = buildIcon(item.icon, { x: innerX + (chip - s) / 2, y: topY + (chip - s) / 2, w: s, h: s }, { color });
    children.push(...ic);
    topY += chip + theme.spacing.sm;
  }

  // The label sits at the bottom; the value fills everything in between and its
  // font scales with the tile height so big tiles aren't mostly empty.
  const labelH = Math.min(0.9, (bottom - topY) * 0.34);
  const dividerY = bottom - labelH - theme.spacing.sm;
  const valueBox = { x: innerX, y: topY, w: innerW, h: dividerY - 0.05 - topY };
  // Size the value by BOTH height and width so a wide value (e.g. "+40%") never
  // wraps. Bold display glyphs are wide, so use a generous per-glyph factor.
  checkBudget(item.value, CAPACITY.kpi.value, `KPI value "${item.value}"`, opts.warnings, opts.where);
  const glyphs = Math.max(2, item.value.length);
  const widthSize = ((valueBox.w - 0.12) * 72) / (glyphs * 0.72);
  const heightSize = valueBox.h * 60;
  const valueSize = Math.max(26, Math.min(74, Math.round(Math.min(widthSize, heightSize))));
  const valueBase = { ...theme.typography.kpi, color, align: "left" as const, size: valueSize };
  children.push({
    id: uid("kpival"),
    type: "text",
    box: valueBox,
    text: item.value,
    style: { ...valueBase, vAlign: "bottom" },
    padding: 0.02,
    noWrap: true,
  });

  // Accent divider.
  children.push({
    id: uid("kpidiv"),
    type: "shape",
    shape: "roundRect",
    box: { x: innerX, y: dividerY, w: 0.7, h: 0.05 },
    style: { fill: { type: "solid", color: tint(color, 0.3) }, radius: theme.radius.pill },
  });

  // Label at the bottom.
  const labelBox = { x: innerX, y: dividerY + 0.05 + theme.spacing.xs, w: innerW, h: bottom - (dividerY + 0.05 + theme.spacing.xs) };
  const labelBase = { ...theme.typography.body, color: look.mutedTextColor, align: "left" as const, size: 13 };
  const labelLines = checkBudget(item.label, CAPACITY.kpi.label, "KPI label", opts.warnings, opts.where);
  const labelFit = fitText(item.label, { boxW: labelBox.w, boxH: labelBox.h, padding: 0.02, base: labelBase, minFontSize: 9, maxLines: labelLines }, opts.warnings, opts.where);
  children.push({
    id: uid("kpilbl"),
    type: "text",
    box: labelBox,
    text: labelFit.text,
    style: { ...labelFit.style, vAlign: "top" },
    padding: 0.02,
    fit: { mode: "shrink", minFontSize: 9 },
  });

  return { id: uid("kpigrp"), type: "group", box: { ...cell }, children };
}
