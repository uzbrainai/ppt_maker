/**
 * Orchestrator: user preferences → content agent → design agent → validated
 * DeckSpec → PPTScene. The design agent's output is validated against our zod
 * schema; if any slide is malformed it gets one repair round before compiling.
 *
 *   preferences (topic, theme, mode)
 *        │  contentAgent (GPT-4)          → structured content for N pages
 *        ▼
 *   designAgent (GPT-4)                   → slides JSON (macro choice + order)
 *        │  validate (zod) → repair once if needed
 *        ▼
 *   DeckSpec → expandDeck → PPTScene → (caller compiles to .pptx)
 */

import { stringify as yamlStringify } from "yaml";
import { parseDeckSpec } from "../dsl/parseDeckSpec.js";
import { expandDeck } from "../macros/expandDeck.js";
import { validateScene } from "../validation/validateScene.js";
import { Warnings } from "../validation/warnings.js";
import type { DeckSpec, PPTScene } from "../core/types.js";
import { slideKind } from "../dsl/normalize.js";
import { loadEnv } from "./env.js";
import { generateContent, type ContentPlan, type DeckPrefs } from "./contentAgent.js";
import { designDeck, repairDeck } from "./designAgent.js";
import { planStoryboard, contentTypeKey } from "./storyboard.js";
import { researchTopic, type ResearchResult } from "./research.js";
import { illustrateDeck } from "./artDirector.js";
import type { Source } from "./openai.js";

export interface GenerateResult {
  content: ContentPlan;
  deck: DeckSpec;
  scene: PPTScene;
  warnings: Warnings;
  /** the resolved DeckSpec as YAML (handy to save / inspect / edit) */
  yaml: string;
  /** web sources used to ground the content (empty if research was off) */
  sources: Source[];
}

export interface GenerateOptions {
  /** path to a .env providing OPENAI_API_KEY (defaults to known locations) */
  envPath?: string;
  /** called with progress messages */
  onProgress?: (msg: string) => void;
}

function secs(since: number): string {
  return ((Date.now() - since) / 1000).toFixed(1);
}

const CLOSINGS: Record<string, { t: string; s: string }> = {
  uz: { t: "E'tiboringiz uchun rahmat!", s: "Savollar va javoblar (Q&A)" },
  en: { t: "Thank you!", s: "Questions & Answers (Q&A)" },
  ru: { t: "Спасибо за внимание!", s: "Вопросы и ответы (Q&A)" },
};

/** Force the final section slide to a proper, localized closing. */
function applyClosing(slides: DeckSpec["slides"], language: string): void {
  const last = slides[slides.length - 1] as { section?: { t?: string; s?: string; n?: string } } | undefined;
  if (last && last.section) {
    const c = CLOSINGS[language.toLowerCase().slice(0, 2)] ?? CLOSINGS.en;
    last.section.t = c.t;
    last.section.s = c.s;
    delete last.section.n; // a thank-you slide shouldn't show a section number
  }
}

/** Content-type key of a raw slide object (chart variants are distinct). */
function slideTypeKey(slide: unknown): string {
  const kind = slideKind(slide as Record<string, unknown>);
  if (kind === "chart") {
    const t = (slide as { chart?: { type?: string } }).chart?.type;
    return t ? `chart:${t}` : "chart";
  }
  return kind;
}

const STRUCTURAL = new Set(["title", "section", "summary", "unknown"]);

