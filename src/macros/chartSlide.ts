/**
 * Chart slide expander. Renders one editable vector chart filling the content
 * area (space-aware), with an optional legend column.
 */

import type {
  ChartItemTuple,
  ChartSlideSpec,
  PPTElement,
  ResolvedTheme,
  SlideSize,
} from "../core/types.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { contentArea, reserveTitle, split, rows } from "../layout/boxes.js";
import { buildChart, buildLegend, type ChartDatum, type ChartSeries } from "../geometry/charts.js";
import { palette } from "../core/palette.js";
import { tint, mix } from "../core/color.js";
import { Warnings } from "../validation/warnings.js";
import { accentColor, backgroundFill, fitText, uid } from "./shared.js";
import { backgroundRect, titleElement } from "./cardsSlide.js";
import type { ExpandedSlide } from "./titleSlide.js";

function normItem(it: ChartItemTuple): ChartDatum {
  if (Array.isArray(it)) return { label: it[0], value: it[1] };
  return { label: it.label ?? it.l ?? "", value: it.value ?? it.v ?? 0, color: it.color };
}

export function expandChartSlide(
  spec: ChartSlideSpec,
  theme: ResolvedTheme,
  size: SlideSize,
  slideId: string,
  where: string
): ExpandedSlide {
  const warnings = new Warnings();
  const { chart } = spec;
  const { tokens, warnings: classWarn } = resolveClasses(chart.class, where);
  warnings.merge(classWarn);

  const bg = backgroundFill(tokens, theme, warnings, where);
  let data = (chart.items ?? []).map(normItem);
  let series: ChartSeries[] = (chart.series ?? []).map((s) => ({
    name: s.name,
    color: s.color,
    data: s.data,
    points: s.points?.map(([x, y]) => ({ x, y })),
  }));
  let categories = chart.x ?? data.map((d) => d.label);

  // Be tolerant of either data shape (LLMs mix them up):
  //  - bar/donut need categorical `items`; derive from series+x if missing.
  //  - line/area need `series`; derive a single series from items if missing.
  const cat = chart.type === "bar" || chart.type === "barh" || chart.type === "donut";
  if (cat && data.length === 0 && series.length > 0) {
    const s = series[0];
    const labels = chart.x ?? [];
    data = (s.data ?? []).map((v, i) => ({ label: labels[i] ?? `#${i + 1}`, value: v }));
    categories = data.map((d) => d.label);
    warnings.add("text-overflow-risk", `chart "${chart.t ?? ""}": ${chart.type} used series+x; converted to items. Prefer items:[[label,value]].`, where);
  }
  if ((chart.type === "line" || chart.type === "area") && series.length === 0 && data.length > 0) {
    series = [{ name: chart.t ?? "", data: data.map((d) => d.value) }];
    categories = data.map((d) => d.label);
    warnings.add("text-overflow-risk", `chart "${chart.t ?? ""}": ${chart.type} used items; converted to a series. Prefer x + series.`, where);
  }

  // Colors: multi/colorful → palette. Single accent → an INTENSITY scale where
  // the largest value is the most saturated accent and smaller values are
  // lighter tints (bar/donut only).
  const colorCount = Math.max(data.length, series.length, 1);
  const multi = tokens.colorful || tokens.accent === "multi";
  const accent = accentColor(tokens, theme);
  const colors = palette(theme, Math.max(8, colorCount), multi ? undefined : accent);
  if (!multi && (chart.type === "bar" || chart.type === "barh" || chart.type === "donut") && data.length > 0) {
    const vals = data.map((d) => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const light = tint(accent, 0.6);
    data = data.map((d) => ({
      ...d,
      color: d.color ?? mix(light, accent, max === min ? 1 : (d.value - min) / (max - min)),
    }));
  }

  const elements: PPTElement[] = [backgroundRect(bg, size)];

  const area = contentArea(size, theme, tokens);
  const hasTitle = !!chart.t;
  const { title: titleBox, rest } = hasTitle
    ? reserveTitle(area, 0.9, theme.spacing.md)
    : { title: undefined, rest: area };
  if (hasTitle && titleBox) elements.push(titleElement(chart.t!, titleBox, theme, bg, warnings, where));

  // A chart is never shown alone: it always gets an explanation panel on the
  // right (legend + insight bullets / paragraph). If the author supplied no
  // insight text we still render the legend and warn — a prompt to add context.
  const multiSeries = series.length > 1;
  const hasInsight = !!(chart.s || (chart.points && chart.points.length));
  const legendEntries =
    data.length
      ? data.map((d, i) => ({ label: d.label, color: d.color ?? colors[i % colors.length] }))
      : series.map((s, i) => ({ label: s.name ?? `Series ${i + 1}`, color: s.color ?? colors[i % colors.length] }));
  const showLegend = chart.legend ?? (chart.type === "donut" || multiSeries);

  if (!hasInsight) {
    warnings.add(
      "text-overflow-risk",
      "Chart slide has no explanation (`s`/`points`); add context so a chart never stands alone.",
      where
    );
  }

  // Layout: chart left, explanation panel right.
  const [left, right] = split(rest, 0.62, theme.spacing.lg);

  // Explanation panel (subtle card).
  elements.push({
    id: uid("panel"),
    type: "shape",
    shape: "roundRect",
    box: right,
    style: { fill: { type: "solid", color: theme.colors.surfaceMuted }, radius: theme.radius.lg },
  });
  const pad = theme.spacing.md;
  let py = right.y + pad;
  const panelX = right.x + pad;
  const panelW = right.w - pad * 2;

  const insightTitle = chart.insightTitle ?? "Tahlil";
  const headFit = fitText(insightTitle, { boxW: panelW, boxH: 0.4, padding: 0.02, base: { ...theme.typography.bodyStrong, size: 15, color: theme.colors.text, align: "left" }, minFontSize: 11, maxLines: 1 }, warnings, where);
  elements.push({ id: uid("panelhd"), type: "text", box: { x: panelX, y: py, w: panelW, h: 0.36 }, text: headFit.text, style: { ...headFit.style, vAlign: "middle" }, padding: 0.02 });
  py += 0.44;

  if (showLegend) {
    const legH = Math.min(legendEntries.length * 0.36, right.y + right.h - pad - py - 0.2);
    elements.push(...buildLegend({ x: panelX, y: py, w: panelW, h: legH }, legendEntries, theme));
    py += legH + theme.spacing.sm;
  }

  if (chart.s) {
    const sH = chart.points && chart.points.length ? Math.min(1.4, (right.y + right.h - pad - py) * 0.5) : right.y + right.h - pad - py;
    const sf = fitText(chart.s, { boxW: panelW, boxH: sH, padding: 0.02, base: { ...theme.typography.body, size: 13, color: theme.colors.textMuted, align: "left" }, minFontSize: 10, maxLines: 6 }, warnings, where);
    elements.push({ id: uid("panelp"), type: "text", box: { x: panelX, y: py, w: panelW, h: sH }, text: sf.text, style: { ...sf.style, vAlign: "top" }, padding: 0.02 });
    py += sH + theme.spacing.xs;
  }

  if (chart.points && chart.points.length) {
    const listH = right.y + right.h - pad - py;
    const rowBoxes = rows({ x: panelX, y: py, w: panelW, h: listH }, chart.points.length, theme.spacing.xs);
    chart.points.forEach((p, i) => {
      const r = rowBoxes[i];
      if (!r) return;
      // Match the dot to the i-th category color (segment + legend), so the
      // insight bullets line up with the chart instead of using a stray hue.
      const color = legendEntries[i]?.color ?? colors[i % colors.length];
      const dot = 0.16;
      elements.push({ id: uid("pdot"), type: "shape", shape: "ellipse", box: { x: r.x, y: r.y + (r.h - dot) / 2, w: dot, h: dot }, style: { fill: { type: "solid", color } } });
      const tx = r.x + dot + theme.spacing.sm;
      const pf = fitText(p, { boxW: r.x + r.w - tx, boxH: r.h, padding: 0.02, base: { ...theme.typography.body, size: 12, color: theme.colors.text, align: "left" }, minFontSize: 9, maxLines: 2 }, warnings, where);
      elements.push({ id: uid("ptx"), type: "text", box: { x: tx, y: r.y, w: r.x + r.w - tx, h: r.h }, text: pf.text, style: { ...pf.style, vAlign: "middle" }, padding: 0.02 });
    });
  }

  elements.push(
    ...buildChart(left, data, series, {
      theme,
      colors,
      type: chart.type,
      categories,
      showValues: chart.values ?? (chart.type === "bar" || chart.type === "barh"),
      pattern: chart.pattern,
    })
  );

  return { slide: { id: slideId, background: bg, elements, notes: chart.notes }, warnings };
}
