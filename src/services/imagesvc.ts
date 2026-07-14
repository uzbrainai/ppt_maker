/**
 * imagesvc — a small standalone image-generation microservice.
 *
 * Wraps the shared `imageGen` module behind HTTP, with concurrency limiting,
 * retry/backoff, optional shared-token auth, and on-disk caching (so identical
 * prompts are free). Image generation is slow (~60s) and costly, so isolating it
 * here lets the main pipeline fan out requests in parallel and reuse results.
 *
 *   POST /generate { prompt, subject?, size?, quality? } -> { b64, cached, bytes }
 *   GET  /health
 *
 * Env: OPENAI_API_KEY, OPENAI_IMAGE_MODEL, IMAGE_CACHE_DIR, IMAGE_SVC_TOKEN,
 *      IMAGE_SVC_PORT (8082), IMAGE_SVC_CONCURRENCY (3).
 */

import Fastify from "fastify";
import { generateImage, buildImagePrompt, type ImageQuality, type ImageSize } from "../agent/imageGen.js";
import { loadEnv } from "../agent/env.js";

loadEnv();

/** Minimal concurrency limiter (no extra deps). */
function limiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((r) => queue.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw last;
}

const PORT = Number(process.env.IMAGE_SVC_PORT ?? 8082);
const TOKEN = process.env.IMAGE_SVC_TOKEN ?? "";
const run = limiter(Number(process.env.IMAGE_SVC_CONCURRENCY ?? 3));

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2" }));

interface GenBody {
  prompt?: string;
  subject?: string;
  size?: ImageSize;
  quality?: ImageQuality;
}

app.post("/generate", async (req, reply) => {
  if (TOKEN && req.headers["x-api-key"] !== TOKEN) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  const body = (req.body ?? {}) as GenBody;
  // Accept either a ready prompt or a subject we wrap with the photographic style.
  const prompt = body.prompt ?? (body.subject ? buildImagePrompt(body.subject) : "");
  if (!prompt) return reply.code(400).send({ error: "prompt or subject required" });

  try {
    const result = await run(() => withRetry(() => generateImage({ prompt, size: body.size, quality: body.quality })));
    return { b64: result.data.toString("base64"), cached: result.cached, bytes: result.data.length };
  } catch (e) {
    req.log.error(e);
    return reply.code(502).send({ error: e instanceof Error ? e.message : String(e) });
  }
});

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`imagesvc listening on :${PORT}`))
  .catch((e) => {
    app.log.error(e);
    process.exit(1);
  });
