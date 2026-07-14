/**
 * Workflow slide expander.
 *
 * Produces: background, title, a horizontal row of step cards (each a group with
 * card bg + icon + step number + title + body), connector arrows between steps,
 * and an optional callout band.
 */

import type {
  GroupElement,
  LineElement,
  NormalizedItem,
  PPTElement,
  PPTSlide,
  ResolvedTheme,
  SlideSize,
  StrokeSpec,
  WorkflowSlideSpec,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { normalizeItems } from "../dsl/normalize.js";
import { contentArea, reserveTitle } from "../layout/boxes.js";
import { workflowLayout } from "../layout/workflow.js";
import { buildIcon } from "../geometry/icons.js";
import { tint } from "../core/color.js";
import { Warnings } from "../validation/warnings.js";
import {
  accentColor,
  backgroundFill,
  cardLook,
  densityScale,
  fitText,
  noteBlock,
  uid,
} from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

export function expandWorkflowSlide(
  spec: WorkflowSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { wf } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(wf.class, where);
  warnings.merge(classWarn);

  const steps = normalizeItems(wf.steps);
  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);
  const look = cardLook(tokens, theme);
  const dScale = densityScale(tokens);
  const gap = Math.max(theme.spacing[tokens.gap ?? "md"], 0.5); // ensure arrow room

  const elements: PPTElement[] = [];
  elements.push(backgroundRect(bg, size));

  const area = contentArea(size, theme, tokens);
  const hasTitle = !!wf.t;
  const { title: titleBox, rest } = hasTitle
    ? reserveTitle(area, 0.9, theme.spacing.md)
    : { title: undefined, rest: area };
  if (hasTitle && titleBox) {
    elements.push(titleElement(wf.t!, titleBox, theme, bg, warnings, where));
  }

  const hasCallout = !!wf.callout;
  const layout = workflowLayout(rest, steps.length, {
    gap,
    hasCallout,
    calloutHeight: 0.72,
    calloutGap: theme.spacing.md,
  });

  // Cap step-card height to its content and center the row vertically so cards
  // aren't stretched into tall empty boxes.
  const hasBody = steps.some((s) => s.body);
  const stepH = Math.min(layout.steps[0]?.h ?? 2, hasBody ? 2.2 : 1.4);
  const bandH = layout.steps[0]?.h ?? stepH;
  const yOffset = Math.max(0, (bandH - stepH) / 2);

  // Step cards.
  steps.forEach((step, i) => {
    const cell = layout.steps[i];
    if (!cell) return;
    const sized = { x: cell.x, y: cell.y + yOffset, w: cell.w, h: stepH };
    elements.push(
      buildStepCard(step, i + 1, sized, {
        theme,
        look,
        accent,
        dScale,
        padInner: theme.spacing.sm,
        iconVariant: tokens.icons?.style ?? "line",
        warnings,
        where,
      })
    );
  });

  // Arrows between steps — vertically centered on the (now shorter) cards.
  const arrowStyle = tokens.arrows?.style ?? "soft";
  const arrowY = (layout.steps[0]?.y ?? rest.y) + yOffset + stepH / 2;
  layout.gaps.forEach((g, i) => {
    elements.push(connectorArrow({ ...g, y: arrowY - g.h / 2 }, accent, arrowStyle, theme, i));
  });

  // Callout band (dark-mode aware).
  if (hasCallout && layout.callout) {
    elements.push(...noteBlock(layout.callout, { text: wf.callout!, color: accent, theme, warnings, where }));
  }

  const slide: PPTSlide = { id: slideId, background: bg, elements, notes: wf.notes };
  return { slide, warnings };
}

interface StepOpts {
  theme: ResolvedTheme;
  look: ReturnType<typeof cardLook>;
  accent: string;
  dScale: number;
  padInner: number;
  iconVariant: "line" | "filled";
  warnings: Warnings;
  where: string;
}

