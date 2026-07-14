/**
 * Comparison slide expander.
 *
 * Renders 2–4 side-by-side columns, each with a colored header (icon + title +
 * optional subtitle) and a list of points. A column's `tone` colors it:
 *   good → success/green + check markers
 *   bad  → danger/red + cross markers
 *   neutral → muted + dot markers
 * Without a tone, colorful/multi decks pick a palette color per column.
 */

import type {
  CmpColumn,
  CmpSlideSpec,
  GroupElement,
  PPTElement,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, reserveTitle, columns, rows } from "../layout/boxes.js";
import { buildIcon } from "../geometry/icons.js";
import { tint, mix, luminance } from "../core/color.js";
import { Warnings } from "../validation/warnings.js";
import {
  backgroundFill,
  fitText,
  groupColors,
  onColor,
  uid,
} from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

interface Column {
  title: string;
  subtitle?: string;
  icon?: string;
  tone?: "good" | "bad" | "neutral";
  points: string[];
  group?: string;
}

function normalizeColumn(c: CmpColumn): Column {
  return {
    title: c.title ?? c.t ?? "",
    subtitle: c.subtitle ?? c.s,
    icon: c.icon,
    tone: c.tone,
    points: c.points ?? [],
    group: c.group,
  };
}

export function expandCmpSlide(
  spec: CmpSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { cmp } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(cmp.class, where);
  warnings.merge(classWarn);

  const cols = cmp.items.map(normalizeColumn);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const gap = theme.spacing[tokens.gap ?? "md"];

  const elements: PPTElement[] = [backgroundRect(bg, size)];

  const area = contentArea(size, theme, tokens);
  const hasTitle = !!cmp.t;
  const { title: titleBox, rest } = hasTitle
    ? reserveTitle(area, 0.9, theme.spacing.md)
    : { title: undefined, rest: area };
  if (hasTitle && titleBox) elements.push(titleElement(cmp.t!, titleBox, theme, bg, warnings, where));

  const palette = groupColors(cols, tokens, theme);
  const colBoxes = columns(rest, cols.length, gap);

  cols.forEach((col, i) => {
    const cell = colBoxes[i];
    if (!cell) return;
    const color = toneColor(col.tone, theme) ?? palette[i];
    elements.push(buildColumn(col, cell, { theme, color, warnings, where }));
  });

  return { slide: { id: slideId, background: bg, elements, notes: cmp.notes }, warnings };
}

function toneColor(tone: Column["tone"], theme: ResolvedTheme): string | undefined {
  switch (tone) {
    case "good":
      return theme.colors.success;
    case "bad":
      return theme.colors.danger;
    case "neutral":
      return theme.colors.textMuted;
    default:
      return undefined;
  }
}

