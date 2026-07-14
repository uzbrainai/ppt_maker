/**
 * Parse + validate a DeckSpec Lite document from YAML or JSON.
 *
 * Structural errors throw (the deck is unusable). Per-slide oddities (unknown
 * macros, unknown classes) are collected as warnings so a mostly-valid deck
 * still produces output.
 */

import { parse as parseYaml } from "yaml";
import { deckSpecSchema, slideSchema } from "./schema.js";
import { slideKind } from "./normalize.js";
import { Warnings } from "../validation/warnings.js";
import type { DeckSpec, SlideSpec } from "../core/types.js";

export interface ParseResult {
  deck: DeckSpec;
  warnings: Warnings;
}

/** Try JSON first (it's a YAML subset, but the error messages are clearer). */
function parseDocument(source: string): unknown {
  const trimmed = source.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through to YAML
    }
  }
  return parseYaml(source);
}

export function parseDeckSpec(source: string): ParseResult {
  const warnings = new Warnings();
  const raw = parseDocument(source);

  const top = deckSpecSchema.safeParse(raw);
  if (!top.success) {
    const issues = top.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid DeckSpec: ${issues}`);
  }

  const rawSlides = (raw as { slides: unknown[] }).slides;
  const slides: SlideSpec[] = [];

  rawSlides.forEach((rawSlide, index) => {
    const where = `slide ${index + 1}`;
    const result = slideSchema.safeParse(rawSlide);
    if (!result.success) {
      const kind = slideKind(rawSlide as Record<string, unknown>);
      if (kind === "unknown") {
        warnings.add(
          "unknown-slide-macro",
          `Slide does not match any known macro (title/cards/wf/arch/cmp/roadmap); skipped.`,
          where
        );
        return;
      }
      const issues = result.error.issues
        .map((i) => `${i.path.join(".") || "<slide>"}: ${i.message}`)
        .join("; ");
      warnings.add("schema", `Slide failed validation (${issues}); skipped.`, where);
      return;
    }
    slides.push(result.data as SlideSpec);
  });

  if (slides.length === 0) {
    throw new Error("DeckSpec contains no valid slides.");
  }

  const deck: DeckSpec = {
    format: "deckspec/0.1",
    theme: top.data.theme,
    deck: top.data.deck,
    appearance: top.data.appearance,
    target: top.data.target,
    mode: top.data.mode,
    size: top.data.size,
    slides,
  };

  return { deck, warnings };
}
