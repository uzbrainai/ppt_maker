/**
 * Free / keyless web-search fallback for the research step.
 *
 * The primary grounding path is OpenAI's search-enabled model (see research.ts),
 * but it's slow and occasionally returns nothing. When it does, we fall back to:
 *   1. Brave Search API   — if BRAVE_API_KEY is set (free tier available)
 *   2. DuckDuckGo (HTML)  — no API key required
 * and assemble a short factual brief from the result snippets (no extra LLM call).
 */

import type { Source } from "./openai.js";

export interface FallbackResult {
  digest: string;
  sources: Source[];
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

function toBrief(items: Array<{ title: string; url: string; snippet: string }>): FallbackResult {
  const sources: Source[] = [];
  const bullets: string[] = [];
  for (const it of items) {
    if (!it.url) continue;
    sources.push({ title: it.title || it.url, url: it.url });
    if (it.snippet) bullets.push(`- ${it.title ? it.title + ": " : ""}${it.snippet}`);
  }
  return { digest: bullets.join("\n"), sources };
}

// ── Brave ──────────────────────────────────────────────────────────────────
async function braveSearch(query: string, limit: number): Promise<FallbackResult | null> {
  const key = process.env.BRAVE_API_KEY;
  if (!key) return null;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`;
  const res = await fetchWithTimeout(url, { headers: { Accept: "application/json", "X-Subscription-Token": key } }, 8000);
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const data = (await res.json()) as { web?: { results?: Array<{ title?: string; url?: string; description?: string }> } };
  const items = (data.web?.results ?? []).slice(0, limit).map((r) => ({
    title: stripTags(r.title || ""),
    url: r.url || "",
    snippet: stripTags(r.description || ""),
  }));
  return toBrief(items);
}

// ── DuckDuckGo (HTML endpoint, no key) ──────────────────────────────────────
function decodeDuckHref(href: string): string {
  let h = href;
  if (h.startsWith("//")) h = "https:" + h;
  try {
    const u = new URL(h);
    const uddg = u.searchParams.get("uddg"); // DDG wraps the real URL here
    if (uddg) return uddg;
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    /* ignore */
  }
  return "";
}

function parseDuck(html: string, limit: number): FallbackResult {
  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snipRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const links: Array<{ url: string; title: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && links.length < limit) {
    const url = decodeDuckHref(m[1]);
    const title = stripTags(m[2]);
    if (url) links.push({ url, title: title || url });
  }
  const snippets: string[] = [];
  let s: RegExpExecArray | null;
  while ((s = snipRe.exec(html)) && snippets.length < limit) snippets.push(stripTags(s[1]));
  return toBrief(links.map((l, i) => ({ title: l.title, url: l.url, snippet: snippets[i] ?? "" })));
}

async function duckSearch(query: string, limit: number): Promise<FallbackResult> {
  // html.duckduckgo.com returns plain server-rendered results; lite is a backup.
  for (const base of ["https://html.duckduckgo.com/html/", "https://lite.duckduckgo.com/lite/"]) {
    try {
      const res = await fetchWithTimeout(`${base}?q=${encodeURIComponent(query)}`, { headers: { "User-Agent": UA, Accept: "text/html" } }, 8000);
      if (!res.ok) continue;
      const out = parseDuck(await res.text(), limit);
      if (out.sources.length) return out;
    } catch {
      /* try next */
    }
  }
  return { digest: "", sources: [] };
}

/** Search via Brave (if configured) then DuckDuckGo. Never throws; may be empty. */
export async function fallbackSearch(query: string, limit = 8): Promise<FallbackResult> {
  try {
    const b = await braveSearch(query, limit);
    if (b && b.sources.length) return b;
  } catch {
    /* fall through to DuckDuckGo */
  }
  return duckSearch(query, limit);
}