/** Detect avoidable repeats of a content slide type (variety rule). */
function varietyProblem(slides: unknown[]): string | undefined {
  const seen = new Map<string, number>();
  for (const s of slides) {
    const k = slideTypeKey(s);
    if (STRUCTURAL.has(k)) continue;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const distinctContent = seen.size;
  const repeats = [...seen.entries()].filter(([, n]) => n > 1);
  // A repeat is only "avoidable" if we haven't used many distinct types yet.
  if (repeats.length > 0 && distinctContent < 12) {
    return `Avoidable repeated slide types: ${repeats.map(([k, n]) => `${k}×${n}`).join(", ")}. ` +
      `Replace duplicates with an UNUSED type (cards, kpi, gauge, wf, chart:donut, bullets, cmp, chart:bar, chart:barh, timeline, chart:area, table, pyramid, roadmap, problem, stat, criteria, highlight, spine, columns, radial, funnel) so no content type repeats.`;
  }
  return undefined;
}

function deckObject(slides: unknown[], prefs: DeckPrefs): Record<string, unknown> {
  return {
    format: "deckspec/0.1",
    theme: prefs.theme,
    appearance: prefs.appearance,
    size: prefs.size ?? "wide",
    slides,
  };
}

function validate(slides: unknown[], prefs: DeckPrefs): { deck: DeckSpec; warnings: Warnings; dropped: number } {
  const res = parseDeckSpec(JSON.stringify(deckObject(slides, prefs)));
  return { deck: res.deck, warnings: res.warnings, dropped: slides.length - res.deck.slides.length };
}

export async function generateDeck(prefs: DeckPrefs, opts: GenerateOptions = {}): Promise<GenerateResult> {
  const log = opts.onProgress ?? (() => {});
  const loaded = loadEnv(opts.envPath);
  log(loaded ? `Loaded env from ${loaded}` : "Using existing environment for OPENAI_API_KEY");

  // 0. Plan the storyboard so the deck is varied by construction.
  const storyboard = planStoryboard(prefs.pages ?? 10);
  const plannedKeys = storyboard.filter((s) => !STRUCTURAL.has(s.type)).map(contentTypeKey);
  log(`Storyboard: ${storyboard.map((s) => (s.type === "chart" ? `chart:${s.chart}` : s.type)).join(" → ")}`);

  // 0.5 Research: ground the content in current, real facts (default on).
  let research: ResearchResult | undefined;
  if (prefs.research !== false) {
    const tr = Date.now();
    log("Research: searching the web for up-to-date facts…");
    try {
      research = await researchTopic(prefs, log);
      log(`Research done in ${secs(tr)}s: ${research.sources.length} source(s)`);
    } catch (e) {
      log(`Research skipped after ${secs(tr)}s (${e instanceof Error ? e.message : String(e)}); continuing without grounding.`);
      research = undefined;
    }
  }

  const t0 = Date.now();
  log("Content agent: generating rich content…");
  const content = await generateContent(prefs, storyboard, research);
  log(`Content agent done in ${secs(t0)}s: ${content.sections.length} sections — "${content.deckTitle}"`);

  const t1 = Date.now();
  log("Design agent: filling the storyboard…");
  let slides = await designDeck(content, prefs, storyboard);
  log(`Design agent done in ${secs(t1)}s: ${slides.length} slides`);
  let v = validate(slides, prefs);

  // Repair on schema problems, variety violations, OR many over-budget texts.
  const structural = v.warnings.all().filter((w) => w.code === "schema" || w.code === "unknown-slide-macro");
  const overBudget = v.warnings.all().filter((w) => w.code === "text-overflow-risk" && /exceeds the/.test(w.message));
  const variety = varietyProblem(v.deck.slides);
  if (v.dropped > 0 || structural.length > 0 || variety || overBudget.length > 2) {
    log(`Design agent: repairing (${v.dropped} dropped, ${structural.length} invalid, ${overBudget.length} over-budget${variety ? ", variety" : ""})…`);
    const problems = [
      v.dropped > 0 ? `${v.dropped} slide(s) were dropped by the validator.` : "",
      variety ?? "",
      overBudget.length > 2
        ? `Several texts exceed their character budgets — REWRITE them shorter (keep the meaning, just tighter). Offending fields:`
        : "",
      ...v.warnings.all().filter((w) => w.code !== "text-overflow-risk" || /exceeds the/.test(w.message)).map((w) => `- [${w.code}] ${w.where ?? ""} ${w.message}`),
      `For reference, the intended varied plan was:\n${plannedKeys.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");
    slides = await repairDeck(slides, problems, prefs);
    v = validate(slides, prefs);
  }

  // Deterministic, localized closing — never a bare "Rahmat".
  applyClosing(v.deck.slides, content.language);

  // Attach the researched sources as speaker notes on the title slide, and put
  // the per-page source link in each content slide's footer.
  const sources = research?.sources ?? [];
  if (sources.length) {
    const first = v.deck.slides[0] as { title?: { notes?: string } } | undefined;
    if (first?.title) {
      const list = sources.map((s) => `- ${s.title} — ${s.url}`).join("\n");
      first.title.notes = `${first.title.notes ? first.title.notes + "\n\n" : ""}Sources (researched ${new Date().toISOString().slice(0, 10)}):\n${list}`;
    }

    // Per-page source: content sections align with content slides in order. Use
    // the section's chosen URL when it's a real (researched) one; else cycle.
    const srcUrls = new Set(sources.map((s) => s.url));
    const structural = new Set(["title", "section", "summary"]);
    let ci = 0;
    for (const slide of v.deck.slides) {
      const kind = slideKind(slide as Record<string, unknown>);
      if (structural.has(kind)) continue;
      const sec = content.sections[ci];
      const chosen = sec?.source && srcUrls.has(sec.source) ? sec.source : sources[ci % sources.length].url;
      (slide as Record<string, { source?: string }>)[kind].source = chosen;
      ci++;
    }
  }

  // Premium: generate photographic images for ~imagePct of slides (may convert
  // some content slides to `showcase`). Attaches bytes in-memory before compile.
  if (prefs.premium) {
    const ti = Date.now();
    try {
      const n = await illustrateDeck(v.deck, { topic: prefs.topic, imagePct: prefs.imagePct, quality: prefs.imageQuality, onProgress: log });
      log(`Premium: ${n} image(s) attached in ${secs(ti)}s`);
    } catch (e) {
      log(`Premium image step failed (${e instanceof Error ? e.message : String(e)}); continuing without images.`);
    }
  }

  log(`Expanding ${v.deck.slides.length} slides → scene…`);
  const { scene, warnings: expandWarn } = expandDeck(v.deck);
  v.warnings.merge(expandWarn);
  v.warnings.merge(validateScene(scene));

  // Strip image bytes from the deck before serializing YAML (Buffers don't
  // belong in YAML; the scene already embedded them). Keep prompt/alt.
  stripImageData(v.deck);
  const yaml = yamlStringify(v.deck);
  return { content, deck: v.deck, scene, warnings: v.warnings, yaml, sources };
}

/** Remove Buffer image data from a deck (so YAML stays clean). */
function stripImageData(deck: DeckSpec): void {
  for (const slide of deck.slides) {
    for (const block of Object.values(slide as Record<string, { image?: { data?: unknown } }>)) {
      if (block && typeof block === "object" && block.image && "data" in block.image) {
        delete block.image.data;
      }
    }
  }
}
