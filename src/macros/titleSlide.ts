/**
 * Title slide expander.
 *
 * Produces: full-slide background (editable rect), optional hero decoration
 * shapes, a title text box, and an optional subtitle text box.
 */

import type {
  PPTElement,
  PPTSlide,
  ResolvedTheme,
  ShapeElement,
  SlideSize,
  TextElement,
  TitleSlideSpec,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { titleLayout } from "../layout/title.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, bgColor, fitText, imageContainer, readableColors, scrim, uid } from "./shared.js";
import { buildCoverDecor, pickDefaultDecor } from "../geometry/coverDecor.js";
import { ensureReadable, readableOn } from "../core/color.js";

export interface ExpandedSlide {
  slide: PPTSlide;
  warnings: Warnings;
}

export function expandTitleSlide(
  spec: TitleSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { title } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(title.class, where);
  warnings.merge(classWarn);

  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);
  const hero = !!tokens.hero;

  // Contrast-aware foreground colors derived from the actual background.
  const bgRep = bgColor(bg, theme.colors.background);
  let readable = readableColors(bg, theme.colors.background);
  // Decorative accent bar: keep the accent if it reads on the bg, else white/ink.
  let barColor = ensureReadable(accent, bgRep, 2.2);

  const layout = titleLayout(size, { hasSubtitle: !!title.s, hero });

  const elements: PPTElement[] = [];

  // Background as the first, editable, full-slide rectangle.
  const bgRect: ShapeElement = {
    id: uid("bg"),
    type: "shape",
    shape: "rect",
    box: { x: 0, y: 0, w: size.width, h: size.height },
    style: { fill: bg, stroke: undefined, shadow: theme.shadows.none },
  };
  elements.push(bgRect);

  const full = { x: 0, y: 0, w: size.width, h: size.height };
  const hasImage = !!title.image?.data?.length;
  if (hasImage) {
    // Full-bleed image + dark scrim; force light, readable text.
    elements.push(...imageContainer(title.image, full, theme, { fit: "cover", radius: 0 }));
    elements.push(scrim(full, true));
    readable = readableOn("#000000");
    barColor = ensureReadable(accent, "#000000", 2.2);
  } else {
    // Geometric cover effect, drawn behind the text. Applied by DEFAULT on every
    // cover (auto-picked from the title); `decor-*` class to choose / `decor-none`.
    const decorStyle = tokens.decor ?? pickDefaultDecor(title.t);
    elements.push(...buildCoverDecor(decorStyle, size, { accent, theme }));
  }

  // Accent bar above the title.
  elements.push({
    id: uid("accentbar"),
    type: "shape",
    shape: "roundRect",
    box: { x: layout.title.x + 0.04, y: layout.title.y - 0.36, w: 0.95, h: 0.12 },
    style: { fill: { type: "solid", color: barColor }, radius: theme.radius.pill },
  });

  // Title text.
  const titleScale = tokens.titleScale === "xl" ? 1.12 : tokens.titleScale === "lg" ? 1 : 1;
  const titleBase = { ...theme.typography.h1, size: Math.round(theme.typography.h1.size * titleScale), align: "left" as const, color: readable.strong };
  const titleFit = fitText(
    title.t,
    { boxW: layout.title.w, boxH: layout.title.h, padding: 0.05, base: titleBase, minFontSize: 24, maxLines: 3 },
    warnings,
    where
  );
  const titleEl: TextElement = {
    id: uid("title"),
    type: "text",
    box: layout.title,
    text: titleFit.text,
    style: { ...titleFit.style, vAlign: "bottom" },
    padding: 0.05,
    fit: { mode: "shrink", minFontSize: 24 },
  };
  elements.push(titleEl);

  // Subtitle text.
  if (title.s && layout.subtitle) {
    const subBase = { ...theme.typography.body, size: 18, color: readable.soft, align: "left" as const };
    const subFit = fitText(
      title.s,
      { boxW: layout.subtitle.w, boxH: layout.subtitle.h, padding: 0.05, base: subBase, minFontSize: 12, maxLines: 2 },
      warnings,
      where
    );
    elements.push({
      id: uid("subtitle"),
      type: "text",
      box: layout.subtitle,
      text: subFit.text,
      style: { ...subFit.style, vAlign: "top" },
      padding: 0.05,
      fit: { mode: "shrink", minFontSize: 12 },
    });
  }

  const slide: PPTSlide = {
    id: slideId,
    background: bg,
    elements,
    notes: title.notes,
  };
  return { slide, warnings };
}
