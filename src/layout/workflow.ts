/**
 * Workflow placement: a horizontal row of step cards with gaps sized to leave
 * room for connector arrows between them, plus an optional callout band.
 */

import type { Box } from "../core/types.js";

export interface WorkflowResult {
  /** one box per step card */
  steps: Box[];
  /** gap regions between consecutive steps (for arrows) */
  gaps: Box[];
  /** optional callout band below the steps */
  callout?: Box;
}

export function workflowLayout(
  area: Box,
  stepCount: number,
  opts: { gap: number; hasCallout: boolean; calloutHeight: number; calloutGap: number }
): WorkflowResult {
  let stepsArea = area;
  let callout: Box | undefined;

  if (opts.hasCallout) {
    const bandH = opts.calloutHeight;
    callout = {
      x: area.x,
      y: area.y + area.h - bandH,
      w: area.w,
      h: bandH,
    };
    stepsArea = { x: area.x, y: area.y, w: area.w, h: area.h - bandH - opts.calloutGap };
  }

  const n = Math.max(1, stepCount);
  const totalGap = opts.gap * (n - 1);
  const cardW = (stepsArea.w - totalGap) / n;

  const steps: Box[] = [];
  const gaps: Box[] = [];
  for (let i = 0; i < n; i++) {
    const x = stepsArea.x + i * (cardW + opts.gap);
    steps.push({ x, y: stepsArea.y, w: cardW, h: stepsArea.h });
    if (i < n - 1) {
      gaps.push({
        x: x + cardW,
        y: stepsArea.y,
        w: opts.gap,
        h: stepsArea.h,
      });
    }
  }

  return { steps, gaps, callout };
}
