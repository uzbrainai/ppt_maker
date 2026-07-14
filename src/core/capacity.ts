/**
 * Capacity contract — the strict, documented text budgets for every container.
 *
 * The whole point: an LLM authoring DeckSpec should know *exactly* how much text
 * each slot can hold, so titles/cards/nodes come out "not too long, not too
 * short" and every shape fills beautifully. These budgets are:
 *   1. the source of truth surfaced to LLMs (see README "Capacity contract"),
 *   2. the default line budgets the layout engine fits text to,
 *   3. enforced at expand time — exceeding a budget emits a `text-overflow-risk`
 *      warning (and the text is still safely truncated so it never overflows).
 *
 * `maxChars` is the recommended hard budget; `maxLines` is how many lines the
 * container is shaped for. Keep these in sync with the layout code.
 */

import type { Warnings } from "../validation/warnings.js";

export interface Budget {
  /** recommended maximum characters */
  maxChars: number;
  /** lines the container is shaped for */
  maxLines: number;
  /** human hint shown in docs */
  hint?: string;
}

export const CAPACITY = {
  /** slide heading (cards/kpi/bullets/wf/chart/timeline/cmp titles) */
  slideTitle: { maxChars: 60, maxLines: 2, hint: "one short line, ≤ ~8 words" },

  title: {
    /** cover/title-slide title */
    title: { maxChars: 60, maxLines: 3, hint: "the deck's name / headline" },
    subtitle: { maxChars: 90, maxLines: 2, hint: "one supporting sentence" },
  },

  card: {
    title: { maxChars: 26, maxLines: 2, hint: "2–3 words" },
    body: { maxChars: 80, maxLines: 3, hint: "one short sentence" },
    /** the optional summary block under content-sized cards */
    note: { maxChars: 220, maxLines: 3, hint: "1–2 sentences recap" },
  },

  kpi: {
    value: { maxChars: 6, maxLines: 1, hint: 'a number like "+40%", "2.5x"' },
    label: { maxChars: 48, maxLines: 3, hint: "what the number measures" },
  },

  wf: {
    title: { maxChars: 18, maxLines: 2, hint: "1–2 words" },
    body: { maxChars: 60, maxLines: 3, hint: "short phrase" },
    callout: { maxChars: 120, maxLines: 2 },
  },

  bullets: {
    title: { maxChars: 40, maxLines: 1, hint: "the point, bolded" },
    body: { maxChars: 90, maxLines: 2, hint: "supporting detail" },
    lead: { maxChars: 110, maxLines: 2 },
  },

  cmp: {
    header: { maxChars: 22, maxLines: 1, hint: "option name" },
    subtitle: { maxChars: 36, maxLines: 1 },
    point: { maxChars: 56, maxLines: 2, hint: "short pro/con" },
  },

  timeline: {
    /** the circular node label — keep it tiny (a year or step number) */
    node: { maxChars: 6, maxLines: 1, hint: 'short token: "2025", "3", "Q1"' },
    title: { maxChars: 22, maxLines: 1, hint: "milestone name" },
    body: { maxChars: 70, maxLines: 3, hint: "what happens" },
    callout: { maxChars: 120, maxLines: 2 },
  },

  section: {
    title: { maxChars: 48, maxLines: 2 },
    subtitle: { maxChars: 80, maxLines: 2 },
  },

  summary: {
    title: { maxChars: 28, maxLines: 3 },
    lead: { maxChars: 120, maxLines: 5 },
    itemTitle: { maxChars: 36, maxLines: 1 },
    itemBody: { maxChars: 80, maxLines: 2 },
  },

  chart: {
    insightTitle: { maxChars: 28, maxLines: 1 },
    insightLead: { maxChars: 180, maxLines: 6 },
    insightPoint: { maxChars: 70, maxLines: 2 },
  },

  gauge: {
    value: { maxChars: 6, maxLines: 1, hint: 'a percent like "78%"' },
    title: { maxChars: 26, maxLines: 2 },
    body: { maxChars: 80, maxLines: 3 },
  },

  pyramid: {
    layerTitle: { maxChars: 28, maxLines: 1, hint: "fits inside the pyramid layer" },
    title: { maxChars: 22, maxLines: 1 },
    body: { maxChars: 80, maxLines: 2 },
  },

  table: {
    header: { maxChars: 20, maxLines: 2, hint: "short column name" },
    cell: { maxChars: 40, maxLines: 2, hint: "short cell value" },
    summary: { maxChars: 200, maxLines: 2 },
  },

  agenda: {
    item: { maxChars: 30, maxLines: 1, hint: "a section name (2–4 words)" },
  },

  roadmap: {
    node: { maxChars: 10, maxLines: 1, hint: 'phase label like "PHASE 1"' },
    title: { maxChars: 28, maxLines: 1, hint: "milestone name" },
    body: { maxChars: 90, maxLines: 3, hint: "what happens in this phase" },
    callout: { maxChars: 120, maxLines: 2 },
  },

  problem: {
    title: { maxChars: 40, maxLines: 2, hint: "the problem, stated" },
    body: { maxChars: 160, maxLines: 5, hint: "1–2 sentences of detail" },
  },

  stat: {
    eyebrow: { maxChars: 14, maxLines: 1, hint: "1 short word for the rotated side label" },
    title: { maxChars: 40, maxLines: 2, hint: "what the chart shows" },
    body: { maxChars: 220, maxLines: 6, hint: "the takeaway / caveat" },
  },

  criteria: {
    title: { maxChars: 28, maxLines: 1, hint: "the criterion name" },
    body: { maxChars: 90, maxLines: 3, hint: "one short explanation" },
  },

  highlight: {
    title: { maxChars: 60, maxLines: 4, hint: "the statement headline" },
    body: { maxChars: 260, maxLines: 6, hint: "supporting paragraph" },
    featured: { maxChars: 30, maxLines: 2, hint: "featured card heading" },
    item: { maxChars: 30, maxLines: 1, hint: "a pill label (2–3 words)" },
  },

  spine: {
    title: { maxChars: 28, maxLines: 1, hint: "the item heading" },
    body: { maxChars: 200, maxLines: 5, hint: "the item paragraph" },
  },

  showcase: {
    title: { maxChars: 48, maxLines: 2, hint: "the headline beside the image" },
    lead: { maxChars: 160, maxLines: 3 },
    point: { maxChars: 80, maxLines: 2 },
  },

  columns: {
    title: { maxChars: 28, maxLines: 2, hint: "the column heading" },
    body: { maxChars: 200, maxLines: 7, hint: "the column paragraph" },
  },

  radial: {
    title: { maxChars: 26, maxLines: 1, hint: "the segment label" },
    body: { maxChars: 90, maxLines: 3, hint: "the segment detail" },
    center: { maxChars: 14, maxLines: 2, hint: "ring center label" },
  },

  funnel: {
    title: { maxChars: 26, maxLines: 1, hint: "the stage name" },
    body: { maxChars: 90, maxLines: 2, hint: "the stage detail" },
  },
} as const;

/**
 * Check `text` against a budget; if it's over, emit a warning naming the field
 * and the limit (the engine still truncates so nothing overflows). Returns the
 * budget's `maxLines` for convenient use as the fit line cap.
 */
export function checkBudget(
  text: string | undefined,
  budget: Budget,
  field: string,
  warnings?: Warnings,
  where?: string
): number {
  if (text && text.length > budget.maxChars) {
    warnings?.add(
      "text-overflow-risk",
      `${field}: ${text.length} chars exceeds the ${budget.maxChars}-char budget — shorten it (${budget.hint ?? "keep it concise"}).`,
      where
    );
  }
  return budget.maxLines;
}
