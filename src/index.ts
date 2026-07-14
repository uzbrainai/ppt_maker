/**
 * slidewind — public API.
 *
 * Pipeline:
 *   parseDeckSpec → expandDeck → (validateScene) → compileScene / buildPptxBuffer
 *                                               → renderSceneSvg
 */

export * from "./core/types.js";

export { parseDeckSpec } from "./dsl/parseDeckSpec.js";
export type { ParseResult } from "./dsl/parseDeckSpec.js";
export { normalizeItems, slideKind } from "./dsl/normalize.js";

export { resolveClasses } from "./classes/resolveClasses.js";
export type { ResolvedClasses } from "./classes/classMap.js";
export { CLASS_MAP } from "./classes/classMap.js";

export { resolveTheme, THEMES, THEME_NAMES, THEME_DEFS, DEFAULT_THEME } from "./themes/index.js";
export { buildTheme, deriveColors } from "./themes/buildTheme.js";

export { CAPACITY, checkBudget } from "./core/capacity.js";
export type { Budget } from "./core/capacity.js";

export { expandDeck } from "./macros/expandDeck.js";
export type { ExpandResult } from "./macros/expandDeck.js";

export { validateScene } from "./validation/validateScene.js";
export { Warnings } from "./validation/warnings.js";
export type { Warning, WarningCode } from "./validation/warnings.js";

export { compileScene, buildPptxBuffer } from "./compiler/pptx/buildPptx.js";
export type { BuildOptions } from "./compiler/pptx/buildPptx.js";
export { convertToPdf, hasLibreOffice } from "./compiler/pdf.js";

export { renderSceneSvg } from "./preview/svgRenderer.js";

// LLM orchestration (content agent → design agent → DeckSpec → scene)
export { generateDeck } from "./agent/orchestrate.js";
export type { GenerateResult, GenerateOptions } from "./agent/orchestrate.js";
export { generateContent } from "./agent/contentAgent.js";
export type { DeckPrefs, ContentPlan, ContentSection } from "./agent/contentAgent.js";
export { designDeck } from "./agent/designAgent.js";
export { formatGuide } from "./agent/formatGuide.js";
export { loadEnv } from "./agent/env.js";

import { parseDeckSpec } from "./dsl/parseDeckSpec.js";
import { expandDeck } from "./macros/expandDeck.js";
import { validateScene } from "./validation/validateScene.js";
import { buildPptxBuffer } from "./compiler/pptx/buildPptx.js";
import { renderSceneSvg } from "./preview/svgRenderer.js";
import { Warnings } from "./validation/warnings.js";
import type { PPTScene } from "./core/types.js";

export interface CompileDeckResult {
  scene: PPTScene;
  pptx: Buffer;
  svg?: string;
  warnings: Warnings;
}

/**
 * High-level convenience: DeckSpec source string → .pptx buffer (+ optional SVG).
 */
export async function compileDeck(
  source: string,
  opts: { preview?: boolean; title?: string } = {}
): Promise<CompileDeckResult> {
  const { deck, warnings } = parseDeckSpec(source);
  const { scene, warnings: expandWarn } = expandDeck(deck);
  warnings.merge(expandWarn);
  warnings.merge(validateScene(scene));

  const pptx = await buildPptxBuffer(scene, { title: opts.title ?? deck.deck ?? "slidewind deck" });
  const svg = opts.preview ? renderSceneSvg(scene) : undefined;

  return { scene, pptx, svg, warnings };
}
