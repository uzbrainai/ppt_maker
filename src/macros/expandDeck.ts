/**
 * Expand a parsed DeckSpec into a fully-resolved PPTScene.
 *
 * This is the heart of the "LLM output minimal → slidewind output rich"
 * principle: each terse slide macro becomes explicit, positioned, styled
 * elements that the OOXML compiler can emit verbatim.
 */

import type {
  BulletsSlideSpec,
  CardsSlideSpec,
  ChartSlideSpec,
  CmpSlideSpec,
  DeckSpec,
  GaugeSlideSpec,
  KpiSlideSpec,
  PPTScene,
  PPTSlide,
  PyramidSlideSpec,
  ResolvedTheme,
  SectionSlideSpec,
  ShapeElement,
  SlideSize,
  SummarySlideSpec,
  TableSlideSpec,
  TextElement,
  TimelineSlideSpec,
  TitleSlideSpec,
  WorkflowSlideSpec,
  AgendaSlideSpec,
  RoadmapSlideSpec,
  ProblemSlideSpec,
  StatSlideSpec,
  CriteriaSlideSpec,
  HighlightSlideSpec,
  SpineSlideSpec,
  ShowcaseSlideSpec,
  ColumnsSlideSpec,
  RadialSlideSpec,
  FunnelSlideSpec,
} from "../core/types.js";
import { slideSize } from "../core/units.js";
import { resolveTheme } from "../themes/index.js";
import { resolveClasses } from "../classes/resolveClasses.js";
import { slideKind } from "../dsl/normalize.js";
import { contentArea, reserveTitle } from "../layout/boxes.js";
import { Warnings } from "../validation/warnings.js";
import { expandTitleSlide } from "./titleSlide.js";
import { expandCardsSlide, backgroundRect, titleElement } from "./cardsSlide.js";
import { expandWorkflowSlide } from "./workflowSlide.js";
import { expandKpiSlide } from "./kpiSlide.js";
import { expandBulletsSlide } from "./bulletsSlide.js";
import { expandSectionSlide } from "./sectionSlide.js";
import { expandCmpSlide } from "./cmpSlide.js";
import { expandChartSlide } from "./chartSlide.js";
import { expandTimelineSlide } from "./timelineSlide.js";
import { expandSummarySlide } from "./summarySlide.js";
import { expandGaugeSlide } from "./gaugeSlide.js";
import { expandPyramidSlide } from "./pyramidSlide.js";
import { expandTableSlide } from "./tableSlide.js";
import { expandAgendaSlide } from "./agendaSlide.js";
import { expandRoadmapSlide } from "./roadmapSlide.js";
import { expandProblemSlide } from "./problemSlide.js";
import { expandStatSlide } from "./statSlide.js";
import { expandCriteriaSlide } from "./criteriaSlide.js";
import { expandHighlightSlide } from "./highlightSlide.js";
import { expandSpineSlide } from "./spineSlide.js";
import { expandShowcaseSlide } from "./showcaseSlide.js";
import { expandColumnsSlide } from "./columnsSlide.js";
import { expandRadialSlide } from "./radialSlide.js";
import { expandFunnelSlide } from "./funnelSlide.js";
import { backgroundFill, fitText, uid } from "./shared.js";

/** Slide kinds that get a footer (deck name + page number). */
const FOOTER_KINDS = new Set([
  "cards", "wf", "kpi", "bullets", "cmp", "chart", "timeline", "summary", "gauge", "pyramid", "table",
  "agenda", "roadmap", "problem", "stat", "criteria", "highlight", "spine", "showcase",
  "columns", "radial", "funnel", "arch",
]);

export interface ExpandResult {
  scene: PPTScene;
  warnings: Warnings;
}

