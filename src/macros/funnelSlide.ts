/**
 * Funnel slide — stacked stages narrowing top→bottom, each labeled inside, with
 * optional detail to the side. (Perceptis "Funnel Diagram" template.) Stage
 * colors follow the theme's accent intensity (darkest at the wide top).
 */

import type {
  FunnelSlideSpec,
  FunnelTuple,
  PPTElement,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, split } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { tint, mix } from "../core/color.js";
import { parsePath } from "../geometry/svgPath.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, eyebrowHeader, fitText, onColor, uid } from "./shared.js";
import { backgroundRect } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

const VB = 1000;

interface Stage {
  title: string;
  body?: string;
  value?: string;
}

function normalize(it: FunnelTuple): Stage {
  if (Array.isArray(it)) return { title: it[0], body: it[1] };
  return { title: it.title ?? it.t ?? "", body: it.body ?? it.s, value: it.value };
}

export function expandFunnelSlide(
  spec: FunnelSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { funnel } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(funnel.class, where);
  warnings.merge(classWarn);

  const items = funnel.items.map(normalize).slice(0, 6);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);
  const header = eyebrowHeader(area, { eyebrow: funnel.eyebrow ?? "FUNNEL", title: funnel.t, bg, accent, theme, warnings, where });
  elements.push(...header.elements);

  const region = { x: area.x, y: header.bottom + theme.spacing.md, w: area.w, h: area.y + area.h - (header.bottom + theme.spacing.md) };
  const [funnelCol, sideCol] = split(region, 0.56, theme.spacing.lg);

  const n = items.length;
  const fullW = funnelCol.w * 0.96;
  const minW = funnelCol.w * 0.28;
  const fcx = funnelCol.x + funnelCol.w / 2;
  const wAt = (frac: number) => fullW - (fullW - minW) * frac;

  // Flat trapezoid stages with a small gap. A continuous DIVERGING color ramp
  // flows down the funnel (theme primary → light mid → accent); each stage's
  // gradient is its slice of that ramp, so the whole funnel reads as one shape.
  const gap = Math.min(0.16, funnelCol.h * 0.03);
  const stageH = (funnelCol.h - gap * (n - 1)) / n;
  const cTop = theme.colors.primary;
  const cBot = theme.colors.accent;
  const cMid = tint(mix(cTop, cBot, 0.5), 0.4);
  const ramp = (t: number) => (t <= 0.5 ? mix(cTop, cMid, t * 2) : mix(cMid, cBot, (t - 0.5) * 2));

  items.forEach((s, i) => {
    const yTop = funnelCol.y + i * (stageH + gap);
    const yBot = yTop + stageH;
    const topW = wAt(i / n);
    const botW = wAt((i + 1) / n);
    const cTopStage = ramp(i / n);
    const cBotStage = ramp((i + 1) / n);
    const midColor = ramp((i + 0.5) / n);

    // Trapezoid (flat 2D), filled with this stage's slice of the diverging ramp.
    const box = { x: fcx - topW / 2, y: yTop, w: topW, h: stageH };
    const lx = (px: number) => (px - box.x) * VB;
    const ly = (py: number) => (py - box.y) * VB;
    const xL = (w: number) => fcx - w / 2;
    const path =
      `M${lx(xL(topW))} ${ly(yTop)} L${lx(xL(topW) + topW)} ${ly(yTop)} ` +
      `L${lx(xL(botW) + botW)} ${ly(yBot)} L${lx(xL(botW))} ${ly(yBot)} Z`;
    elements.push({
      id: uid("fstage"),
      type: "shape",
      shape: "freeform",
      box: { ...box },
      style: { fill: { type: "linearGradient", angle: 90, stops: [{ color: cTopStage, pos: 0 }, { color: cBotStage, pos: 1 }] } },
      geometry: { segments: parsePath(path), viewBox: { w: box.w * VB, h: box.h * VB }, filled: true, path },
    });

    // Value (or title) centered in the band.
    const inside = s.value ?? s.title;
    checkBudget(inside, CAPACITY.funnel.title, `funnel label "${inside}"`, warnings, where);
    const vf = fitText(inside, { boxW: botW + 0.3, boxH: stageH, padding: 0.02, base: { ...theme.typography.kpi, size: Math.min(24, Math.round(stageH * 26)), color: onColor(midColor), align: "center" }, minFontSize: 12, maxLines: 1 }, warnings, where);
    elements.push({ id: uid("fval"), type: "text", box: { x: fcx - topW / 2, y: yTop, w: topW, h: stageH }, text: vf.text, style: { ...vf.style, vAlign: "middle" }, padding: 0.02, noWrap: true });

    // Leader line → side label (title + detail).
    const midY = yTop + stageH / 2;
    const startX = fcx + botW / 2 + 0.05;
    elements.push({ id: uid("flead"), type: "line", box: { x: startX, y: midY, w: sideCol.x - startX, h: 0 }, from: { x: startX, y: midY }, to: { x: sideCol.x, y: midY }, stroke: { color: theme.colors.border, width: 1.2, dash: "dash" } });
    elements.push({ id: uid("fdot"), type: "shape", shape: "ellipse", box: { x: sideCol.x - 0.06, y: midY - 0.06, w: 0.12, h: 0.12 }, style: { fill: { type: "solid", color: midColor } } });
    const tx = sideCol.x + 0.2;
    const tw = sideCol.x + sideCol.w - tx;
    const hasBody = !!s.body;
    const tHt = hasBody ? 0.34 : stageH;
    const tf = fitText(s.title, { boxW: tw, boxH: tHt, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 15, color: theme.colors.text, align: "left" }, minFontSize: 11, maxLines: 1 }, warnings, where);
    elements.push({ id: uid("ftitle"), type: "text", box: { x: tx, y: hasBody ? midY - tHt : midY - tHt / 2, w: tw, h: tHt }, text: tf.text, style: { ...tf.style, vAlign: "bottom" }, padding: 0.02 });
    if (hasBody) {
      const bodyLines = checkBudget(s.body, CAPACITY.funnel.body, "funnel body", warnings, where);
      const bf = fitText(s.body!, { boxW: tw, boxH: stageH * 0.5, padding: 0.02, base: { ...theme.typography.body, size: 12, color: theme.colors.textMuted, align: "left" }, minFontSize: 9, maxLines: bodyLines }, warnings, where);
      elements.push({ id: uid("fsbody"), type: "text", box: { x: tx, y: midY + 0.02, w: tw, h: stageH * 0.5 }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
    }
  });

  return { slide: { id: slideId, background: bg, elements, notes: funnel.notes }, warnings };
}
