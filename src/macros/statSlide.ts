/**
 * Statistic slide.
 *
 * Two or three panels, each a small editable chart (bar/line/area/donut) over a
 * bold title and a description, with an optional rotated label down the left
 * edge. (The "Statistic" reference layout.)
 */

import type {
  ChartItemTuple,
  PPTElement,
  ResolvedTheme,
  SlideSize,
  StatPanel,
  StatSlideSpec,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, reserveTitle, columns } from "../layout/boxes.js";
import { CAPACITY, checkBudget } from "../core/capacity.js";
import { buildChart, type ChartDatum, type ChartSeries } from "../geometry/charts.js";
import { palette } from "../core/palette.js";
import { tint, mix } from "../core/color.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, cardLook, fitText, uid } from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

function normItem(it: ChartItemTuple): ChartDatum {
  if (Array.isArray(it)) return { label: it[0], value: it[1] };
  return { label: it.label ?? it.l ?? "", value: it.value ?? it.v ?? 0, color: it.color };
}

export function expandStatSlide(
  spec: StatSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { stat } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(stat.class, where);
  warnings.merge(classWarn);

  const bg = backgroundFill(tokens, theme, warnings, where);
  const accent = accentColor(tokens, theme);
  const panels = stat.items.slice(0, 3);

  const elements: PPTElement[] = [backgroundRect(bg, size)];
  const area = contentArea(size, theme, tokens);

  // Title spans the full width at the top.
  const hasTitle = !!stat.t;
  const { title: titleBox, rest: belowTitle } = hasTitle
    ? reserveTitle(area, 0.9, theme.spacing.md)
    : { title: undefined, rest: area };
  if (hasTitle && titleBox) elements.push(titleElement(stat.t!, titleBox, theme, bg, warnings, where));

  // Optional rotated side label — spans ONLY the panel region's height (not the
  // whole page). Authored horizontally (width = the panel height) and rotated
  // -90 about its center, placed at the left of the panel band.
  let rest = belowTitle;
  if (stat.eyebrow) {
    const labelW = 0.8;
    const cx = rest.x + 0.4;
    const cyc = rest.y + rest.h / 2;
    // Hard-cap the side label to a short token (at a word boundary) so it never
    // grows down the whole page, then fit it to the panel height.
    checkBudget(stat.eyebrow, CAPACITY.stat.eyebrow, "stat eyebrow", warnings, where);
    const eyebrow = capWords(stat.eyebrow.trim(), CAPACITY.stat.eyebrow.maxChars).toUpperCase();
    const lf = fitText(eyebrow, { boxW: rest.h - 0.5, boxH: labelW, padding: 0.02, base: { ...theme.typography.h1, size: 26, bold: true, color: accent, align: "center" }, minFontSize: 13, maxLines: 1 }, warnings, where);
    elements.push({
      id: uid("statlbl"),
      type: "text",
      box: { x: cx - rest.h / 2, y: cyc - labelW / 2, w: rest.h, h: labelW },
      text: lf.text,
      style: { ...lf.style, vAlign: "middle", letterSpacing: 1.5 },
      rotation: -90,
      padding: 0.02,
      noWrap: true,
    });
    rest = { x: rest.x + labelW, y: rest.y, w: rest.w - labelW, h: rest.h };
  }

  const cells = columns(rest, panels.length, theme.spacing.lg);
  panels.forEach((panel, i) => {
    const cell = cells[i];
    if (!cell) return;
    elements.push(...buildPanel(panel, cell, accent, { theme, tokens, warnings, where }));
  });

  return { slide: { id: slideId, background: bg, elements, notes: stat.notes }, warnings };
}

/** Trim to at most `max` chars at a word boundary (hard slice if the first word is longer). */
function capWords(s: string, max: number): string {
  if (s.length <= max) return s;
  let out = "";
  for (const w of s.split(/\s+/)) {
    if ((out ? out.length + 1 : 0) + w.length > max) break;
    out = out ? `${out} ${w}` : w;
  }
  return out || s.slice(0, max);
}

