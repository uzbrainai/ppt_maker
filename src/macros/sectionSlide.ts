/**
 * Section divider slide expander.
 *
 * A bold, full-bleed divider: colored/gradient background, a large section
 * number, the section title, and an optional subtitle — used to break a deck
 * into chapters and add visual rhythm between content slides.
 */

import type {
  PPTElement,
  ResolvedTheme,
  SectionSlideSpec,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, bgColor, fitText, imageContainer, scrim, uid } from "./shared.js";
import { backgroundRect } from "./cardsSlide.js";
import { tint, luminance, readableOn } from "../core/color.js";
import type { ExpandedSlide } from "./titleSlide.js";

export function expandSectionSlide(
  spec: SectionSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { section } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(section.class, where);
  warnings.merge(classWarn);

  // Default to a primary gradient background if none specified.
  if (!tokens.background) tokens.background = "gradient-primary";
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);

  const elements: PPTElement[] = [backgroundRect(bg, size)];

  // Optional full-bleed background image + dark scrim (forces light text).
  const hasImage = !!section.image?.data?.length;
  if (hasImage) {
    const full = { x: 0, y: 0, w: size.width, h: size.height };
    elements.push(...imageContainer(section.image, full, theme, { fit: "cover", radius: 0 }));
    elements.push(scrim(full, true));
  }

  // Contrast-aware text colors derived from the resolved background (or scrim).
  const bgRep = bgColor(bg, theme.colors.background);
  const dark = hasImage ? true : luminance(bgRep) < 0.5;
  const readable = hasImage ? readableOn("#000000") : readableOn(bgRep);
  const titleColor = readable.strong;
  const subColor = readable.soft;
  const numberColor = dark ? tint(accent, 0.5) : accent;

  const marginX = 1.1;
  const blockW = size.width - marginX * 2;
  let y = size.height * 0.32;

  // Large section number.
  if (section.n) {
    const numH = 1.2;
    elements.push({
      id: uid("secnum"),
      type: "text",
      box: { x: marginX, y: y - numH - 0.1, w: blockW, h: numH },
      text: section.n,
      style: { size: 64, bold: true, color: numberColor, align: "left", vAlign: "bottom" },
      padding: 0.02,
    });
  }

  // Accent bar.
  elements.push({
    id: uid("secbar"),
    type: "shape",
    shape: "roundRect",
    box: { x: marginX + 0.02, y, w: 1.0, h: 0.12 },
    style: { fill: { type: "solid", color: dark ? "#FFFFFF" : accent }, radius: theme.radius.pill },
  });
  y += 0.34;

  // Title.
  const titleH = 1.4;
  const titleBase = { ...theme.typography.h1, color: titleColor, align: "left" as const, size: 44 };
  const titleFit = fitText(section.t, { boxW: blockW, boxH: titleH, padding: 0.03, base: titleBase, minFontSize: 26, maxLines: 2 }, warnings, where);
  elements.push({
    id: uid("sectitle"),
    type: "text",
    box: { x: marginX, y, w: blockW, h: titleH },
    text: titleFit.text,
    style: { ...titleFit.style, vAlign: "top" },
    padding: 0.03,
    fit: { mode: "shrink", minFontSize: 26 },
  });
  y += titleH + 0.05;

  // Subtitle.
  if (section.s) {
    const subH = 0.7;
    const subBase = { ...theme.typography.body, color: subColor, align: "left" as const, size: 18 };
    const subFit = fitText(section.s, { boxW: blockW, boxH: subH, padding: 0.03, base: subBase, minFontSize: 12, maxLines: 2 }, warnings, where);
    elements.push({
      id: uid("secsub"),
      type: "text",
      box: { x: marginX, y, w: blockW, h: subH },
      text: subFit.text,
      style: { ...subFit.style, vAlign: "top" },
      padding: 0.03,
    });
  }

  // Decorative corner circle.
  elements.push({
    id: uid("secdecor"),
    type: "shape",
    shape: "ellipse",
    box: { x: size.width - 2.4, y: size.height - 2.4, w: 3.4, h: 3.4 },
    style: { fill: { type: "solid", color: dark ? tint(accent, 0.15) : tint(accent, 0.85), opacity: dark ? 0.18 : 0.5 } },
  });

  return { slide: { id: slideId, background: bg, elements, notes: section.notes }, warnings };
}
