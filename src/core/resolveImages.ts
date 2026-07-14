/**
 * Resolve macro image specs that reference a local file (`image.src`) into raw
 * bytes (`image.data`) so the compiler can embed them. Premium generation
 * attaches `data` directly; this covers hand-authored decks and `src` paths.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import type { DeckSpec } from "./types.js";
import { slideKind } from "../dsl/normalize.js";

export function resolveDeckImages(deck: DeckSpec, baseDir = "."): void {
  for (const slide of deck.slides) {
    const kind = slideKind(slide as Record<string, unknown>);
    const block = (slide as Record<string, { image?: { src?: string; data?: Buffer } }>)[kind];
    const img = block?.image;
    if (img && img.src && !img.data) {
      try {
        img.data = readFileSync(resolve(baseDir, img.src));
      } catch {
        /* missing file → leave as placeholder */
      }
    }
  }
}
