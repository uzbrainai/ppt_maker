/**
 * Bullets / list slide expander.
 *
 * Produces a title, optional lead paragraph, and a vertical list of points.
 * Each point gets a colored marker (numbered chip, icon chip, or dot), a bold
 * lead, and optional supporting text. Lists longer than 5 items flow into two
 * columns so tall slides stay filled.
 */

import type {
  BulletItem,
  BulletsSlideSpec,
  GroupElement,
  PPTElement,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, reserveTitle, columns, rows } from "../layout/boxes.js";
import { buildIcon } from "../geometry/icons.js";
import { tint } from "../core/color.js";
import { Warnings } from "../validation/warnings.js";
import {
  backgroundFill,
  fitText,
  groupColors,
  onColor,
  readableColors,
  uid,
} from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

interface Bullet {
  title: string;
  body?: string;
  icon?: string;
  group?: string;
  len?: import("../core/types.js").LenHint;
}

function normalizeBullet(item: BulletItem): Bullet {
  if (typeof item === "string") return { title: item };
  if (Array.isArray(item)) return { title: item[0], body: item[1] };
  return {
    title: item.title ?? item.t ?? "",
    body: item.body ?? item.s,
    icon: item.icon,
    group: item.group ?? item.g,
    len: item.len,
  };
}

export function expandBulletsSlide(
  spec: BulletsSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { bullets } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(bullets.class, where);
  warnings.merge(classWarn);

  const items = bullets.items.map(normalizeBullet);
  const bg = backgroundFill(tokens, theme, warnings, where);

  const elements: PPTElement[] = [backgroundRect(bg, size)];

  const area = contentArea(size, theme, tokens);
  const hasTitle = !!bullets.t;
  let { title: titleBox, rest } = hasTitle
    ? reserveTitle(area, 0.85, theme.spacing.sm)
    : { title: undefined, rest: area };
  if (hasTitle && titleBox) elements.push(titleElement(bullets.t!, titleBox, theme, bg, warnings, where));

  // Optional lead paragraph.
  if (bullets.s) {
    const leadH = 0.5;
    const leadBox = { x: rest.x, y: rest.y, w: rest.w, h: leadH };
    const base = { ...theme.typography.body, color: readableColors(bg, theme.colors.background).soft, size: 16, align: "left" as const };
    const leadFit = fitText(bullets.s, { boxW: leadBox.w, boxH: leadH, padding: 0.02, base, minFontSize: 11, maxLines: 2 }, warnings, where);
    elements.push({
      id: uid("lead"),
      type: "text",
      box: leadBox,
      text: leadFit.text,
      style: { ...leadFit.style, vAlign: "top" },
      padding: 0.02,
    });
    rest = { x: rest.x, y: rest.y + leadH + theme.spacing.sm, w: rest.w, h: rest.h - leadH - theme.spacing.sm };
  }

  // One or two columns; rows are evenly distributed for consistent spacing.
  const twoCols = items.length > 5;
  const colBoxes = twoCols ? columns(rest, 2, theme.spacing.lg) : [rest];
  const perCol = Math.ceil(items.length / colBoxes.length);
  const colors = groupColors(items, tokens, theme);

  items.forEach((item, i) => {
    const colIdx = Math.floor(i / perCol);
    const colBox = colBoxes[colIdx] ?? colBoxes[colBoxes.length - 1];
    const rowIdx = i % perCol;
    const rowBoxes = rows(colBox, perCol, theme.spacing.sm);
    const rowBox = rowBoxes[rowIdx];
    if (!rowBox) return;
    elements.push(buildBullet(item, rowBox, i + 1, { theme, tokens, color: colors[i], warnings, where }));
  });

  return { slide: { id: slideId, background: bg, elements, notes: bullets.notes }, warnings };
}

