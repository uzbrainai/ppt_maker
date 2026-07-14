/**
 * Image generation (OpenAI images API, e.g. gpt-image-2). Returns PNG bytes,
 * with on-disk caching by prompt hash so reruns are free. Used directly by the
 * premium orchestrator (in-process fallback) and by the imagesvc microservice.
 */

import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { requireEnv } from "./env.js";
import { logApiCall, estimateCostMicros } from "../db/apiUsage.js";
import { currentUserId } from "./usageContext.js";

export type ImageQuality = "low" | "medium" | "high" | "auto";
export type ImageSize = "1024x1024" | "1536x1024" | "1024x1536" | "auto";

export interface GenImageOptions {
  prompt: string;
  size?: ImageSize;
  quality?: ImageQuality;
  model?: string;
  timeoutMs?: number;
  /** cache dir (defaults to $IMAGE_CACHE_DIR or .imgcache) */
  cacheDir?: string;
}

export interface GenImageResult {
  data: Buffer;
  cached: boolean;
}

const ENDPOINT = "https://api.openai.com/v1/images/generations";

/** A photographic, text-free style suffix for visual cohesion across a deck. */
const STYLE_SUFFIX =
  "Professional editorial photograph, natural soft lighting, shallow depth of field, " +
  "realistic, high detail, clean composition. No text, no words, no captions, no watermark, " +
  "no logos, no charts or graphs, no UI.";

export function defaultImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
}

/** Compose a final photographic prompt from a subject line. */
export function buildImagePrompt(subject: string): string {
  return `${subject.trim().replace(/\s+/g, " ")}. ${STYLE_SUFFIX}`;
}

function keyFor(model: string, size: string, quality: string, prompt: string): string {
  return createHash("sha1").update(`${model}|${size}|${quality}|${prompt}`).digest("hex");
}

/**
 * Generate (or load from cache) a single image. Returns PNG bytes. Throws on a
 * non-cached API failure (callers decide whether to degrade gracefully).
 */
export async function generateImage(opts: GenImageOptions): Promise<GenImageResult> {
  const model = opts.model ?? defaultImageModel();
  const size = opts.size ?? "1024x1024";
  const quality = opts.quality ?? "medium";
  const dir = opts.cacheDir ?? process.env.IMAGE_CACHE_DIR ?? ".imgcache";
  const cachePath = join(dir, `${keyFor(model, size, quality, opts.prompt)}.png`);

  if (existsSync(cachePath)) {
    return { data: readFileSync(cachePath), cached: true };
  }

  const apiKey = requireEnv("OPENAI_API_KEY");
  const timeoutMs = opts.timeoutMs ?? 180_000; // image gen is slow (~60s)
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  const userId = currentUserId();
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt: opts.prompt, size, quality, n: 1 }),
      signal: ctrl.signal,
    });
  } catch (e) {
    const msg = (e as Error).name === "AbortError"
      ? `Image generation timed out after ${Math.round(timeoutMs / 1000)}s (model "${model}").`
      : `Image generation failed: ${(e as Error).message}`;
    void logApiCall({ provider: "openai_image", endpoint: "images/generations", model, userId, latencyMs: Date.now() - t0, status: "error", error: msg });
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    void logApiCall({ provider: "openai_image", endpoint: "images/generations", model, userId, latencyMs: Date.now() - t0, status: "error", error: `${res.status}: ${t.slice(0, 300)}` });
    throw new Error(`Image API ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }>; usage?: { total_tokens?: number } };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    void logApiCall({ provider: "openai_image", endpoint: "images/generations", model, userId, latencyMs: Date.now() - t0, status: "error", error: "no image data" });
    throw new Error("Image API returned no image data.");
  }
  if (json.usage) console.error(`SLIDEWIND_IMG_USAGE model=${model} size=${size} quality=${quality} total_tokens=${json.usage.total_tokens ?? 0}`);
  void logApiCall({
    provider: "openai_image",
    endpoint: "images/generations",
    model,
    userId,
    totalTokens: json.usage?.total_tokens ?? 0,
    costUsdMicros: estimateCostMicros({ provider: "openai_image", model }),
    latencyMs: Date.now() - t0,
    status: "ok",
  });
  const data = Buffer.from(b64, "base64");

  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(cachePath, data);
  } catch {
    /* cache is best-effort */
  }
  return { data, cached: false };
}
