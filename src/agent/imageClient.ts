/**
 * Image client used by premium orchestration: calls the imagesvc microservice
 * over HTTP when IMAGE_SERVICE_URL is set, otherwise generates in-process via
 * the shared imageGen module (so the CLI works standalone).
 */

import { generateImage, type ImageQuality, type ImageSize } from "./imageGen.js";
import { logApiCall, estimateCostMicros } from "../db/apiUsage.js";
import { currentUserId } from "./usageContext.js";

export interface FetchImageOptions {
  prompt: string;
  size?: ImageSize;
  quality?: ImageQuality;
  timeoutMs?: number;
}

export async function fetchImage(opts: FetchImageOptions): Promise<Buffer> {
  const url = process.env.IMAGE_SERVICE_URL;
  if (url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 200_000);
    const t0 = Date.now();
    const userId = currentUserId();
    try {
      let res: Response;
      try {
        res = await fetch(`${url.replace(/\/$/, "")}/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.IMAGE_SVC_TOKEN ? { "x-api-key": process.env.IMAGE_SVC_TOKEN } : {}),
          },
          body: JSON.stringify({ prompt: opts.prompt, size: opts.size, quality: opts.quality }),
          signal: ctrl.signal,
        });
      } catch (e) {
        void logApiCall({ provider: "image_service", endpoint: "/generate", userId, latencyMs: Date.now() - t0, status: "error", error: (e as Error).message });
        throw e;
      }
      if (!res.ok) {
        const errText = (await res.text().catch(() => "")).slice(0, 200);
        void logApiCall({ provider: "image_service", endpoint: "/generate", userId, latencyMs: Date.now() - t0, status: "error", error: `${res.status}: ${errText}` });
        throw new Error(`imagesvc ${res.status}: ${errText}`);
      }
      const j = (await res.json()) as { b64?: string };
      if (!j.b64) {
        void logApiCall({ provider: "image_service", endpoint: "/generate", userId, latencyMs: Date.now() - t0, status: "error", error: "no image" });
        throw new Error("imagesvc returned no image");
      }
      void logApiCall({
        provider: "image_service",
        endpoint: "/generate",
        userId,
        costUsdMicros: estimateCostMicros({ provider: "image_service" }),
        latencyMs: Date.now() - t0,
        status: "ok",
      });
      return Buffer.from(j.b64, "base64");
    } finally {
      clearTimeout(timer);
    }
  }
  const r = await generateImage({ prompt: opts.prompt, size: opts.size, quality: opts.quality, timeoutMs: opts.timeoutMs });
  return r.data;
}