function buildColumn(
  col: Column,
  cell: { x: number; y: number; w: number; h: number },
  opts: { theme: ResolvedTheme; color: string; warnings: Warnings; where: string }
): GroupElement {
  const { theme, color } = opts;
  const children: PPTElement[] = [];

  // Card background.
  children.push({
    id: uid("cmpcard"),
    type: "shape",
    shape: "roundRect",
    box: { ...cell },
    style: {
      fill: { type: "solid", color: theme.colors.surface },
      stroke: { color: theme.colors.border, width: 1 },
      radius: theme.radius.lg,
      shadow: theme.shadows.soft,
    },
  });

  // Colored header band.
  const headerH = 0.95;
  const headerBox = { x: cell.x, y: cell.y, w: cell.w, h: headerH };
  children.push({
    id: uid("cmphdr"),
    type: "shape",
    shape: "roundRect",
    box: headerBox,
    style: { fill: { type: "solid", color }, radius: theme.radius.lg },
  });
  // Mask the header's lower rounded corners so it sits flush on the card body.
  children.push({
    id: uid("cmphdrmask"),
    type: "shape",
    shape: "rect",
    box: { x: cell.x, y: cell.y + headerH - 0.2, w: cell.w, h: 0.2 },
    style: { fill: { type: "solid", color } },
  });

  const pad = theme.spacing.md;
  const fg = onColor(color);
  let headerTextX = cell.x + pad;
  let headerTextW = cell.w - pad * 2;

  if (col.icon) {
    const s = 0.4;
    const { elements: ic } = buildIcon(col.icon, { x: cell.x + pad, y: cell.y + (headerH - s) / 2 - (col.subtitle ? 0.1 : 0), w: s, h: s }, { color: fg });
    children.push(...ic);
    headerTextX = cell.x + pad + s + theme.spacing.sm;
    headerTextW = cell.w - (headerTextX - cell.x) - pad;
  }

  const titleFit = fitText(col.title, { boxW: headerTextW, boxH: col.subtitle ? 0.45 : headerH, padding: 0.02, base: { ...theme.typography.bodyStrong, color: fg, size: 17, align: "left" }, minFontSize: 12, maxLines: 1 }, opts.warnings, opts.where);
  children.push({
    id: uid("cmptitle"),
    type: "text",
    box: { x: headerTextX, y: cell.y + (col.subtitle ? 0.14 : 0), w: headerTextW, h: col.subtitle ? 0.42 : headerH },
    text: titleFit.text,
    style: { ...titleFit.style, vAlign: col.subtitle ? "bottom" : "middle" },
    padding: 0.02,
  });
  if (col.subtitle) {
    const subFit = fitText(col.subtitle, { boxW: headerTextW, boxH: 0.34, padding: 0.02, base: { ...theme.typography.caption, color: fg, size: 11, align: "left" }, minFontSize: 9, maxLines: 1 }, opts.warnings, opts.where);
    children.push({
      id: uid("cmpsub"),
      type: "text",
      box: { x: headerTextX, y: cell.y + 0.54, w: headerTextW, h: 0.34, },
      text: subFit.text,
      style: { ...subFit.style, vAlign: "top" },
      padding: 0.02,
    });
  }

  // Points list.
  const listBox = { x: cell.x + pad, y: cell.y + headerH + theme.spacing.sm, w: cell.w - pad * 2, h: cell.y + cell.h - (cell.y + headerH + theme.spacing.sm) - pad };
  const rowBoxes = rows(listBox, Math.max(1, col.points.length), theme.spacing.xs);
  col.points.forEach((p, i) => {
    const r = rowBoxes[i];
    if (!r) return;
    const marker = Math.min(0.26, r.h * 0.6);
    const my = r.y + (r.h - marker) / 2;
    // tone marker: check / cross / dot
    const glyph = col.tone === "good" ? "check" : col.tone === "bad" ? "x" : undefined;
    if (glyph) {
      const { elements: ic } = buildIcon(glyph, { x: r.x, y: my, w: marker, h: marker }, { color });
      children.push(...ic);
    } else {
      const dot = marker * 0.5;
      children.push({
        id: uid("cmpdot"),
        type: "shape",
        shape: "ellipse",
        box: { x: r.x + (marker - dot) / 2, y: r.y + (r.h - dot) / 2, w: dot, h: dot },
        style: { fill: { type: "solid", color } },
      });
    }
    const tx = r.x + marker + theme.spacing.sm;
    const pf = fitText(p, { boxW: r.x + r.w - tx, boxH: r.h, padding: 0.02, base: { ...theme.typography.body, color: theme.colors.text, size: 12, align: "left" }, minFontSize: 9, maxLines: 2 }, opts.warnings, opts.where);
    children.push({
      id: uid("cmppt"),
      type: "text",
      box: { x: tx, y: r.y, w: r.x + r.w - tx, h: r.h },
      text: pf.text,
      style: { ...pf.style, vAlign: "middle" },
      padding: 0.02,
    });
  });

  // Subtle tinted body behind points for tone emphasis (dark-mode aware: a
  // light tint on light themes, a dark tinted panel on dark themes).
  if (col.tone) {
    const dark = luminance(theme.colors.background) < 0.4;
    const toneFill = dark ? mix(theme.colors.surface, color, 0.22) : tint(color, 0.93);
    children.splice(1, 0, {
      id: uid("cmptone"),
      type: "shape",
      shape: "roundRect",
      box: { x: cell.x, y: cell.y + headerH, w: cell.w, h: cell.h - headerH },
      style: { fill: { type: "solid", color: toneFill }, radius: theme.radius.lg },
    });
  }

  return { id: uid("cmpgrp"), type: "group", box: { ...cell }, children };
}
