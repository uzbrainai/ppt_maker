/**
 * Content agent — generates the substance of the deck for N pages.
 *
 * It does NOT pick slide types or layout; it produces structured content
 * (sections with points, and — where natural — numbers, comparisons, timeline
 * data) that the design agent later maps onto slide macros.
 */

import { chat, parseJson } from "./openai.js";
import { type StoryStep, storyboardText } from "./storyboard.js";
import type { ResearchResult } from "./research.js";

export interface DeckPrefs {
  topic: string;
  pages?: number;
  theme?: string;
  appearance?: "light" | "dark";
  size?: "wide" | "standard";
  /** language for the generated content, e.g. "uz", "en" */
  language?: string;
  model?: string;
  /** ground content in a live web-search brief (default on); false to disable */
  research?: boolean;
  /** premium: generate photographic images for ~imagePct of slides */
  premium?: boolean;
  /** percent of slides to illustrate (default 40) */
  imagePct?: number;
  /** image quality (default "medium"; "high" is costly) */
  imageQuality?: "low" | "medium" | "high" | "auto";
}

export interface ContentSection {
  heading: string;
  summary?: string;
  /** the exact source URL (from the researched list) backing this section */
  source?: string;
  points?: string[];
  /** suggested role to help the designer (overview/process/comparison/timeline/stats/detail) */
  kind?: string;
  metrics?: Array<{ value: string; label: string }>;
  comparison?: { left: { title: string; points: string[] }; right: { title: string; points: string[] } };
  timeline?: Array<{ node: string; title: string; body?: string }>;
  data?: { kind: "bar" | "donut" | "line" | "area"; unit?: string; categories?: string[]; items?: Array<{ label: string; value: number }>; series?: Array<{ name: string; data: number[] }> };
}

export interface ContentPlan {
  deckTitle: string;
  subtitle?: string;
  language: string;
  sections: ContentSection[];
}

const SYSTEM = `You are a domain expert and senior presentation content strategist. You produce
DEEP, specific, non-generic content — real mechanisms, concrete examples, named techniques, and
realistic figures — not vague filler. Every section is substantive enough to fill a rich slide.
You write in the requested language. You tailor each section's content to the slide TYPE it will
become (a stats slide needs numbers; a comparison needs two sides; a timeline needs phases; a
process needs ordered steps; a chart needs a real dataset). Respond with STRICT JSON only.`;

/**
 * Generate rich content tailored to a planned storyboard. Each content section
 * maps to a planned content slide, so the substance matches the slide type.
 */
export async function generateContent(prefs: DeckPrefs, storyboard?: StoryStep[], research?: ResearchResult): Promise<ContentPlan> {
  const pages = prefs.pages ?? 10;
  const language = prefs.language ?? "en";
  const sections = Math.max(3, pages - 3);

  const plan = storyboard
    ? `The deck will use these slide types in order — generate one content section per CONTENT slide
(skip title/section/summary, those are added automatically). Match each section's substance to its type:
${storyboardText(storyboard.filter((s) => !["title", "section", "summary"].includes(s.type)))}`
    : `Produce about ${sections} content sections (intro → core areas → process/comparison → outlook).`;

  const srcList = research?.sources?.length
    ? research.sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join("\n")
    : "";
  const grounding = research && research.digest
    ? `\nRESEARCH BRIEF — current facts researched from the web just now. Use this as the FACTUAL
BACKBONE of the deck:
- Anchor every metric, chart value, timeline date and named entity in these facts (translate into
  ${language}); never invent numbers that contradict them.
- But do NOT just restate the facts. For each point, ADD depth from your own domain expertise:
  the mechanism behind a number, a concrete named example, an implication or risk. Combine the
  researched facts WITH rich explanation so each slide is substantive, not a bare stat dump.
- Spread the facts across the deck so different slides use different figures/entities.
- If a needed figure isn't in the brief, keep it realistic and clearly plausible.
${research.digest}\n${srcList ? `\nAVAILABLE SOURCES (cite these — copy a URL VERBATIM):\n${srcList}\n` : ""}`
    : "";

  const user = `Topic: ${prefs.topic}
Language: ${language} — write ALL text in this language.
${grounding}
${plan}

For EACH section provide (be rich and specific — this is the main ask):
- "heading": a precise section title
- "summary": one informative sentence (not a restatement of the heading)
${srcList ? `- "source": the exact source URL (copied VERBATIM from AVAILABLE SOURCES) that best backs this section's facts/figures` : ""}
- "points": 4–6 SUBSTANTIVE points. Each point is concrete (a real capability, method, example,
  benefit or risk) — not a vague phrase. Aim for depth, not filler.
- "kind": overview | process | comparison | timeline | stats | detail
- Include the structured data that fits this section's slide type:
  - stats/kpi  → "metrics": 4 {value,label} with realistic figures (e.g. "+38%", "2.4x", "92%")
  - process    → reflect ordered steps inside "points" (each a step with what happens)
  - comparison → "comparison": { left:{title,points[3-4]}, right:{title,points[3-4]} }
  - timeline   → "timeline": [{node:"<year/number ≤6 chars>", title, body}] (4–6 phases)
  - chart      → "data": {kind:"bar|donut|line|area", unit, categories?, items?[{label,value}],
                 series?[{name,data[]}]} with plausible, varied numbers
Where a chart is implied (proportions → donut, magnitudes → bar, trend over years → area), ALWAYS
include a real "data" object so the chart isn't empty.

Coherent narrative, no repetition between sections. Depth over breadth.
Return STRICT JSON: { "deckTitle": "...", "subtitle": "...", "language": "${language}", "sections": [ ... ] }`;

  const reply = await chat({ system: SYSTEM, user, json: true, model: prefs.model, temperature: 0.65, maxTokens: 4800 });
  const result = parseJson<ContentPlan>(reply);
  if (!result.sections || !Array.isArray(result.sections) || result.sections.length === 0) {
    throw new Error("Content agent returned no sections.");
  }
  result.language = result.language || language;
  return result;
}
