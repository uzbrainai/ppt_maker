/**
 * Cards slide expander.
 *
 * Produces: background, a title, and a grid of cards. Each card is a GROUP
 * containing a background shape, an icon (editable child shapes), a title text
 * box, and a body text box — all editable in PowerPoint.
 */

import type {
  CardsSlideSpec,
  GroupElement,
  NormalizedItem,
  PPTElement,
  PPTSlide,
  ResolvedTheme,
  ShapeElement,
  SlideSize,
  TextElement,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { normalizeItems } from "../dsl/normalize.js";
import { autoGrid, gridCells } from "../layout/grid.js";
import { contentArea, reserveTitle } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { buildIcon } from "../geometry/icons.js";
import { tint } from "../core/color.js";
import { Warnings } from "../validation/warnings.js";
import {
  backgroundFill,
  cardLook,
  densityScale,
  fitText,
  groupColors,
  noteBlock,
  onColor,
  readableColors,
  uid,
} from "./shared.js";
import type { ExpandedSlide } from "./titleSlide.js";

export function expandCardsSlide(
  spec: CardsSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { cards } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(cards.class, where);
  warnings.merge(classWarn);

  const items = normalizeItems(cards.items);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const dScale = densityScale(tokens);

  const gap = theme.spacing[tokens.gap ?? "md"];
  const padInner = theme.spacing[tokens.pad ?? "md"];

  const elements: PPTElement[] = [];

  // Background rect.
  elements.push(backgroundRect(bg, size));

  // Content area + title band.
  const area = contentArea(size, theme, tokens);
  const hasTitle = !!cards.t;
  const { title: titleBox, rest } = hasTitle
    ? reserveTitle(area, 0.9, theme.spacing.md)
    : { title: undefined, rest: area };

  if (hasTitle && titleBox) {
    elements.push(titleElement(cards.t!, titleBox, theme, bg, warnings, where));
  }

  // Grid geometry: prefer class grid, else auto.
  const grid =
    tokens.layout && tokens.layout.kind === "grid"
      ? { cols: tokens.layout.cols, rows: tokens.layout.rows }
      : autoGrid(items.length);
  const capacity = grid.cols * grid.rows;
  if (items.length > capacity) {
    warnings.add(
      "out-of-bounds",
      `${items.length} items but grid holds ${capacity}; extra items overflow the last cells.`,
      where
    );
  }
  const rowsNeeded = Math.max(grid.rows, Math.ceil(items.length / grid.cols));

  // Content-sized cards: rather than stretching cards to fill the whole area
  // (which leaves them mostly empty), size them to their content. The freed
  // whitespace below holds an optional summary block; without one, the grid is
  // centered vertically so the slide doesn't look top-heavy.
  const hasBody = items.some((it) => it.body);
  const hasIcons = items.some((it) => it.icon);
  const note = cards.note ?? cards.s;
  const targetCardH = cardHeight(hasBody, hasIcons, dScale);
  const naturalGridH = rowsNeeded * targetCardH + (rowsNeeded - 1) * gap;

  let gridArea = rest;
  let noteBox: { x: number; y: number; w: number; h: number } | undefined;
  if (note) {
    // Reserve a modest fixed band for the summary; cards take the rest. Adaptive
    // card layout keeps content fitting even when the remaining cells are short.
    const noteH = Math.min(1.1, Math.max(0.8, rest.h * 0.2));
    gridArea = { x: rest.x, y: rest.y, w: rest.w, h: rest.h - noteH - theme.spacing.md };
    noteBox = { x: rest.x, y: rest.y + gridArea.h + theme.spacing.md, w: rest.w, h: noteH };
  } else if (naturalGridH < rest.h) {
    // Center content-sized cards vertically so the slide isn't top-heavy.
    gridArea = { x: rest.x, y: rest.y + (rest.h - naturalGridH) / 2, w: rest.w, h: naturalGridH };
  }

  const { cells } = gridCells(gridArea, grid.cols, rowsNeeded, gap);

  // Per-card colors, honoring grouping (same group → same color).
  const colors = groupColors(items, tokens, theme);

  items.forEach((item, i) => {
    const cell = cells[i];
    if (!cell) return;
    const color = colors[i];
    elements.push(
      buildCard(item, cell, {
        theme,
        look: cardLook(tokens, theme, color),
        color,
        index: i + 1,
        padInner,
        dScale,
        showIcon: !!item.icon,
        iconVariant: tokens.icons?.style ?? "line",
        accentTop: tokens.accentTop,
        accentLeft: tokens.accentLeft,
        numbered: tokens.numbered,
        warnings,
        where,
      })
    );
  });

  // Summary block in the freed whitespace (language-agnostic: no forced label).
  if (note && noteBox) {
    checkBudget(note, CAPACITY.card.note, "card note/summary", warnings, where);
    const accent = colors[0] ?? theme.colors.primary;
    elements.push(...noteBlock(noteBox, { text: note, color: accent, theme, warnings, where }));
  }

  const slide: PPTSlide = { id: slideId, background: bg, elements, notes: cards.notes };
  return { slide, warnings };
}

/** Content-driven card height (inches), so cards aren't mostly empty but still
 * fit a couple of body lines without over-truncating. */
function cardHeight(hasBody: boolean, hasIcon: boolean, dScale: number): number {
  let h = 1.0; // padding (top+bottom) + title
  if (hasIcon) h += 0.8; // icon chip + gap
  if (hasBody) h += 0.6; // ~2 body lines
  return Math.round(h * dScale * 100) / 100;
}

export function backgroundRect(bg: PPTSlide["background"], size: SlideSize): ShapeElement {
  return {
    id: uid("bg"),
    type: "shape",
    shape: "rect",
    box: { x: 0, y: 0, w: size.width, h: size.height },
    style: { fill: bg, shadow: { enabled: false, blur: 0, distance: 0, direction: 90, color: "#000000", opacity: 0 } },
  };
}

export function titleElement(
  text: string,
  box: { x: number; y: number; w: number; h: number },
  theme: ResolvedTheme,
  bg: PPTSlide["background"],
  warnings: Warnings,
  where: string
): TextElement {
  // Contrast-aware: heading color is derived from the slide background, never
  // hardcoded — so a heading on a dark/gradient background stays readable.
  const color = readableColors(bg, theme.colors.background).strong;
  const base = { ...theme.typography.h2, align: "left" as const, color };
  const lines = checkBudget(text, CAPACITY.slideTitle, `slide title "${text}"`, warnings, where);
  const fit = fitText(text, { boxW: box.w, boxH: box.h, padding: 0.04, base, minFontSize: 16, maxLines: lines }, warnings, where);
  return {
    id: uid("title"),
    type: "text",
    box,
    text: fit.text,
    style: { ...fit.style, vAlign: "middle" },
    padding: 0.04,
    fit: { mode: "shrink", minFontSize: 16 },
  };
}

interface CardOpts {
  theme: ResolvedTheme;
  look: ReturnType<typeof cardLook>;
  color: string;
  index: number;
  padInner: number;
  dScale: number;
  showIcon: boolean;
  iconVariant: "line" | "filled";
  accentTop?: boolean;
  accentLeft?: boolean;
  numbered?: boolean;
  warnings: Warnings;
  where: string;
}

function buildCard(
  item: NormalizedItem,
  cell: { x: number; y: number; w: number; h: number },
  opts: CardOpts
): GroupElement {
  const { theme, look, color, padInner } = opts;
  const children: PPTElement[] = [];

  // Card background.
  children.push({
    id: uid("card"),
    type: "shape",
    shape: "roundRect",
    box: { ...cell },
    style: look.style,
  });

  // Accent strip (top or left edge) in the card color.
  if (opts.accentTop) {
    children.push({
      id: uid("bar"),
      type: "shape",
      shape: "roundRect",
      box: { x: cell.x, y: cell.y, w: cell.w, h: 0.09 },
      style: { fill: { type: "solid", color }, radius: theme.radius.sm },
    });
  }
  if (opts.accentLeft) {
    children.push({
      id: uid("bar"),
      type: "shape",
      shape: "roundRect",
      box: { x: cell.x, y: cell.y, w: 0.09, h: cell.h },
      style: { fill: { type: "solid", color }, radius: theme.radius.sm },
    });
  }

  // Adaptive padding/sizing so cards never overflow even when the cell is short
  // (e.g. a 6-card grid sharing space with a summary block).
  const pad = Math.min(padInner, cell.h * 0.12);
  const topPad = pad + (opts.accentTop ? 0.08 : 0);
  const innerX = cell.x + pad + (opts.accentLeft ? 0.12 : 0);
  const innerW = cell.w - pad * 2 - (opts.accentLeft ? 0.12 : 0);
  const cellBottom = cell.y + cell.h - pad;
  const innerH = cellBottom - (cell.y + topPad);
  let cursorY = cell.y + topPad;

  // Icon (square chip at top-left of card), colored per card. Scales with height.
  if (opts.showIcon && item.icon) {
    const iconSize = Math.max(0.24, Math.min(0.5, innerH * 0.32));
    const chip = iconSize + 0.14;
    const chipBox = { x: innerX, y: cursorY, w: chip, h: chip };
    const filled = opts.iconVariant === "filled";
    children.push({
      id: uid("chip"),
      type: "shape",
      shape: "roundRect",
      box: chipBox,
      style: {
        fill: { type: "solid", color: filled ? color : tint(color, 0.84) },
        radius: theme.radius.md,
      },
    });
    const iconBox = {
      x: chipBox.x + (chip - iconSize) / 2,
      y: chipBox.y + (chip - iconSize) / 2,
      w: iconSize,
      h: iconSize,
    };
    const { elements: iconShapes, known } = buildIcon(item.icon, iconBox, {
      color: filled ? onColor(color) : color,
      variant: opts.iconVariant,
    });
    if (!known) {
      opts.warnings.add("unknown-icon", `Unknown icon "${item.icon}" rendered as labeled placeholder.`, opts.where);
    }
    children.push(...iconShapes);

    // Optional number badge in the top-right corner.
    if (opts.numbered) {
      const badge = Math.min(0.34, chip);
      children.push({
        id: uid("num"),
        type: "shape",
        shape: "ellipse",
        box: { x: cell.x + cell.w - pad - badge, y: cursorY, w: badge, h: badge },
        style: { fill: { type: "solid", color: tint(color, 0.84) } },
        text: String(opts.index),
        textStyle: { size: 12, bold: true, color, align: "center", vAlign: "middle" },
      });
    }
    cursorY = chipBox.y + chip + theme.spacing.xs;
  } else if (opts.numbered) {
    const badge = Math.max(0.32, Math.min(0.5, innerH * 0.3));
    children.push({
      id: uid("num"),
      type: "shape",
      shape: "roundRect",
      box: { x: innerX, y: cursorY, w: badge, h: badge },
      style: { fill: { type: "solid", color }, radius: theme.radius.md },
      text: String(opts.index),
      textStyle: { size: 18, bold: true, color: onColor(color), align: "center", vAlign: "middle" },
    });
    cursorY += badge + theme.spacing.xs;
  }

  // Title — height clamped so the body always has room (never negative).
  const remaining = cellBottom - cursorY;
  const titleH = Math.max(0.26, Math.min(item.body ? remaining * 0.42 : remaining, 0.44));
  const titleBox = { x: innerX, y: cursorY, w: innerW, h: titleH };
  const titleBase = {
    ...theme.typography.bodyStrong,
    size: Math.round(15 * opts.dScale),
    color: look.textColor,
    align: "left" as const,
  };
  const titleLines = checkBudget(item.title, CAPACITY.card.title, `card title "${item.title}"`, opts.warnings, opts.where);
  const titleFit = fitText(item.title, { boxW: innerW, boxH: titleH, padding: 0.02, base: titleBase, minFontSize: 11, maxLines: titleLines }, opts.warnings, opts.where);
  children.push({
    id: uid("ctitle"),
    type: "text",
    box: titleBox,
    text: titleFit.text,
    style: { ...titleFit.style, vAlign: "top" },
    padding: 0.02,
    fit: { mode: "shrink", minFontSize: 11 },
  });
  cursorY = titleBox.y + titleH + theme.spacing.xs;

  // Body — box guaranteed within the card.
  const bodyH = cellBottom - cursorY;
  if (item.body && bodyH >= 0.16) {
    const bodyBox = { x: innerX, y: cursorY, w: innerW, h: bodyH };
    const bodyBase = {
      ...theme.typography.body,
      size: Math.round(12 * opts.dScale),
      color: look.mutedTextColor,
      align: "left" as const,
    };
    const bodyLines = checkBudget(item.body, CAPACITY.card.body, "card body", opts.warnings, opts.where);
    const bodyFit = fitText(item.body, { boxW: innerW, boxH: bodyH, padding: 0.02, base: bodyBase, minFontSize: 9, len: item.len, maxLines: item.len ? undefined : bodyLines }, opts.warnings, opts.where);
    children.push({
      id: uid("cbody"),
      type: "text",
      box: bodyBox,
      text: bodyFit.text,
      style: { ...bodyFit.style, vAlign: "top" },
      padding: 0.02,
      fit: { mode: "shrink", minFontSize: 9 },
    });
  }

  return {
    id: uid("group"),
    type: "group",
    box: { ...cell },
    children,
  };
}
