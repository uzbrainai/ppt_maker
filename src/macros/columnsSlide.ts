/**
 * Columns slide — a header band + 2–4 full-height text columns, each a panel
 * with an optional icon, a colored heading and a paragraph. (Perceptis "Column
 * Layout" templates.) Distinct from `cards` (a grid): these are tall columns.
 */

import type {
  ColumnsSlideSpec,
  ColumnTuple,
  PPTElement,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, reserveTitle, columns } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { tint, luminance } from "../core/color.js";
import { buildIcon } from "../geometry/icons.js";
import { Warnings } from "../validation/warnings.js";
import { backgroundFill, fitText, groupColors, uid } from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

interface Col {
  icon?: string;
  title: string;
  body?: string;
  group?: string;
}

function normalize(it: ColumnTuple): Col {
  if (Array.isArray(it)) return it.length >= 3 ? { icon: it[0], title: it[1], body: it[2] } : { title: it[0], body: it[1] };
  return { icon: it.icon, title: it.title ?? it.t ?? "", body: it.body ?? it.s };
}

export function expandColumnsSlide(
  spec: ColumnsSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { columns: col } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(col.class, where);
  warnings.merge(classWarn);

  const items = col.items.map(normalize).slice(0, 4);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const colors = groupColors(items, tokens, theme);
  const dark = luminance(theme.colors.background) < 0.4;

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);

  const hasTitle = !!col.t;
  const titleH = col.s ? 1.4 : 0.9;
  const { title: titleBox, rest } = hasTitle ? reserveTitle(area, titleH, theme.spacing.md) : { title: undefined, rest: area };
  if (hasTitle && titleBox) {
    const tb = col.s ? { ...titleBox, h: titleBox.h - 0.5 } : titleBox;
    elements.push(titleElement(col.t!, tb, theme, bg, warnings, where));
    if (col.s) {
      const sf = fitText(col.s, { boxW: tb.w, boxH: 0.5, padding: 0.02, base: { ...theme.typography.body, size: 15, color: theme.colors.textMuted, align: "left" }, minFontSize: 11, maxLines: 2 }, warnings, where);
      elements.push({ id: uid("colsub"), type: "text", box: { x: tb.x, y: tb.y + tb.h, w: tb.w, h: 0.5 }, text: sf.text, style: { ...sf.style, vAlign: "middle" }, padding: 0.02 });
    }
  }

  const cells = columns(rest, items.length, theme.spacing.lg);
  items.forEach((c, i) => {
    const cell = cells[i];
    if (!cell) return;
    const color = colors[i];
    // panel
    elements.push({
      id: uid("colpanel"),
      type: "shape",
      shape: "roundRect",
      box: { ...cell },
      style: { fill: { type: "solid", color: dark ? tint(theme.colors.background, 0.06) : theme.colors.surface }, stroke: { color: theme.colors.border, width: 1 }, radius: theme.radius.lg, shadow: theme.shadows.soft },
    });
    // top accent bar
    elements.push({ id: uid("coltop"), type: "shape", shape: "roundRect", box: { x: cell.x, y: cell.y, w: cell.w, h: 0.1 }, style: { fill: { type: "solid", color }, radius: theme.radius.sm } });

    const pad = theme.spacing.md;
    const innerX = cell.x + pad;
    const innerW = cell.w - pad * 2;
    let y = cell.y + pad + 0.06;

    if (c.icon) {
      const s = 0.5;
      const { elements: ic } = buildIcon(c.icon, { x: innerX, y, w: s, h: s }, { color });
      elements.push(...ic);
      y += s + theme.spacing.sm;
    }

    const titleLines = checkBudget(c.title, CAPACITY.columns.title, `columns title "${c.title}"`, warnings, where);
    const tH = 0.6;
    const tf = fitText(c.title, { boxW: innerW, boxH: tH, padding: 0.02, base: { ...theme.typography.h2, size: 18, color: theme.colors.text, align: "left" }, minFontSize: 13, maxLines: titleLines }, warnings, where);
    elements.push({ id: uid("coltitle"), type: "text", box: { x: innerX, y, w: innerW, h: tH }, text: tf.text, style: { ...tf.style, vAlign: "top" }, padding: 0.02 });
    y += tH + theme.spacing.xs;

    if (c.body) {
      const bodyLines = checkBudget(c.body, CAPACITY.columns.body, "columns body", warnings, where);
      const bH = cell.y + cell.h - pad - y;
      const bf = fitText(c.body, { boxW: innerW, boxH: bH, padding: 0.02, base: { ...theme.typography.body, size: 13, color: theme.colors.textMuted, align: "left" }, minFontSize: 10, maxLines: bodyLines }, warnings, where);
      elements.push({ id: uid("colbody"), type: "text", box: { x: innerX, y, w: innerW, h: bH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
    }
  });

  return { slide: { id: slideId, background: bg, elements, notes: col.notes }, warnings };
}
