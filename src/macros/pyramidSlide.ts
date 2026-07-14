/**
 * Pyramid slide expander — a stacked hierarchy (apex → base) on the left and a
 * matching numbered list on the right. Each layer is an editable freeform
 * trapezoid; the numbered markers reuse the layer colors.
 */

import type {
  GroupElement,
  PPTElement,
  PyramidSlideSpec,
  PyramidTuple,
  ResolvedTheme,
  ShapeElement,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, split, rows } from "../layout/boxes.js";
import { parsePath } from "../geometry/svgPath.js";
import { Warnings } from "../validation/warnings.js";
import { backgroundFill, eyebrowHeader, fitText, groupColors, onColor, accentColor, uid } from "./shared.js";
import { backgroundRect } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

const VB = 1000;

interface Layer {
  title: string;
  body?: string;
  group?: string;
}

function normalize(it: PyramidTuple): Layer {
  if (Array.isArray(it)) return { title: it[0], body: it[1] };
  return { title: it.title ?? it.t ?? "", body: it.body ?? it.s };
}

export function expandPyramidSlide(
  spec: PyramidSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { pyramid } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(pyramid.class, where);
  warnings.merge(classWarn);

  const layers = pyramid.items.map(normalize);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);
  const colors = groupColors(layers, tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);
  const header = eyebrowHeader(area, { eyebrow: pyramid.eyebrow, title: pyramid.t, bg, accent, theme, warnings, where });
  elements.push(...header.elements);

  const body = { x: area.x, y: header.bottom + theme.spacing.md, w: area.w, h: area.y + area.h - (header.bottom + theme.spacing.md) };
  const [leftCol, rightCol] = split(body, 0.46, theme.spacing.lg);

  // ── Pyramid (left) ──
  const n = layers.length;
  const pH = Math.min(leftCol.h, n * 0.9);
  const pW = Math.min(leftCol.w, pH * 1.5);
  const pBox = { x: leftCol.x + (leftCol.w - pW) / 2, y: leftCol.y + (leftCol.h - pH) / 2, w: pW, h: pH };
  const layerH = pH / n;
  const gap = layerH * 0.08;
  const cxLocal = pW / 2;

  layers.forEach((layer, i) => {
    const color = colors[i];
    const yTop = i * layerH + gap / 2;
    const yBot = (i + 1) * layerH - gap / 2;
    const wTopHalf = (i / n) * (pW / 2);
    const wBotHalf = ((i + 1) / n) * (pW / 2);
    const p = (x: number, y: number) => `${Math.round(x * VB)} ${Math.round(y * VB)}`;
    const path =
      `M${p(cxLocal - wTopHalf, yTop)} L${p(cxLocal + wTopHalf, yTop)} ` +
      `L${p(cxLocal + wBotHalf, yBot)} L${p(cxLocal - wBotHalf, yBot)} Z`;
    const shape: ShapeElement = {
      id: uid("plyr"),
      type: "shape",
      shape: "freeform",
      box: { ...pBox },
      style: { fill: { type: "solid", color } },
      geometry: { segments: parsePath(path), viewBox: { w: pW * VB, h: pH * VB }, filled: true, path },
    };
    elements.push(shape);
    // Layer label (centered). Allow narrow top layers' labels to extend beyond
    // the trapezoid width so they stay legible (matching a real pyramid look).
    const labelW = Math.max(wBotHalf * 2, pW * 0.55);
    const lf = fitText(layer.title, { boxW: labelW, boxH: yBot - yTop, padding: 0.01, base: { size: 12, bold: true, color: onColor(color), align: "center" }, minFontSize: 8, maxLines: 1 }, warnings, where);
    elements.push({
      id: uid("plbl"),
      type: "text",
      box: { x: pBox.x + cxLocal - labelW / 2, y: pBox.y + yTop, w: labelW, h: yBot - yTop },
      text: lf.text,
      style: { ...lf.style, vAlign: "middle" },
      padding: 0.01,
      noWrap: true,
    });
  });

  // ── Numbered list (right) ──
  const rowBoxes = rows(rightCol, n, theme.spacing.sm);
  layers.forEach((layer, i) => {
    const r = rowBoxes[i];
    if (!r) return;
    elements.push(buildRow(layer, i + 1, r, colors[i], theme, warnings, where));
  });

  return { slide: { id: slideId, background: bg, elements, notes: pyramid.notes }, warnings };
}

function buildRow(
  layer: Layer,
  index: number,
  row: { x: number; y: number; w: number; h: number },
  color: string,
  theme: ResolvedTheme,
  warnings: Warnings,
  where: string
): GroupElement {
  const children: PPTElement[] = [];
  const hasBody = !!layer.body;
  const titleH = 0.36;
  const gapTB = theme.spacing.xs;
  const bodyH = hasBody ? Math.min(0.6, row.h - titleH - gapTB) : 0;
  const blockH = titleH + (hasBody ? gapTB + bodyH : 0);
  const blockY = row.y + Math.max(0, (row.h - blockH) / 2);
  const cyc = blockY + blockH / 2;

  const badge = Math.min(0.5, row.h * 0.5);
  children.push({
    id: uid("pnum"),
    type: "shape",
    shape: "ellipse",
    box: { x: row.x, y: cyc - badge / 2, w: badge, h: badge },
    style: { fill: { type: "solid", color } },
    text: String(index),
    textStyle: { size: Math.max(13, Math.round(badge * 36)), bold: true, color: onColor(color), align: "center", vAlign: "middle" },
  });

  const tx = row.x + badge + theme.spacing.md;
  const tw = row.x + row.w - tx;
  const tf = fitText(layer.title, { boxW: tw, boxH: titleH, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 16, color: theme.colors.text, align: "left" }, minFontSize: 11, maxLines: 1 }, warnings, where);
  children.push({ id: uid("ptitle"), type: "text", box: { x: tx, y: blockY, w: tw, h: titleH }, text: tf.text, style: { ...tf.style, vAlign: hasBody ? "bottom" : "middle" }, padding: 0.02 });
  if (hasBody) {
    const bf = fitText(layer.body!, { boxW: tw, boxH: bodyH, padding: 0.02, base: { ...theme.typography.body, size: 12, color: theme.colors.textMuted, align: "left" }, minFontSize: 9, maxLines: 2 }, warnings, where);
    children.push({ id: uid("pbody"), type: "text", box: { x: tx, y: blockY + titleH + gapTB, w: tw, h: bodyH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
  }

  return { id: uid("prow"), type: "group", box: { ...row }, children };
}
