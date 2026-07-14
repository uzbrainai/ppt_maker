/**
 * Tavily search — the primary research provider.
 *
 * Tavily is a search API built for LLM grounding: it returns ranked results with
 * extracted content plus an optional synthesized `answer`, which makes an ideal
 * factual brief for the content agent. Set TAVILY_API_KEY to enable it; research
 * falls back to OpenAI web search (then DuckDuckGo) when it's unset or fails.
 */

import type { Source } from "./openai.js";
import { logApiCall, estimateCostMicros } from "../db/apiUsage.js";
import { currentUserId } from "./usageContext.js";

export interface TavilyResult {
  digest: string;
  sources: Source[];
}

export function tavilyEnabled(): boolean {
  return !!process.env.TAVILY_API_KEY;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Tavily rejects queries longer than 400 characters with an HTTP 400. A long user
// topic can push our composed query over that limit, so clamp defensively and cut
// at a word boundary to keep the query readable.
const MAX_QUERY_LEN = 400;
function clampQuery(query: string): string {
  const s = clean(query);
  if (s.length <= MAX_QUERY_LEN) return s;
  const cut = s.slice(0, MAX_QUERY_LEN);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > MAX_QUERY_LEN / 2 ? cut.slice(0, lastSpace) : cut).trim();
}

export async function tavilySearch(query: string, opts: { maxResults?: number; timeoutMs?: number } = {}): Promise<TavilyResult> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY not set");

  // Cost controls: one BASIC search (1 credit, vs 2 for "advanced") with a small
  // result cap and a basic answer — keeps the per-deck research spend low.
  const depth = process.env.TAVILY_SEARCH_DEPTH ?? "basic";
  const maxResults = opts.maxResults ?? Number(process.env.TAVILY_MAX_RESULTS ?? 5);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 15000);
  const t0 = Date.now();
  const userId = currentUserId();
  let res: Response;
  try {
    res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        query: clampQuery(query),
        search_depth: depth,
        topic: "general",
        max_results: maxResults,
        include_answer: "basic",
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    const msg = (e as Error).name === "AbortError"
      ? `Tavily timed out after ${Math.round((opts.timeoutMs ?? 15000) / 1000)}s`
      : `Tavily request failed: ${(e as Error).message}`;
    void logApiCall({ provider: "tavily", endpoint: `search:${depth}`, userId, latencyMs: Date.now() - t0, status: "error", error: msg });
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    void logApiCall({ provider: "tavily", endpoint: `search:${depth}`, userId, latencyMs: Date.now() - t0, status: "error", error: `${res.status}: ${body.slice(0, 200)}` });
    throw new Error(`Tavily ${res.status}: ${body.slice(0, 200)}`);
  }
  void logApiCall({
    provider: "tavily",
    endpoint: `search:${depth}`,
    userId,
    costUsdMicros: estimateCostMicros({ provider: "tavily" }),
    latencyMs: Date.now() - t0,
    status: "ok",
  });

  const data = (await res.json()) as {
    answer?: string;
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  const results = data.results ?? [];
  const sources: Source[] = [];
  const bullets: string[] = [];
  for (const r of results) {
    if (!r.url) continue;
    sources.push({ title: clean(r.title || r.url), url: r.url });
    // Cap each snippet so the grounding stays concise (keeps the content agent fast).
    if (r.content) bullets.push(`- ${r.title ? clean(r.title) + ": " : ""}${clean(r.content).slice(0, 320)}`);
  }
  const digest = [data.answer ? clean(data.answer) : "", bullets.join("\n")].filter(Boolean).join("\n\n");
  return { digest, sources };
}
