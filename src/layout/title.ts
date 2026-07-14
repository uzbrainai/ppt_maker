/**
 * Title-slide layout: vertically centered title + subtitle block, with optional
 * decorative geometry boxes for the `hero` variant.
 */

import type { Box, SlideSize } from "../core/types.js";

export interface TitleLayoutResult {
  title: Box;
  subtitle?: Box;
  /** decorative boxes (hero accents); empty when not hero */
  decor: Box[];
}

export function titleLayout(
  size: SlideSize,
  opts: { hasSubtitle: boolean; hero: boolean }
): TitleLayoutResult {
  const marginX = 1.0;
  const blockW = size.width - marginX * 2;

  const titleH = 1.5;
  const subH = opts.hasSubtitle ? 0.9 : 0;
  const gap = opts.hasSubtitle ? 0.15 : 0;
  const blockH = titleH + gap + subH;

  const top = (size.height - blockH) / 2;

  const title: Box = { x: marginX, y: top, w: blockW, h: titleH };
  const subtitle: Box | undefined = opts.hasSubtitle
    ? { x: marginX, y: top + titleH + gap, w: blockW, h: subH }
    : undefined;

  const decor: Box[] = [];
  if (opts.hero) {
    // A large soft circle off the top-right and a thin accent bar under title.
    decor.push({
      x: size.width - 2.6,
      y: -1.4,
      w: 4.0,
      h: 4.0,
    });
    decor.push({
      x: -1.2,
      y: size.height - 2.2,
      w: 3.2,
      h: 3.2,
    });
    // accent bar
    decor.push({
      x: marginX,
      y: top - 0.35,
      w: 0.9,
      h: 0.12,
    });
  }

  return { title, subtitle, decor };
}