function buildPanel(
  panel: StatPanel,
  cell: { x: number; y: number; w: number; h: number },
  accent: string,
  opts: { theme: ResolvedTheme; tokens: ReturnType<typeof resolveClasses>["tokens"]; warnings: Warnings; where: string }
): PPTElement[] {
  const { theme } = opts;
  const els: PPTElement[] = [];
  const look = cardLook(opts.tokens, theme);

  els.push({ id: uid("scard"), type: "shape", shape: "roundRect", box: { ...cell }, style: look.style });

  const pad = theme.spacing.md;
  const type = panel.type ?? "bar";
  const multi = opts.tokens.colorful || opts.tokens.accent === "multi";

  // Resolve chart data (tolerant of items/series like the chart macro).
  let data: ChartDatum[] = (panel.items ?? []).map(normItem);
  let series: ChartSeries[] = (panel.series ?? []).map((s) => ({ name: s.name, color: s.color, data: s.data, points: s.points?.map(([x, y]) => ({ x, y })) }));
  let categories = panel.x ?? data.map((d) => d.label);
  if ((type === "line" || type === "area") && series.length === 0 && data.length > 0) {
    series = [{ name: panel.t ?? panel.title ?? "", data: data.map((d) => d.value) }];
    categories = data.map((d) => d.label);
  }
  if ((type === "bar" || type === "donut") && data.length === 0 && series.length > 0) {
    const s = series[0];
    data = (s.data ?? []).map((v, i) => ({ label: (panel.x ?? [])[i] ?? `#${i + 1}`, value: v }));
    categories = data.map((d) => d.label);
  }
  const colorCount = Math.max(data.length, series.length, 1);
  const colors = palette(theme, Math.max(4, colorCount), multi ? undefined : accent);
  // Single-accent bar/donut → monochrome intensity scale (largest = most
  // saturated), matching the chart macro.
  if (!multi && (type === "bar" || type === "donut") && data.length > 0) {
    const vals = data.map((d) => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const light = tint(accent, 0.6);
    data = data.map((d) => ({ ...d, color: d.color ?? mix(light, accent, max === min ? 1 : (d.value - min) / (max - min)) }));
  }

  // Chart fills the top portion of the card.
  const chartH = cell.h * 0.46;
  const chartBox = { x: cell.x + pad, y: cell.y + pad, w: cell.w - pad * 2, h: chartH };
  els.push(...buildChart(chartBox, data, series, { theme, colors, type, categories, showValues: type === "bar", pattern: panel.pattern }));

  let y = cell.y + pad + chartH + theme.spacing.sm;
  const title = panel.title ?? panel.t;
  if (title) {
    const titleLines = checkBudget(title, CAPACITY.stat.title, `stat title "${title}"`, opts.warnings, opts.where);
    const titleH = 0.7;
    const tf = fitText(title, { boxW: cell.w - pad * 2, boxH: titleH, padding: 0.02, base: { ...theme.typography.h2, size: 18, color: look.textColor, align: "left" }, minFontSize: 13, maxLines: titleLines }, opts.warnings, opts.where);
    els.push({ id: uid("stitle"), type: "text", box: { x: cell.x + pad, y, w: cell.w - pad * 2, h: titleH }, text: tf.text, style: { ...tf.style, vAlign: "top" }, padding: 0.02 });
    y += titleH + theme.spacing.xs;
  }
  const body = panel.body ?? panel.s;
  if (body) {
    const bodyLines = checkBudget(body, CAPACITY.stat.body, "stat body", opts.warnings, opts.where);
    const bodyH = cell.y + cell.h - pad - y;
    const bf = fitText(body, { boxW: cell.w - pad * 2, boxH: bodyH, padding: 0.02, base: { ...theme.typography.body, size: 13, color: look.mutedTextColor, align: "left" }, minFontSize: 9, maxLines: bodyLines }, opts.warnings, opts.where);
    els.push({ id: uid("sbody"), type: "text", box: { x: cell.x + pad, y, w: cell.w - pad * 2, h: bodyH }, text: bf.text, style: { ...bf.style, vAlign: "top" }, padding: 0.02 });
  }

  return els;
}