function buildStepCard(
  step: NormalizedItem,
  index: number,
  cell: { x: number; y: number; w: number; h: number },
  opts: StepOpts
): GroupElement {
  const { theme, look, accent, padInner } = opts;
  const children: PPTElement[] = [];

  // Card bg.
  children.push({
    id: uid("step"),
    type: "shape",
    shape: "roundRect",
    box: { ...cell },
    style: look.style,
  });

  const innerX = cell.x + padInner;
  const innerW = cell.w - padInner * 2;
  let cursorY = cell.y + padInner;

  // Step number badge (top-right).
  const badge = 0.34;
  children.push({
    id: uid("badge"),
    type: "shape",
    shape: "ellipse",
    box: { x: cell.x + cell.w - padInner - badge, y: cursorY, w: badge, h: badge },
    style: { fill: { type: "solid", color: accent } },
    text: String(index),
    textStyle: { size: 12, bold: true, color: "#FFFFFF", align: "center", vAlign: "middle" },
  });

  // Icon chip (top-left).
  const iconSize = Math.min(0.5, cell.h * 0.22);
  const chip = iconSize + 0.16;
  const chipBox = { x: innerX, y: cursorY, w: chip, h: chip };
  if (step.icon) {
    children.push({
      id: uid("chip"),
      type: "shape",
      shape: "roundRect",
      box: chipBox,
      style: {
        fill: { type: "solid", color: opts.iconVariant === "filled" ? accent : tint(accent, 0.85) },
        radius: theme.radius.md,
      },
    });
    const iconBox = {
      x: chipBox.x + (chip - iconSize) / 2,
      y: chipBox.y + (chip - iconSize) / 2,
      w: iconSize,
      h: iconSize,
    };
    const { elements: iconShapes, known } = buildIcon(step.icon, iconBox, {
      color: opts.iconVariant === "filled" ? "#FFFFFF" : accent,
      variant: opts.iconVariant,
    });
    if (!known) {
      opts.warnings.add("unknown-icon", `Unknown icon "${step.icon}" rendered as placeholder.`, opts.where);
    }
    children.push(...iconShapes);
  }
  cursorY = chipBox.y + chip + theme.spacing.sm;

  // Title.
  const titleH = 0.36;
  const titleBox = { x: innerX, y: cursorY, w: innerW, h: titleH };
  const titleBase = { ...theme.typography.bodyStrong, size: Math.round(14 * opts.dScale), color: look.textColor, align: "left" as const };
  const titleFit = fitText(step.title, { boxW: innerW, boxH: titleH, padding: 0.02, base: titleBase, minFontSize: 10, maxLines: 2 }, opts.warnings, opts.where);
  children.push({
    id: uid("stitle"),
    type: "text",
    box: titleBox,
    text: titleFit.text,
    style: { ...titleFit.style, vAlign: "top" },
    padding: 0.02,
    fit: { mode: "shrink", minFontSize: 10 },
  });
  cursorY = titleBox.y + titleH + theme.spacing.xs;

  // Body.
  if (step.body) {
    const bodyBox = { x: innerX, y: cursorY, w: innerW, h: cell.y + cell.h - padInner - cursorY };
    const bodyBase = { ...theme.typography.body, size: Math.round(11 * opts.dScale), color: look.mutedTextColor, align: "left" as const };
    const bodyFit = fitText(step.body, { boxW: innerW, boxH: bodyBox.h, padding: 0.02, base: bodyBase, minFontSize: 8, len: step.len }, opts.warnings, opts.where);
    children.push({
      id: uid("sbody"),
      type: "text",
      box: bodyBox,
      text: bodyFit.text,
      style: { ...bodyFit.style, vAlign: "top" },
      padding: 0.02,
      fit: { mode: "shrink", minFontSize: 8 },
    });
  }

  return { id: uid("stepgroup"), type: "group", box: { ...cell }, children };
}

function connectorArrow(
  gapBox: { x: number; y: number; w: number; h: number },
  accent: string,
  style: "soft" | "bold",
  _theme: ResolvedTheme,
  _i: number
): LineElement {
  const y = gapBox.y + gapBox.h / 2;
  const inset = gapBox.w * 0.18;
  const stroke: StrokeSpec = {
    color: accent,
    width: style === "bold" ? 3 : 1.75,
    headEnd: "triangle",
    headStart: "none",
  };
  return {
    id: uid("arrow"),
    type: "line",
    box: { x: gapBox.x + inset, y: y - 0.02, w: gapBox.w - inset * 2, h: 0.04 },
    from: { x: gapBox.x + inset, y },
    to: { x: gapBox.x + gapBox.w - inset, y },
    stroke,
  };
}

