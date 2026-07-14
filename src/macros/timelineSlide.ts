/**
 * Timeline slide expander.
 *
 * Full-width horizontal timeline inspired by a polished dark-mode reference:
 *   - an eyebrow + accent-bar + big title header,
 *   - large circular year nodes with a white ring on a central axis,
 *   - cards with a colored top bar, alternating above/below and joined to their
 *     node by a colored stem,
 *   - an optional bottom "roadmap" callout bar.
 *
 * Colors come from the palette tool (or a single accent); text is contrast-aware
 * so it works on light and dark themes alike.
 */

import type {
  GroupElement,
  PPTElement,
  ResolvedTheme,
  SlideSize,
  TimelineSlideSpec,
  TimelineTuple,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { Warnings } from "../validation/warnings.js";
import {
  accentColor,
  backgroundFill,
  eyebrowHeader,
  fitText,
  groupColors,
  noteBlock,
  uid,
} from "./shared.js";
import { backgroundRect } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

interface Milestone {
  date: string;
  title: string;
  body?: string;
  group?: string;
}

function normalize(it: TimelineTuple): Milestone {
  if (Array.isArray(it)) {
    return it.length === 3 ? { date: it[0], title: it[1], body: it[2] } : { date: it[0], title: it[1] };
  }
  return { date: it.date ?? it.d ?? "", title: it.title ?? it.t ?? "", body: it.body ?? it.s };
}

export function expandTimelineSlide(
  spec: TimelineSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { timeline } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(timeline.class, where);
  warnings.merge(classWarn);

  const items = timeline.items.map(normalize);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);
  const colors = groupColors(items, tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];

  const area = contentArea(size, theme, tokens);
  const header = eyebrowHeader(area, {
    eyebrow: timeline.eyebrow ?? "TIMELINE",
    title: timeline.t,
    bg,
    accent,
    theme,
    warnings,
    where,
  });
  elements.push(...header.elements);

  // Reserve the bottom callout band.
  let regionBottom = area.y + area.h;
  if (timeline.callout) {
    checkBudget(timeline.callout, CAPACITY.timeline.callout, "timeline callout", warnings, where);
    const calloutH = 0.7;
    const calloutBox = { x: area.x, y: area.y + area.h - calloutH, w: area.w, h: calloutH };
    elements.push(...noteBlock(calloutBox, { label: "Roadmap:", text: timeline.callout, color: accent, theme, warnings, where }));
    regionBottom = calloutBox.y - theme.spacing.md;
  }

  const region = { x: area.x, y: header.bottom + theme.spacing.md, w: area.w, h: regionBottom - (header.bottom + theme.spacing.md) };
  const axisY = region.y + region.h / 2;
  const n = items.length;
  const slot = region.w / n;

  // Central axis.
  elements.push({
    id: uid("axis"),
    type: "line",
    box: { x: region.x, y: axisY, w: region.w, h: 0 },
    from: { x: region.x, y: axisY },
    to: { x: region.x + region.w, y: axisY },
    stroke: { color: theme.colors.border, width: 2 },
  });

  const node = 0.82;
  const stemGap = 0.32;
  const cardW = Math.min(slot - 0.18, 2.7);
  const cardH = Math.min(1.55, region.h / 2 - node / 2 - stemGap - 0.1);

  items.forEach((m, i) => {
    const cx = region.x + slot * i + slot / 2;
    const color = colors[i];
    const above = i % 2 === 0;

    const cardY = above ? axisY - node / 2 - stemGap - cardH : axisY + node / 2 + stemGap;

    // Stem (node edge → card).
    elements.push({
      id: uid("stem"),
      type: "line",
      box: { x: cx, y: 0, w: 0, h: 0 },
      from: { x: cx, y: above ? axisY - node / 2 : axisY + node / 2 },
      to: { x: cx, y: above ? cardY + cardH : cardY },
      stroke: { color, width: 2 },
    });

    // Card.
    elements.push(buildCard(m, { x: cx - cardW / 2, y: cardY, w: cardW, h: cardH }, color, { theme, warnings, where }));

    // Year node: colored disk + white ring, then the label as a NON-WRAPPING
    // text overlay (so a too-long token shrinks to one line instead of wrapping
    // into an unreadable stack). The capacity contract keeps the label short.
    checkBudget(m.date, CAPACITY.timeline.node, `timeline node "${m.date}"`, warnings, where);
    elements.push({
      id: uid("node"),
      type: "shape",
      shape: "ellipse",
      box: { x: cx - node / 2, y: axisY - node / 2, w: node, h: node },
      style: { fill: { type: "solid", color }, stroke: { color: theme.colors.background, width: 3.5 } },
    });
    const nodeFont = m.date.length <= 4 ? 14 : m.date.length <= 6 ? 11 : 9;
    elements.push({
      id: uid("nodetx"),
      type: "text",
      box: { x: cx - node / 2, y: axisY - node / 2, w: node, h: node },
      text: m.date,
      style: { size: nodeFont, bold: true, color: "#FFFFFF", align: "center", vAlign: "middle" },
      padding: 0.01,
      noWrap: true,
    });
  });

  return { slide: { id: slideId, background: bg, elements, notes: timeline.notes }, warnings };
}

function buildCard(
  m: Milestone,
  cell: { x: number; y: number; w: number; h: number },
  color: string,
  opts: { theme: ResolvedTheme; warnings: Warnings; where: string }
): GroupElement {
  const { theme } = opts;
  const children: PPTElement[] = [];

  children.push({
    id: uid("tlcard"),
    type: "shape",
    shape: "roundRect",
    box: { ...cell },
    style: { fill: { type: "solid", color: theme.colors.surface }, stroke: { color: theme.colors.border, width: 1 }, radius: theme.radius.lg, shadow: theme.shadows.soft },
  });
  // colored top bar
  children.push({
    id: uid("tlbar"),
    type: "shape",
    shape: "roundRect",
    box: { x: cell.x, y: cell.y, w: cell.w, h: 0.08 },
    style: { fill: { type: "solid", color }, radius: theme.radius.sm },
  });

  const pad = theme.spacing.sm;
  const innerX = cell.x + pad;
  const innerW = cell.w - pad * 2;
  let y = cell.y + pad + 0.06;

  const titleH = 0.34;
  const titleLines = checkBudget(m.title, CAPACITY.timeline.title, `timeline title "${m.title}"`, opts.warnings, opts.where);
  const tf = fitText(m.title, { boxW: innerW, boxH: titleH, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 14, color: theme.colors.text, align: "left" }, minFontSize: 10, maxLines: titleLines }, opts.warnings, opts.where);
  children.push({ id: uid("tltitle"), type: "text", box: { x: innerX, y, w: innerW, h: titleH }, text: tf.text, style: { ...tf.style, vAlign: "top" }, padding: 0.02 });
  y += titleH + theme.spacing.xs;

  if (m.body) {
    const bodyLines = checkBudget(m.body, CAPACITY.timeline.body, "timeline body", opts.warnings, opts.where);
    const bodyH = cell.y + cell.h - pad - y;
    const bf = fitText(m.body, { boxW: innerW, boxH: bodyH, padding: 0.02, base: { ...theme.typography.body, size: 11, color: theme.colors.textMuted, align: "left" }, minFontSize: 8, maxLines: bodyLines }, opts.warnings, opts.where);
    children.push({ id: uid("tlbody"), type: "text", box: { x: innerX, y, w: innerW, h: bodyH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
  }

  return { id: uid("tlgrp"), type: "group", box: { ...cell }, children };
}