function buildBullet(
  item: Bullet,
  row: { x: number; y: number; w: number; h: number },
  index: number,
  opts: { theme: ResolvedTheme; tokens: ReturnType<typeof resolveClasses>["tokens"]; color: string; warnings: Warnings; where: string }
): GroupElement {
  const { theme, color, tokens } = opts;
  const children: PPTElement[] = [];
  const hasBody = !!item.body;

  // A tight title(+body) block, vertically centered within the row. A larger
  // marker (number/icon/dot) is centered on the SAME block center so it lines up
  // cleanly with the text beside it.
  const numbered = !!tokens.numbered && !item.icon;
  const titleH = 0.36;
  const gapTB = theme.spacing.xs;
  const bodyH = hasBody ? Math.min(0.7, row.h - titleH - gapTB) : 0;
  const blockH = titleH + (hasBody ? gapTB + bodyH : 0);
  const blockY = row.y + Math.max(0, (row.h - blockH) / 2);
  const markerCenterY = blockY + blockH / 2;

  // Bigger numbers; consistent gutter so columns align regardless of marker kind.
  const marker = item.icon ? Math.min(0.52, row.h * 0.56) : numbered ? Math.min(0.66, row.h * 0.66) : 0.34;
  const markerBox = { x: row.x, y: markerCenterY - marker / 2, w: marker, h: marker };

  if (item.icon) {
    children.push({
      id: uid("bm"),
      type: "shape",
      shape: "roundRect",
      box: markerBox,
      style: { fill: { type: "solid", color: tint(color, 0.84) }, radius: theme.radius.md },
    });
    const s = marker * 0.6;
    const { elements: ic } = buildIcon(item.icon, { x: markerBox.x + (marker - s) / 2, y: markerBox.y + (marker - s) / 2, w: s, h: s }, { color });
    children.push(...ic);
  } else if (numbered) {
    children.push({
      id: uid("bm"),
      type: "shape",
      shape: "ellipse",
      box: markerBox,
      style: { fill: { type: "solid", color } },
      text: String(index),
      textStyle: { size: Math.max(15, Math.round(marker * 40)), bold: true, color: onColor(color), align: "center", vAlign: "middle" },
    });
  } else {
    const dot = marker * 0.6;
    children.push({
      id: uid("bm"),
      type: "shape",
      shape: "ellipse",
      box: { x: markerBox.x + (marker - dot) / 2, y: markerCenterY - dot / 2, w: dot, h: dot },
      style: { fill: { type: "solid", color } },
    });
  }

  const textX = row.x + marker + theme.spacing.md;
  const textW = row.x + row.w - textX;

  if (hasBody) {
    children.push(text(uid("bt"), { x: textX, y: blockY, w: textW, h: titleH }, item.title, { ...theme.typography.bodyStrong, color: theme.colors.text, size: 17, align: "left", vAlign: "bottom" }, opts, 1));
    children.push(text(uid("bb"), { x: textX, y: blockY + titleH + gapTB, w: textW, h: bodyH }, item.body!, { ...theme.typography.body, color: theme.colors.textMuted, size: 13, align: "left", vAlign: "top" }, opts, 2, item.len));
  } else {
    children.push(text(uid("bt"), { x: textX, y: row.y, w: textW, h: row.h }, item.title, { ...theme.typography.body, color: theme.colors.text, size: 17, align: "left", vAlign: "middle" }, opts, 2));
  }

  return { id: uid("bgrp"), type: "group", box: { ...row }, children };
}

function text(
  id: string,
  box: { x: number; y: number; w: number; h: number },
  content: string,
  base: import("../core/types.js").TextStyle,
  opts: { warnings: Warnings; where: string },
  maxLines?: number,
  len?: import("../core/types.js").LenHint
): PPTElement {
  const fit = fitText(content, { boxW: box.w, boxH: box.h, padding: 0.02, base, minFontSize: 9, maxLines, len }, opts.warnings, opts.where);
  return {
    id,
    type: "text",
    box,
    text: fit.text,
    style: { vAlign: base.vAlign ?? "top", ...fit.style },
    padding: 0.02,
    fit: { mode: "shrink", minFontSize: 9 },
  };
}
