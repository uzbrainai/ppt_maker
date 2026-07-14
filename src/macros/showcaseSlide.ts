/**
 * Showcase slide: a large hero image beside a title + supporting points.
 * Image on the right by default; use class `image-left` to flip.
 */

import type {
  PPTElement,
  ResolvedTheme,
  ShowcaseSlideSpec,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, split, rows } from "../layout/boxes.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, eyebrowHeader, fitText, imageContainer, uid } from "./shared.js";
import { backgroundRect } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

export function expandShowcaseSlide(
  spec: ShowcaseSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { showcase } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(showcase.class, where);
  warnings.merge(classWarn);

  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);
  const imageLeft = /\bimage-left\b/.test(showcase.class ?? "");

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);

  // Even split so the text column has room for substantial copy.
  const [colA, colB] = split(area, 0.5, theme.spacing.lg);
  const textCol = imageLeft ? colB : colA;
  const imgCol = imageLeft ? colA : colB;

  // Image fills its whole column.
  elements.push(...imageContainer(showcase.image, imgCol, theme, { fit: "cover", radius: theme.radius.xl }));

  const tx0 = textCol.x + 0.28;
  const tw = textCol.w - 0.28;

  // Title (large) + lead.
  const header = eyebrowHeader(textCol, { title: showcase.t, bg, accent, theme, warnings, where });
  elements.push(...header.elements);
  let y = header.bottom + theme.spacing.sm;

  if (showcase.s) {
    const sh = 0.8;
    const sf = fitText(showcase.s, { boxW: tw, boxH: sh, padding: 0.02, base: { ...theme.typography.body, size: 16, color: theme.colors.textMuted, align: "left" }, minFontSize: 12, maxLines: 3 }, warnings, where);
    elements.push({ id: uid("scsub"), type: "text", box: { x: tx0, y, w: tw, h: sh }, text: sf.text, style: { ...sf.style, vAlign: "top" }, padding: 0.02 });
    y += sh + theme.spacing.md;
  }

  // Points: rich rows (bold title + detail) that FILL the remaining height, so
  // the column never looks half-empty. Fewer points → taller rows + bigger type.
  const pts = (showcase.points ?? []).map(normPoint).filter((p) => p.title);
  if (pts.length) {
    const listH = textCol.y + textCol.h - y;
    const rowBoxes = rows({ x: tx0, y, w: tw, h: listH }, pts.length, theme.spacing.md);
    const titleSize = pts.length <= 3 ? 19 : pts.length <= 4 ? 17 : 16;
    pts.forEach((p, i) => {
      const r = rowBoxes[i];
      if (!r) return;
      // accent chip marker
      const chip = Math.min(0.34, r.h * 0.5);
      elements.push({ id: uid("scchip"), type: "shape", shape: "roundRect", box: { x: r.x, y: r.y + 0.04, w: chip, h: chip }, style: { fill: { type: "solid", color: accent }, radius: theme.radius.sm } });
      const cx = r.x + chip + theme.spacing.sm;
      const cw = r.x + r.w - cx;
      const hasBody = !!p.body;
      const tH = hasBody ? Math.min(0.4, r.h * 0.42) : r.h;
      const tf = fitText(p.title, { boxW: cw, boxH: tH, padding: 0.02, base: { ...theme.typography.bodyStrong, size: titleSize, color: theme.colors.text, align: "left" }, minFontSize: 13, maxLines: hasBody ? 1 : 2 }, warnings, where);
      elements.push({ id: uid("sctitle"), type: "text", box: { x: cx, y: r.y, w: cw, h: tH }, text: tf.text, style: { ...tf.style, vAlign: hasBody ? "top" : "middle" }, padding: 0.02 });
      if (hasBody) {
        const bH = r.y + r.h - (r.y + tH);
        const bf = fitText(p.body!, { boxW: cw, boxH: bH, padding: 0.02, base: { ...theme.typography.body, size: 13, color: theme.colors.textMuted, align: "left" }, minFontSize: 10, maxLines: 3 }, warnings, where);
        elements.push({ id: uid("scbody"), type: "text", box: { x: cx, y: r.y + tH, w: cw, h: bH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
      }
    });
  }

  return { slide: { id: slideId, background: bg, elements, notes: showcase.notes }, warnings };
}

function normPoint(p: string | [string, string] | { t?: string; title?: string; body?: string; s?: string }): { title: string; body?: string } {
  if (typeof p === "string") return { title: p };
  if (Array.isArray(p)) return { title: p[0], body: p[1] };
  return { title: p.title ?? p.t ?? "", body: p.body ?? p.s };
}
