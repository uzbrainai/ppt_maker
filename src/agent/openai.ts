/**
 * Minimal OpenAI Chat Completions client (uses global fetch — Node 18+).
 *
 * No SDK dependency. Returns the assistant message text. `json: true` asks the
 * model for strict JSON and extracts the first JSON object/array from the reply
 * (robust across models that don't support response_format).
 */

import { requireEnv } from "./env.js";
import { logApiCall, estimateCostMicros } from "../db/apiUsage.js";
import { currentUserId } from "./usageContext.js";

export interface ChatOptions {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  /** request + extract JSON */
  json?: boolean;
  maxTokens?: number;
  /** abort the request after this many ms (default 90000) */
  timeoutMs?: number;
}

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

/** Default model: fast gpt-4-class model unless overridden via env/opts. */
export function defaultModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

/** Default web-search-enabled model. */
export function defaultSearchModel(): string {
  return process.env.OPENAI_SEARCH_MODEL || "gpt-4o-search-preview";
}

export interface Source {
  title: string;
  url: string;
}
export interface SearchResult {
  content: string;
  sources: Source[];
}

/**
 * Web search via OpenAI's search-enabled model. Returns the model's grounded
 * answer plus the deduped source URLs it cited. (Search-preview models don't
 * accept temperature/response_format, so this is plain text only.)
 */
export async function webSearch(opts: { user: string; system?: string; model?: string; timeoutMs?: number }): Promise<SearchResult> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = opts.model ?? defaultSearchModel();
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const body = {
    model,
    web_search_options: {},
    messages: [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content: opts.user },
    ],
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  const userId = currentUserId();
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    const msg = (e as Error).name === "AbortError"
      ? `OpenAI web search timed out after ${Math.round(timeoutMs / 1000)}s (model "${model}").`
      : `OpenAI web search failed: ${(e as Error).message}`;
    void logApiCall({ provider: "openai_search", endpoint: "chat/completions", model, userId, latencyMs: Date.now() - t0, status: "error", error: msg });
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const errText = truncate(await res.text().catch(() => ""));
    void logApiCall({ provider: "openai_search", endpoint: "chat/completions", model, userId, latencyMs: Date.now() - t0, status: "error", error: `${res.status}: ${errText}` });
    throw new Error(`OpenAI web search ${res.status}: ${errText}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string; annotations?: Array<{ url_citation?: { url?: string; title?: string } }> } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  if (data.usage) console.error(`SLIDEWIND_USAGE model=${model} total=${data.usage.total_tokens ?? 0}`);
  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;
  void logApiCall({
    provider: "openai_search",
    endpoint: "chat/completions",
    model,
    userId,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsdMicros: estimateCostMicros({ provider: "openai_search", model, promptTokens, completionTokens }),
    latencyMs: Date.now() - t0,
    status: "ok",
  });
  const msg = data.choices?.[0]?.message ?? {};
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const a of msg.annotations ?? []) {
    const url = a.url_citation?.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: a.url_citation?.title || url, url });
  }
  return { content: msg.content ?? "", sources };
}

export async function chat(opts: ChatOptions): Promise<string> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = opts.model ?? defaultModel();
  const timeoutMs = opts.timeoutMs ?? 180_000; // base gpt-4 can be slow

  const body: Record<string, unknown> = {
    model,
    temperature: opts.temperature ?? 0.5,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.json) body.response_format = { type: "json_object" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  const userId = currentUserId();
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    // Node's undici surfaces the concrete network reason on `err.cause`
    // (ENOTFOUND / ECONNREFUSED / ECONNRESET / UND_ERR_SOCKET / …). Include it
    // so the user can distinguish DNS/firewall from a real API failure.
    const causeParts = [err.cause?.code, err.cause?.message].filter(Boolean);
    const causeDetail = causeParts.length ? ` (cause: ${causeParts.join(' ')})` : "";
    const msg = err.name === "AbortError"
      ? `OpenAI request timed out after ${Math.round(timeoutMs / 1000)}s (model "${model}"). Try a faster model with --model gpt-4o-mini.`
      : `OpenAI request failed: ${err.message}${causeDetail}`;
    void logApiCall({ provider: "openai_chat", endpoint: "chat/completions", model, userId, latencyMs: Date.now() - t0, status: "error", error: msg });
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (opts.json && /response_format|json_object/i.test(text)) {
      // Not a real failure — retry without response_format. Don't log this as an error.
      return chat({ ...opts, json: false });
    }
    void logApiCall({ provider: "openai_chat", endpoint: "chat/completions", model, userId, latencyMs: Date.now() - t0, status: "error", error: `${res.status}: ${truncate(text)}` });
    throw new Error(`OpenAI ${res.status}: ${truncate(text)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  if (data.usage) {
    const u = data.usage;
    console.error(`SLIDEWIND_USAGE model=${model} prompt=${u.prompt_tokens ?? 0} completion=${u.completion_tokens ?? 0} total=${u.total_tokens ?? 0}`);
  }
  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;
  const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;
  const content = data.choices?.[0]?.message?.content ?? "";
  void logApiCall({
    provider: "openai_chat",
    endpoint: "chat/completions",
    model,
    userId,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsdMicros: estimateCostMicros({ provider: "openai_chat", model, promptTokens, completionTokens }),
    latencyMs: Date.now() - t0,
    status: content ? "ok" : "error",
    error: content ? null : "empty response",
  });
  if (!content) throw new Error("OpenAI returned an empty response.");
  return content;
}

/** Parse JSON from a model reply, tolerating code fences / surrounding prose. */
export function parseJson<T = unknown>(reply: string): T {
  const cleaned = reply.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Extract the outermost { ... } or [ ... ].
    const start = cleaned.search(/[[{]/);
    const lastObj = cleaned.lastIndexOf("}");
    const lastArr = cleaned.lastIndexOf("]");
    const end = Math.max(lastObj, lastArr);
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("Could not parse JSON from model reply.");
  }
}

function truncate(s: string, n = 300): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}