export function expandDeck(deck: DeckSpec): ExpandResult {
  const warnings = new Warnings();
  const theme = resolveTheme(deck.theme ?? deck.deck, deck.appearance, warnings);
  const size = slideSize(deck.size);

  const slides: PPTSlide[] = [];

  deck.slides.forEach((rawSlide, index) => {
    const where = `slide ${index + 1}`;
    const id = `slide${index + 1}`;
    const kind = slideKind(rawSlide as Record<string, unknown>);

    switch (kind) {
      case "title": {
        const r = expandTitleSlide(rawSlide as TitleSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "cards": {
        const r = expandCardsSlide(rawSlide as CardsSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "wf": {
        const r = expandWorkflowSlide(rawSlide as WorkflowSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "kpi": {
        const r = expandKpiSlide(rawSlide as KpiSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "bullets": {
        const r = expandBulletsSlide(rawSlide as BulletsSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "section": {
        const r = expandSectionSlide(rawSlide as SectionSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "cmp": {
        const r = expandCmpSlide(rawSlide as CmpSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "chart": {
        const r = expandChartSlide(rawSlide as ChartSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "timeline": {
        const r = expandTimelineSlide(rawSlide as TimelineSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "summary": {
        const r = expandSummarySlide(rawSlide as SummarySlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "gauge": {
        const r = expandGaugeSlide(rawSlide as GaugeSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "pyramid": {
        const r = expandPyramidSlide(rawSlide as PyramidSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "table": {
        const r = expandTableSlide(rawSlide as TableSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "agenda": {
        const r = expandAgendaSlide(rawSlide as AgendaSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "roadmap": {
        const r = expandRoadmapSlide(rawSlide as RoadmapSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "problem": {
        const r = expandProblemSlide(rawSlide as ProblemSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "stat": {
        const r = expandStatSlide(rawSlide as StatSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "criteria": {
        const r = expandCriteriaSlide(rawSlide as CriteriaSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "highlight": {
        const r = expandHighlightSlide(rawSlide as HighlightSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "spine": {
        const r = expandSpineSlide(rawSlide as SpineSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "showcase": {
        const r = expandShowcaseSlide(rawSlide as ShowcaseSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "columns": {
        const r = expandColumnsSlide(rawSlide as ColumnsSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "radial": {
        const r = expandRadialSlide(rawSlide as RadialSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "funnel": {
        const r = expandFunnelSlide(rawSlide as FunnelSlideSpec, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      case "arch": {
        const r = expandStubSlide(kind, rawSlide as Record<string, unknown>, theme, size, id, where);
        slides.push(r.slide);
        warnings.merge(r.warnings);
        break;
      }
      default: {
        warnings.add("unknown-slide-macro", `Unrecognized slide macro; skipped.`, where);
      }
    }

    // Footer (source link or deck name + page number) on content slides.
    const last = slides[slides.length - 1];
    if (last && last.id === id) {
      const block = (rawSlide as Record<string, { class?: string; source?: string }>)[kind] ?? {};
      const { tokens } = resolveClasses(block.class, where);
      const wantFooter = tokens.footer ?? FOOTER_KINDS.has(kind);
      if (wantFooter) {
        addFooter(last, theme, size, deck.deck ?? "slidewind", index + 1, deck.slides.length, block.source);
      }
    }
  });

  const scene: PPTScene = {
    version: "pptscene/0.1",
    unit: "inch",
    size,
    theme,
    slides,
  };

  return { scene, warnings };
}

/** Short, human label for a URL: host without "www.", optionally first path seg. */
function sourceLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const seg = u.pathname.split("/").filter(Boolean)[0];
    const label = seg && seg.length <= 16 ? `${host}/${seg}` : host;
    return label.length <= 48 ? label : host;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").slice(0, 48);
  }
}

/**
 * Add a slim footer: a hairline rule, then on the left either the page's SOURCE
 * (a clickable link to where its data came from) or the deck name, and the page
 * number on the right.
 */
function addFooter(
  slide: PPTSlide,
  theme: ResolvedTheme,
  size: SlideSize,
  deckName: string,
  pageNo: number,
  total: number,
  source?: string
): void {
  const y = size.height - 0.42;
  const marginX = 0.6;

  slide.elements.push({
    id: uid("footrule"),
    type: "shape",
    shape: "rect",
    box: { x: marginX, y: y - 0.06, w: size.width - marginX * 2, h: 0.012 },
    style: { fill: { type: "solid", color: theme.colors.border } },
  });
  // Left: the source link for this page (falls back to the deck name).
  const hasSource = !!(source && /^https?:\/\//i.test(source));
  slide.elements.push({
    id: uid("footname"),
    type: "text",
    box: { x: marginX, y, w: size.width * 0.62, h: 0.3 },
    text: hasSource ? sourceLabel(source!) : deckName,
    link: hasSource ? source : undefined,
    style: { ...theme.typography.caption, color: hasSource ? theme.colors.primary : theme.colors.textMuted, align: "left", vAlign: "middle" },
    padding: 0.02,
    noWrap: true,
  });
  slide.elements.push({
    id: uid("footpage"),
    type: "text",
    box: { x: size.width / 2, y, w: size.width / 2 - marginX, h: 0.3 },
    text: `${pageNo} / ${total}`,
    style: { ...theme.typography.caption, color: theme.colors.textMuted, align: "right", vAlign: "middle" },
    padding: 0.02,
  });
}

/**
 * Stub expander for arch / cmp / roadmap.
 *
 * TODO: implement full layouts:
 *   - arch    → layered architecture diagram (tiers + connectors)
 *   - cmp     → comparison table / two-column pros-cons
 *   - roadmap → timeline with milestone markers
 *
 * For now it renders a titled placeholder card so the deck still compiles.
 */
function expandStubSlide(
  kind: "arch",
  raw: Record<string, unknown>,
  theme: ResolvedTheme,
  size: SlideSize,
  id: string,
  where: string
): { slide: PPTSlide; warnings: Warnings } {
  const warnings = new Warnings();
  const block = (raw[kind] ?? {}) as { class?: string; t?: string };
  const { tokens, warnings: classWarn } = resolveClasses(block.class, where);
  warnings.merge(classWarn);
  warnings.add(
    "stub-macro",
    `Slide macro "${kind}" is not yet fully implemented; rendered as a placeholder.`,
    where
  );

  const bg = backgroundFill(tokens, theme, warnings, where);
  const elements: (ShapeElement | TextElement)[] = [backgroundRect(bg, size)];

  const area = contentArea(size, theme, tokens);
  const title = block.t ?? `${kind} (coming soon)`;
  const { title: titleBox, rest } = reserveTitle(area, 0.9, theme.spacing.md);
  elements.push(titleElement(title, titleBox, theme, bg, warnings, where));

  // Placeholder panel.
  elements.push({
    id: uid("stubpanel"),
    type: "shape",
    shape: "roundRect",
    box: rest,
    style: {
      fill: { type: "solid", color: theme.colors.surfaceMuted },
      stroke: { color: theme.colors.border, width: 1, dash: "dash" },
      radius: theme.radius.lg,
    },
  });
  const msg = `"${kind}" macro is stubbed for the MVP. See roadmap.`;
  const base = { ...theme.typography.body, color: theme.colors.textMuted, align: "center" as const };
  const fit = fitText(msg, { boxW: rest.w, boxH: rest.h, padding: 0.1, base, minFontSize: 10 }, warnings, where);
  elements.push({
    id: uid("stubtext"),
    type: "text",
    box: rest,
    text: fit.text,
    style: { ...fit.style, vAlign: "middle" },
    padding: 0.1,
  });

  return { slide: { id, background: bg, elements, notes: undefined }, warnings };
}
