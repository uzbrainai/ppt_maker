/**
 * Storyboard planner — decides the SEQUENCE of slide types up front so the deck
 * is varied by construction: every distinct content type is used once before any
 * type repeats (the user's rule: "never repeat a slide type unless we've run out
 * of new ones"). The design agent then fills this exact plan.
 */

export interface StoryStep {
  /** macro key: title | section | cards | kpi | bullets | wf | cmp | chart | timeline | summary */
  type: string;
  /** chart variant when type === "chart" */
  chart?: "bar" | "barh" | "donut" | "area" | "line";
  /** short instruction shown to the agents */
  note: string;
}

/** Distinct content types, ordered for a good narrative (new layouts surfaced
 *  early so even short decks show variety; charts interleaved). */
const CONTENT_POOL: StoryStep[] = [
  { type: "cards", note: "5–6 key areas/aspects, each with a concrete one-line body; add a summary note" },
  { type: "criteria", note: "4–6 criteria/comparison points, each a short title + one-line explanation" },
  { type: "kpi", note: "4 headline metrics (value + label) — only real, plausible numbers" },
  { type: "spine", note: "3–4 items, each a heading + a paragraph (e.g. solutions, focus areas, themes)" },
  { type: "chart", chart: "donut", note: "a proportional breakdown (parts of a whole) + 3 insight bullets" },
  { type: "highlight", note: "one statement (title + paragraph) + a featured card + 3–4 key item pills" },
  { type: "chart", chart: "bar", note: "a categorical magnitude comparison + an insight paragraph" },
  { type: "stat", note: "2 chart panels (a bar + a line) each with a title and a takeaway sentence" },
  { type: "problem", note: "3 big-number cards: a title + a 1–2 sentence challenge per card" },
  { type: "wf", note: "a 4–6 step process, left→right, with a callout takeaway" },
  { type: "timeline", note: "4–6 phases/milestones (short node label) + a roadmap callout" },
  { type: "roadmap", note: "a 4–6 phase plan (PHASE 1.. + a short description per phase) + a callout" },
  { type: "bullets", note: "5–6 substantive points, each with a supporting sub-sentence" },
  { type: "cmp", note: "a 2-column comparison (good vs bad / before vs after), 3–4 points each" },
  { type: "chart", chart: "area", note: "a trend over time (multi-year series) + insight bullets" },
  { type: "chart", chart: "barh", note: "a ranked horizontal-bar comparison + an insight paragraph" },
  { type: "columns", note: "2–4 parallel aspects, each an icon + heading + a short paragraph (full-height columns)" },
  { type: "radial", note: "3–5 facets of one theme as a ring; each a label + one-line detail, with a center word" },
  { type: "funnel", note: "a 3–5 stage funnel (awareness→action); each stage a name + a short detail" },
  { type: "gauge", note: "3–5 percentage KPIs as ring gauges, each with a title + one-line description" },
  { type: "table", note: "a 3–5 column structured table (incl. some numeric columns) + a bottom summary" },
  { type: "pyramid", note: "a 3–5 level hierarchy (apex→base) with a matching numbered list" },
];

export function planStoryboard(pages: number): StoryStep[] {
  const n = Math.max(6, pages);
  // For longer decks, open with an agenda (table of contents).
  const useAgenda = n >= 8;
  const reserved = 3 + (useAgenda ? 1 : 0); // title + summary + closing (+ agenda)
  const bodyCount = Math.max(3, n - reserved);

  const body: StoryStep[] = [];
  for (let i = 0; i < bodyCount; i++) {
    const base = CONTENT_POOL[i % CONTENT_POOL.length];
    // When we exhaust the pool and must repeat, chapter it with a divider so the
    // repetition reads as a new section rather than a duplicate.
    if (i >= CONTENT_POOL.length && i % CONTENT_POOL.length === 0) {
      body.push({ type: "section", note: "divider introducing the next chapter" });
    }
    body.push({ ...base });
  }

  return [
    { type: "title", note: "deck title + one-line subtitle" },
    ...(useAgenda ? [{ type: "agenda", note: "table of contents: the section names of this deck, in order" } as StoryStep] : []),
    ...body,
    { type: "summary", note: "3–4 key takeaways" },
    { type: "section", note: "closing / thank-you divider" },
  ];
}

/** Render the plan as a numbered instruction list for the LLM. */
export function storyboardText(steps: StoryStep[]): string {
  return steps
    .map((s, i) => {
      const label = s.type === "chart" ? `chart (${s.chart})` : s.type;
      return `${i + 1}. ${label} — ${s.note}`;
    })
    .join("\n");
}

/** The multiset of content types (excludes title/section) for variety checks. */
export function contentTypeKey(s: StoryStep): string {
  return s.type === "chart" ? `chart:${s.chart}` : s.type;
}
