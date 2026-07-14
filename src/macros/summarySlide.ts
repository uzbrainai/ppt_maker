/**
 * Summary / recap slide expander.
 *
 * A two-zone layout: a colored panel on the left with the headline (and an
 * optional lead), and a column of numbered takeaways on the right. Distinct from
 * `bullets` — meant as an end-of-deck recap. Rows fill the available height.
 */

import type {
  GroupElement,
  ItemTuple,
  PPTElement,
  ResolvedTheme,
  SlideSize,
  SummarySlideSpec,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { normalizeItems } from "../dsl/normalize.js";
import { contentArea, split, rows } from "../layout/boxes.js";
import { buildIcon } from "../geometry/icons.js";
import { tint, readableOn } from "../core/color.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, bgColor, fitText, groupColors, uid } from "./shared.js";
import { backgroundRect } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

export function expandSummarySlide(
  spec: SummarySlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { summary } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(summary.class, where);
  warnings.merge(classWarn);

  const items = normalizeItems(summary.items as ItemTuple[]);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);
  const colors = groupColors(items, tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];

  const area = contentArea(size, theme, tokens);
  const [panel, list] = split(area, 0.38, theme.spacing.lg);

  // Left colored panel.
  elements.push({
    id: uid("sumpanel"),
    type: "shape",
    shape: "roundRect",
    box: panel,
    style: { fill: gradientOrSolid(accent, theme), radius: theme.radius.xl, shadow: theme.shadows.md },
  });
  const panelFg = readableOn(bgColor(gradientOrSolid(accent, theme), accent));
  const pad = theme.spacing.lg;
  const heading = summary.t ?? "Xulosa";

  // accent bar
  elements.push({
    id: uid("sumbar"),
    type: "shape",
    shape: "roundRect",
    box: { x: panel.x + pad, y: panel.y + pad, w: 0.8, h: 0.12 },
    style: { fill: { type: "solid", color: panelFg.strong }, radius: theme.radius.pill },
  });
  const titleFit = fitText(heading, { boxW: panel.w - pad * 2, boxH: 1.6, padding: 0.03, base: { ...theme.typography.h1, size: 36, color: panelFg.strong, align: "left" }, minFontSize: 22, maxLines: 3 }, warnings, where);
  elements.push({
    id: uid("sumtitle"),
    type: "text",
    box: { x: panel.x + pad, y: panel.y + pad + 0.3, w: panel.w - pad * 2, h: 1.7 },
    text: titleFit.text,
    style: { ...titleFit.style, vAlign: "top" },
    padding: 0.03,
  });
  if (summary.s) {
    const sf = fitText(summary.s, { boxW: panel.w - pad * 2, boxH: 1.4, padding: 0.03, base: { ...theme.typography.body, size: 14, color: panelFg.soft, align: "left" }, minFontSize: 10, maxLines: 5 }, warnings, where);
    elements.push({
      id: uid("sumsub"),
      type: "text",
      box: { x: panel.x + pad, y: panel.y + panel.h - 1.5, w: panel.w - pad * 2, h: 1.3 },
      text: sf.text,
      style: { ...sf.style, vAlign: "bottom" },
      padding: 0.03,
    });
  }

  // Right: numbered takeaways filling the height.
  const rowBoxes = rows(list, items.length, theme.spacing.sm);
  items.forEach((item, i) => {
    const r = rowBoxes[i];
    if (!r) return;
    elements.push(buildTakeaway(item, i + 1, r, colors[i], { theme, warnings, where }));
  });

  return { slide: { id: slideId, background: bg, elements, notes: summary.notes }, warnings };
}

function gradientOrSolid(accent: string, theme: ResolvedTheme): import("../core/types.js").FillSpec {
  return { type: "linearGradient", angle: 135, stops: [{ color: theme.colors.primaryDark, pos: 0 }, { color: accent, pos: 1 }] };
}

function buildTakeaway(
  item: { icon?: string; title: string; body?: string },
  index: number,
  row: { x: number; y: number; w: number; h: number },
  color: string,
  opts: { theme: ResolvedTheme; warnings: Warnings; where: string }
): GroupElement {
  const { theme } = opts;
  const children: PPTElement[] = [];
  const hasBody = !!item.body;
  const cy = row.y + row.h / 2; // shared vertical center for chip + text block

  // Larger icon/number chip, vertically centered on the row.
  const chip = Math.min(0.8, row.h * 0.72);
  const chipBox = { x: row.x, y: cy - chip / 2, w: chip, h: chip };
  children.push({
    id: uid("tknum"),
    type: "shape",
    shape: "roundRect",
    box: chipBox,
    style: { fill: { type: "solid", color: tint(color, 0.84) }, radius: theme.radius.md },
    text: item.icon ? undefined : String(index),
    textStyle: item.icon ? undefined : { size: 22, bold: true, color, align: "center", vAlign: "middle" },
  });
  if (item.icon) {
    const s = chip * 0.6;
    const { elements: ic } = buildIcon(item.icon, { x: chipBox.x + (chip - s) / 2, y: chipBox.y + (chip - s) / 2, w: s, h: s }, { color });
    children.push(...ic);
  }

  const tx = row.x + chip + theme.spacing.md;
  const tw = row.x + row.w - tx;

  if (hasBody) {
    // Title + body as a tight block, centered on the same row center as the chip.
    const titleH = 0.4;
    const gap = theme.spacing.xs;
    const bodyH = 0.44;
    const blockH = titleH + gap + bodyH;
    const blockY = cy - blockH / 2;
    const tf = fitText(item.title, { boxW: tw, boxH: titleH, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 19, color: theme.colors.text, align: "left" }, minFontSize: 13, maxLines: 1 }, opts.warnings, opts.where);
    children.push({ id: uid("tktitle"), type: "text", box: { x: tx, y: blockY, w: tw, h: titleH }, text: tf.text, style: { ...tf.style, vAlign: "bottom" }, padding: 0.02 });
    const bf = fitText(item.body!, { boxW: tw, boxH: bodyH, padding: 0.02, base: { ...theme.typography.body, size: 14, color: theme.colors.textMuted, align: "left" }, minFontSize: 10, maxLines: 2 }, opts.warnings, opts.where);
    children.push({ id: uid("tkbody"), type: "text", box: { x: tx, y: blockY + titleH + gap, w: tw, h: bodyH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
  } else {
    const tf = fitText(item.title, { boxW: tw, boxH: row.h, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 19, color: theme.colors.text, align: "left" }, minFontSize: 13, maxLines: 2 }, opts.warnings, opts.where);
    children.push({ id: uid("tktitle"), type: "text", box: { x: tx, y: row.y, w: tw, h: row.h }, text: tf.text, style: { ...tf.style, vAlign: "middle" }, padding: 0.02 });
  }

  return { id: uid("tkgrp"), type: "group", box: { ...row }, children };
}
