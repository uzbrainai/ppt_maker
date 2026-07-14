/**
 * Research agent — grounds the deck in up-to-date facts.
 *
 * Runs a web search (OpenAI's search-enabled model) over the topic and returns
 * a concise factual brief (current figures with dates) plus the cited sources.
 * The content agent is then told to PREFER these real numbers over invented
 * ones, so a generated deck reflects reality rather than plausible filler.
 */

import { webSearch, chat, type Source } from "./openai.js";
import { tavilySearch, tavilyEnabled } from "./tavily.js";
import { fallbackSearch } from "./webSearchFallback.js";
import type { DeckPrefs } from "./contentAgent.js";

export interface ResearchResult {
  /** a bulleted brief of current facts/figures (English) */
  digest: string;
  sources: Source[];
}

// Search APIs (Tavily) cap query length at 400 chars; stay safely under it.
const QUERY_LIMIT = 380;

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Trim a query to QUERY_LIMIT at a word boundary. */
function clampWords(s: string, max = QUERY_LIMIT): string {
  const c = clean(s);
  if (c.length <= max) return c;
  const cut = c.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max / 2 ? cut.slice(0, sp) : cut).trim();
}

/**
 * Build the web-search query. Short topics already make a fine, in-limit query,
 * so we use them directly. A long/verbose topic is distilled by the model into a
 * compact keyword query (the naive "topic — …" string would exceed the API limit
 * and get rejected). Any failure falls back to a word-boundary trim.
 */
async function buildQuery(prefs: DeckPrefs, onProgress?: (m: string) => void): Promise<string> {
  const year = new Date().getFullYear();
  const composed = `${prefs.topic} — key statistics, figures, players and recent facts ${year}`;
  if (composed.length <= QUERY_LIMIT) return composed;

  try {
    const reply = await chat({
      system:
        "You turn a presentation topic into ONE concise web-search query for a research API. " +
        "Reply with ONLY the query — the core subject plus a few high-signal keywords " +
        "(statistics, market, trends) and the year. No quotes, no lists, no explanation. " +
        "Keep it well under 300 characters.",
      user: `Topic:\n${prefs.topic}\n\nYear: ${year}`,
      temperature: 0.2,
      maxTokens: 80,
      timeoutMs: 8000,
    });
    const q = clean(reply).replace(/^["']|["']$/g, "");
    if (q) return clampWords(q);
  } catch (e) {
    onProgress?.(`Query distiller failed (${e instanceof Error ? e.message : String(e)}) — trimming the topic.`);
  }
  return clampWords(composed);
}

// Provider chain: Tavily (primary) → OpenAI web search → DuckDuckGo (keyless).
// Each is capped so a slow provider can't dominate the run. Override via env.
const TAVILY_TIMEOUT_MS = Number(process.env.TAVILY_TIMEOUT_MS ?? 15000);
const OPENAI_SEARCH_TIMEOUT_MS = Number(process.env.RESEARCH_PRIMARY_TIMEOUT_MS ?? 12000);

export async function researchTopic(prefs: DeckPrefs, onProgress?: (m: string) => void): Promise<ResearchResult> {
  const language = prefs.language ?? "en";
  const user = `Research this presentation topic IN DEPTH: "${prefs.topic}".

Gather a RICH, current, well-sourced briefing a presentation writer can build a whole deck from.
Cover, with concrete figures AND context:
- key statistics & metrics (size, growth %, adoption, share, counts) — each with its figure and year
- the main players / entities / segments by NAME (e.g. leading companies, products, categories)
  with a distinguishing fact or number for each
- recent milestones / a short timeline (years + what happened)
- notable comparisons, rankings, or before/after numbers
- 2–3 authoritative datasets usable in charts (category → value), with the values
- drivers, risks, and what's changing now (the "why", not just the "what")

Return ONLY a bulleted brief — no preamble, no closing. 14–22 substantive bullets. Each bullet is a
specific, self-contained fact with its number/year and a short piece of context, e.g.:
- 2025: <entity/metric> = <value> — <one-line why it matters>
Prefer the latest available year. Be specific and name names. Write in English (it will be
translated into ${language} when the deck is authored).`;

  const query = await buildQuery(prefs, onProgress);
  const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

  // 1) Primary: Tavily (purpose-built for LLM grounding).
  if (tavilyEnabled()) {
    try {
      const t = await tavilySearch(query, { maxResults: 5, timeoutMs: TAVILY_TIMEOUT_MS });
      if (t.sources.length > 0 || t.digest) return t;
      onProgress?.("Tavily returned no results — falling back to OpenAI search…");
    } catch (e) {
      onProgress?.(`Tavily failed (${errMsg(e)}) — falling back to OpenAI search…`);
    }
  }

  // 2) Fallback: OpenAI search-enabled model, capped so it can't dominate the run.
  try {
    const r = await webSearch({ user, timeoutMs: OPENAI_SEARCH_TIMEOUT_MS });
    if (r.sources.length > 0) return { digest: r.content.trim(), sources: r.sources };
    onProgress?.("OpenAI search returned no sources — trying DuckDuckGo…");
  } catch (e) {
    onProgress?.(`OpenAI search failed (${errMsg(e)}) — trying DuckDuckGo…`);
  }

  // 3) Last resort: keyless DuckDuckGo (snippet-based brief).
  const fb = await fallbackSearch(query, 8);
  return { digest: fb.digest, sources: fb.sources };
}
