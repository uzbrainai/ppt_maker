/**
 * Agenda / table-of-contents slide.
 *
 * A numbered list of sections rendered as rounded "pill" rows, auto-flowed into
 * one or two columns (two when there are more than six entries). Each row shows
 * a large accent number and the section name — the classic deck opener.
 */

import type {
  AgendaSlideSpec,
  AgendaTuple,
  PPTElement,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, reserveTitle, split, rows } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, fitText, uid } from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

function normAgenda(it: AgendaTuple): string {
  if (typeof it === "string") return it;
  if (Array.isArray(it)) return it[0] ?? "";
  return it.title ?? it.t ?? it.label ?? "";
}

export function expandAgendaSlide(
  spec: AgendaSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { agenda } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(agenda.class, where);
  warnings.merge(classWarn);

  const items = agenda.items.map(normAgenda);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);
  const hasTitle = !!agenda.t;
  const { title: titleBox, rest } = hasTitle
    ? reserveTitle(area, 1.0, theme.spacing.md)
    : { title: undefined, rest: area };
  if (hasTitle && titleBox) elements.push(titleElement(agenda.t!, titleBox, theme, bg, warnings, where));

  const n = items.length;
  const twoCol = n > 6;
  const perCol = twoCol ? Math.ceil(n / 2) : n;
  const cols = twoCol ? split(rest, 0.5, theme.spacing.lg) : [rest];

  items.forEach((label, i) => {
    checkBudget(label, CAPACITY.agenda.item, `agenda item "${label}"`, warnings, where);
    const colIdx = twoCol ? Math.floor(i / perCol) : 0;
    const rowInCol = twoCol ? i % perCol : i;
    const col = cols[colIdx];
    if (!col) return;
    const rb = rows(col, perCol, theme.spacing.sm)[rowInCol];
    if (!rb) return;

    // Pill background.
    elements.push({
      id: uid("agpill"),
      type: "shape",
      shape: "roundRect",
      box: { ...rb },
      style: { fill: { type: "solid", color: theme.colors.surfaceMuted }, radius: theme.radius.md },
    });

    const pad = theme.spacing.md;
    const numW = 0.9;
    const numFont = Math.min(28, Math.round(rb.h * 36));
    elements.push({
      id: uid("agnum"),
      type: "text",
      box: { x: rb.x + pad, y: rb.y, w: numW, h: rb.h },
      text: `${String(i + 1).padStart(2, "0")}.`,
      style: { ...theme.typography.bodyStrong, size: numFont, bold: true, color: accent, align: "left", vAlign: "middle" },
      padding: 0.02,
      noWrap: true,
    });

    const tx = rb.x + pad + numW;
    const tw = rb.x + rb.w - tx - pad;
    const lf = fitText(label, { boxW: tw, boxH: rb.h, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 18, color: theme.colors.text, align: "left" }, minFontSize: 12, maxLines: 1 }, warnings, where);
    elements.push({
      id: uid("aglbl"),
      type: "text",
      box: { x: tx, y: rb.y, w: tw, h: rb.h },
      text: lf.text,
      style: { ...lf.style, vAlign: "middle" },
      padding: 0.02,
    });
  });

  return { slide: { id: slideId, background: bg, elements, notes: agenda.notes }, warnings };
}
