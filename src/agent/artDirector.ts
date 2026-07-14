/**
 * Art director — the premium step. Decides which slides get AI-generated photos
 * (~imagePct of the deck), writes a photographic subject per slide, fans the
 * requests out (capped concurrency) to the image client, and attaches the bytes.
 *
 * Image homes, in priority order:
 *   - title + section dividers  → full-bleed background (landscape)
 *   - existing showcase / highlight → contained image
 *   - then content slides (cards/bullets) are converted to `showcase` until the
 *     target count is reached.
 * Degrades gracefully: a failed image leaves the slide's placeholder.
 */

import type { DeckSpec } from "../core/types.js";
import { slideKind } from "../dsl/normalize.js";
import { buildImagePrompt, type ImageQuality, type ImageSize } from "./imageGen.js";
import { fetchImage } from "./imageClient.js";

export interface IllustrateOptions {
  topic: string;
  imagePct?: number; // 0..100, default 40
  quality?: ImageQuality; // default medium
  onProgress?: (msg: string) => void;
}

interface ImageTarget {
  /** the image holder object to receive `.data` */
  holder: { prompt?: string; data?: Buffer; alt?: string };
  subject: string;
  size: ImageSize;
}

const FULL_BLEED = new Set(["title", "section"]);
const CONTAINED = new Set(["showcase", "highlight"]);
const CONVERTIBLE = new Set(["cards", "bullets"]);

/** Convert a cards/bullets item into a [title, body] point, preserving detail. */
function itemToPoint(it: unknown): [string, string] {
  if (Array.isArray(it)) {
    return it.length >= 3 ? [it[1] as string, it[2] as string] : [it[0] as string, (it[1] as string) ?? ""];
  }
  if (typeof it === "string") return [it, ""];
  const o = it as { title?: string; t?: string; label?: string; body?: string; s?: string };
  return [o.title ?? o.t ?? o.label ?? "", o.body ?? o.s ?? ""];
}

function subjectFor(kind: string, heading: string, topic: string): string {
  if (FULL_BLEED.has(kind)) return `${topic} — a wide, atmospheric establishing scene`;
  return `${heading || topic}, in the context of ${topic}`;
}

/** Plan + generate images, mutating the deck in place. Returns # of images set. */
export async function illustrateDeck(deck: DeckSpec, opts: IllustrateOptions): Promise<number> {
  const log = opts.onProgress ?? (() => {});
  const pct = Math.max(0, Math.min(100, opts.imagePct ?? 40));
  const quality = opts.quality ?? "medium";
  const slides = deck.slides as Array<Record<string, Record<string, unknown>>>;
  const target = Math.max(1, Math.round((pct / 100) * slides.length));
  const targets: ImageTarget[] = [];
  const used = new Set<number>();

  const addHolder = (block: Record<string, unknown>, kind: string, heading: string) => {
    if (!block.image || typeof block.image !== "object") block.image = {};
    const subject = subjectFor(kind, heading, opts.topic);
    const holder = block.image as ImageTarget["holder"];
    holder.prompt = subject;
    holder.alt = heading || opts.topic;
    targets.push({ holder, subject, size: FULL_BLEED.has(kind) ? "1536x1024" : "1024x1024" });
  };

  // 1) Natural image homes.
  slides.forEach((s, i) => {
    const kind = slideKind(s);
    if (FULL_BLEED.has(kind) || CONTAINED.has(kind)) {
      const block = s[kind];
      addHolder(block, kind, (block.t as string) ?? "");
      used.add(i);
    }
  });

  // 2) Convert content slides to showcase until we hit the target.
  for (let i = 0; i < slides.length && targets.length < target; i++) {
    if (used.has(i)) continue;
    const kind = slideKind(slides[i]);
    if (!CONVERTIBLE.has(kind)) continue;
    const blk = slides[i][kind] as Record<string, unknown>;
    const items = (blk.items as unknown[]) ?? [];
    const points = items.map(itemToPoint).filter((p) => p[0]).slice(0, 4);
    const showcase: Record<string, unknown> = { t: blk.t, s: blk.s ?? blk.note, points, source: blk.source, image: {} };
    slides[i] = { showcase } as Record<string, Record<string, unknown>>;
    addHolder(showcase, "showcase", (blk.t as string) ?? "");
    used.add(i);
  }

  if (!targets.length) return 0;
  log(`Art director: generating ${targets.length} image(s) (${pct}% of ${slides.length} slides, ${quality})…`);

  // 3) Fan out with capped concurrency; degrade gracefully on failure.
  let done = 0;
  let active = 0;
  let idx = 0;
  const cap = 4;
  await new Promise<void>((resolve) => {
    const pump = () => {
      if (idx >= targets.length && active === 0) return resolve();
      while (active < cap && idx < targets.length) {
        const t = targets[idx++];
        active++;
        fetchImage({ prompt: buildImagePrompt(t.subject), size: t.size, quality })
          .then((data) => {
            t.holder.data = data;
            done++;
          })
          .catch((e) => log(`Art director: image skipped (${e instanceof Error ? e.message : String(e)})`))
          .finally(() => {
            active--;
            pump();
          });
      }
    };
    pump();
  });

  log(`Art director: ${done}/${targets.length} images attached.`);
  return done;
}
