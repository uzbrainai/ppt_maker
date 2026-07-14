/**
 * Table slide expander — a clean, editable table: a colored header row, zebra
 * data rows, auto right-aligned numeric cells, and an optional summary block at
 * the bottom. Built from editable shapes/text (every cell selectable).
 */

import type {
  GroupElement,
  PPTElement,
  ResolvedTheme,
  SlideSize,
  TableSlideSpec,
  TextStyle,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, reserveTitle } from "../layout/boxes.js";
import { tint, shade, luminance } from "../core/color.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, fitText, noteBlock, onColor, uid } from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

const NUMERIC = /^[-+]?[\d][\d.,\s]*%?$|^[-+]?\$?\d[\d.,\s]*[kKmMbB]?$/;

function isNumeric(v: string): boolean {
  return NUMERIC.test(v.trim());
}

export function expandTableSlide(
  spec: TableSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { table } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(table.class, where);
  warnings.merge(classWarn);

  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);
  const cols = table.columns;
  const rows = table.rows.map((r) => r.map((c) => String(c)));

  const elements: PPTElement[] = [backgroundRect(bg, size)];

  const area = contentArea(size, theme, tokens);
  const hasTitle = !!table.t;
  let { title: titleBox, rest } = hasTitle
    ? reserveTitle(area, 0.9, theme.spacing.md)
    : { title: undefined, rest: area };
  if (hasTitle && titleBox) elements.push(titleElement(table.t!, titleBox, theme, bg, warnings, where));

  // Reserve a summary band at the bottom.
  if (table.summary) {
    checkBudget(table.summary, CAPACITY.table.summary, "table summary", warnings, where);
    const sh = Math.min(1.0, Math.max(0.75, rest.h * 0.18));
    const summaryBox = { x: rest.x, y: rest.y + rest.h - sh, w: rest.w, h: sh };
    elements.push(...noteBlock(summaryBox, { text: table.summary, color: accent, theme, warnings, where }));
    rest = { x: rest.x, y: rest.y, w: rest.w, h: rest.h - sh - theme.spacing.md };
  }

  elements.push(buildTable(cols, rows, rest, accent, { theme, warnings, where }));

  return { slide: { id: slideId, background: bg, elements, notes: table.notes }, warnings };
}

function buildTable(
  cols: string[],
  rows: string[][],
  area: { x: number; y: number; w: number; h: number },
  accent: string,
  opts: { theme: ResolvedTheme; warnings: Warnings; where: string }
): GroupElement {
  const { theme } = opts;
  const dark = luminance(theme.colors.background) < 0.4;
  const children: PPTElement[] = [];

  const n = cols.length;
  // Column weights: first column a bit wider (usually the label).
  const weights = cols.map((_, i) => (i === 0 ? 1.5 : 1));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const colX: number[] = [];
  const colW: number[] = [];
  let cx = area.x;
  for (let i = 0; i < n; i++) {
    const w = (area.w * weights[i]) / totalW;
    colX.push(cx);
    colW.push(w);
    cx += w;
  }

  const totalRows = rows.length + 1; // + header
  const headerH = Math.min(0.6, area.h / totalRows + 0.1);
  const rowH = Math.max(0.32, (area.h - headerH) / Math.max(1, rows.length));
  const pad = theme.spacing.sm;

  // Container.
  children.push({
    id: uid("tbl"),
    type: "shape",
    shape: "roundRect",
    box: { x: area.x, y: area.y, w: area.w, h: headerH + rowH * rows.length },
    style: { fill: { type: "solid", color: theme.colors.surface }, stroke: { color: theme.colors.border, width: 1 }, radius: theme.radius.md, shadow: theme.shadows.soft },
  });

  // Header bar.
  children.push({
    id: uid("thead"),
    type: "shape",
    shape: "roundRect",
    box: { x: area.x, y: area.y, w: area.w, h: headerH },
    style: { fill: { type: "solid", color: accent }, radius: theme.radius.sm },
  });
  const headFg = onColor(accent);
  cols.forEach((c, i) => {
    checkBudget(c, CAPACITY.table.header, `table header "${c}"`, opts.warnings, opts.where);
    const align = i === 0 ? "left" : isNumericCol(rows, i) ? "right" : "left";
    children.push(cell(c, colX[i], area.y, colW[i], headerH, { ...theme.typography.bodyStrong, size: 13, color: headFg, align }, pad, opts));
  });

  // Data rows (zebra).
  rows.forEach((row, r) => {
    const ry = area.y + headerH + r * rowH;
    if (r % 2 === 1) {
      children.push({
        id: uid("trow"),
        type: "shape",
        shape: "rect",
        box: { x: area.x, y: ry, w: area.w, h: rowH },
        style: { fill: { type: "solid", color: dark ? tint(theme.colors.surface, 0.06) : theme.colors.surfaceMuted } },
      });
    }
    row.forEach((c, i) => {
      if (i >= n) return;
      const numeric = isNumeric(c);
      const align = i === 0 ? "left" : numeric ? "right" : "left";
      const color = i === 0 ? theme.colors.text : numeric ? accentText(accent, dark, theme) : theme.colors.textMuted;
      const weight = i === 0 ? true : numeric;
      children.push(cell(c, colX[i], ry, colW[i], rowH, { ...theme.typography.body, size: 12, bold: weight, color, align }, pad, opts));
    });
  });

  return { id: uid("tblgrp"), type: "group", box: { ...area }, children };
}

function accentText(accent: string, dark: boolean, _theme: ResolvedTheme): string {
  return dark ? tint(accent, 0.45) : shade(accent, 0.1);
}

function isNumericCol(rows: string[][], i: number): boolean {
  const vals = rows.map((r) => r[i]).filter((v) => v != null && v !== "");
  return vals.length > 0 && vals.every((v) => isNumeric(v));
}

function cell(
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  base: TextStyle,
  pad: number,
  opts: { warnings: Warnings; where: string }
): PPTElement {
  const fit = fitText(text, { boxW: w - pad, boxH: h, padding: 0.03, base, minFontSize: 9, maxLines: 2 }, opts.warnings, opts.where);
  return {
    id: uid("tc"),
    type: "text",
    box: { x: x + pad / 2, y, w: w - pad, h },
    text: fit.text,
    style: { ...fit.style, vAlign: "middle" },
    padding: 0.03,
  };
}
