#!/usr/bin/env node
/**
 * slidewind CLI.
 *
 *   slidewind build <deck.yaml> -o <out.pptx> [--preview]
 *   slidewind inspect <deck.yaml>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { parseDeckSpec } from "./dsl/parseDeckSpec.js";
import { expandDeck } from "./macros/expandDeck.js";
import { resolveDeckImages } from "./core/resolveImages.js";
import { validateScene } from "./validation/validateScene.js";
import { buildPptxBuffer } from "./compiler/pptx/buildPptx.js";
import { convertToPdf } from "./compiler/pdf.js";
import { renderSceneSvg } from "./preview/svgRenderer.js";
import { resolveClasses } from "./classes/resolveClasses.js";
import { slideKind } from "./dsl/normalize.js";
import { Warnings } from "./validation/warnings.js";
import type { PPTElement, PPTSlide } from "./core/types.js";

interface Args {
  _: string[];
  out?: string;
  preview: boolean;
  pdf: boolean;
  help: boolean;
  topic?: string;
  theme?: string;
  appearance?: "light" | "dark";
  pages?: number;
  lang?: string;
  env?: string;
  model?: string;
  research?: boolean;
  premium?: boolean;
  imagePct?: number;
  imageQuality?: "low" | "medium" | "high" | "auto";
}

function parseArgs(argv: string[]): Args {
  const args: Args = { _: [], preview: false, pdf: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-o" || a === "--out") args.out = argv[++i];
    else if (a === "--preview") args.preview = true;
    else if (a === "--pdf") args.pdf = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else if (a === "--topic") args.topic = argv[++i];
    else if (a === "--theme") args.theme = argv[++i];
    else if (a === "--mode" || a === "--appearance") args.appearance = argv[++i] as "light" | "dark";
    else if (a === "--pages") args.pages = Number(argv[++i]);
    else if (a === "--lang" || a === "--language") args.lang = argv[++i];
    else if (a === "--env") args.env = argv[++i];
    else if (a === "--model") args.model = argv[++i];
    else if (a === "--research") args.research = true;
    else if (a === "--no-research") args.research = false;
    else if (a === "--premium") args.premium = true;
    else if (a === "--image-pct") args.imagePct = Number(argv[++i]);
    else if (a === "--image-quality") args.imageQuality = argv[++i] as Args["imageQuality"];
    else args._.push(a);
  }
  return args;
}

const USAGE = `slidewind — Tailwind-style DSL for editable PPTX generation

Usage:
  slidewind build <deck.yaml> -o <out.pptx> [--preview]
  slidewind inspect <deck.yaml>
  slidewind generate --topic "<topic>" [options] -o <out.pptx> [--preview]

Generate options (LLM orchestration: content agent → design agent → pptx):
  --topic <text>     Deck topic (required)
  --theme <name>     Theme: modern.enterprise | agrobank.ai | dark.tech | indigo | amethyst | aurora | sorbet
  --mode <light|dark>  Appearance
  --pages <n>        Target slide count (default 10)
  --lang <code>      Content language, e.g. uz, en (default en)
  --model <id>       OpenAI model (default $OPENAI_MODEL or gpt-4)
  --no-research      Skip the live web-search grounding step (research is on by default)
  --premium          Generate photographic images for ~40% of slides (gpt-image)
  --image-pct <n>    Percent of slides to illustrate in premium mode (default 40)
  --image-quality <q>  low | medium | high (default medium; high is costly)
  --env <path>       .env providing OPENAI_API_KEY (also OPENAI_IMAGE_MODEL, IMAGE_SERVICE_URL)

Common options:
  -o, --out <path>   Output .pptx path
  --preview          Also write an SVG preview next to the .pptx
  --pdf              Also export a .pdf (requires LibreOffice)
  -h, --help         Show this help
`;

async function maybePdf(outPath: string, want: boolean): Promise<void> {
  if (!want) return;
  try {
    const pdf = await convertToPdf(outPath);
    console.log(`✓ Wrote ${pdf}`);
  } catch (e) {
    console.error("⚠ PDF export skipped: " + (e instanceof Error ? e.message : String(e)));
  }
}

function readDeck(path: string): string {
  return readFileSync(resolve(path), "utf8");
}

function countElements(elements: PPTElement[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const walk = (els: PPTElement[]) => {
    for (const el of els) {
      counts[el.type] = (counts[el.type] ?? 0) + 1;
      if (el.type === "group") walk(el.children);
    }
  };
  walk(elements);
  return counts;
}

async function cmdBuild(args: Args): Promise<number> {
  const input = args._[0];
  if (!input) {
    console.error("Error: missing input deck.\n\n" + USAGE);
    return 1;
  }
  const out = args.out ?? "out.pptx";

  const source = readDeck(input);
  const { deck, warnings } = parseDeckSpec(source);
  resolveDeckImages(deck, dirname(resolve(input)));
  const { scene, warnings: expandWarn } = expandDeck(deck);
  warnings.merge(expandWarn);
  warnings.merge(validateScene(scene));

  const buffer = await buildPptxBuffer(scene, { title: deck.deck ?? basename(input) });
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), buffer);
  console.log(`✓ Wrote ${out} (${scene.slides.length} slide${scene.slides.length === 1 ? "" : "s"}, ${buffer.length} bytes)`);

  if (args.preview) {
    const svg = renderSceneSvg(scene);
    const svgPath = resolve(dirname(resolve(out)), "preview.svg");
    writeFileSync(svgPath, svg, "utf8");
    console.log(`✓ Wrote ${svgPath}`);
  }
  await maybePdf(resolve(out), args.pdf);

  printWarnings(warnings);
  return 0;
}

function cmdInspect(args: Args): number {
  const input = args._[0];
  if (!input) {
    console.error("Error: missing input deck.\n\n" + USAGE);
    return 1;
  }
  const source = readDeck(input);
  const { deck, warnings } = parseDeckSpec(source);

  console.log("── DeckSpec ──────────────────────────────");
  console.log(`format:      ${deck.format}`);
  console.log(`theme:       ${deck.theme ?? deck.deck ?? "(default)"}`);
  console.log(`appearance:  ${deck.appearance ?? "(theme default)"}`);
  console.log(`target:      ${deck.target ?? "generic"}`);
  console.log(`mode:        ${deck.mode ?? "editable"}`);
  console.log(`size:        ${deck.size ?? "wide"}`);
  console.log(`slides:      ${deck.slides.length}`);

  console.log("\n── Per-slide class resolution ────────────");
  deck.slides.forEach((slide, i) => {
    const kind = slideKind(slide as Record<string, unknown>);
    const block = (slide as Record<string, { class?: string; t?: string }>)[kind] ?? {};
    const { tokens, warnings: w } = resolveClasses(block.class, `slide ${i + 1}`);
    warnings.merge(w);
    console.log(`\nSlide ${i + 1} [${kind}]${block.t ? ` — "${block.t}"` : ""}`);
    console.log(`  class:  ${block.class ?? "(none)"}`);
    console.log(`  tokens: ${JSON.stringify(stripApplied(tokens as unknown as Record<string, unknown>))}`);
  });

  console.log("\n── Scene summary ─────────────────────────");
  const { scene, warnings: expandWarn } = expandDeck(deck);
  warnings.merge(expandWarn);
  warnings.merge(validateScene(scene));
  console.log(`theme:   ${scene.theme.name}`);
  console.log(`size:    ${scene.size.width}in × ${scene.size.height}in`);
  scene.slides.forEach((slide: PPTSlide, i) => {
    const counts = countElements(slide.elements);
    const summary = Object.entries(counts)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ");
    console.log(`  slide ${i + 1}: ${summary}${slide.notes ? " (+notes)" : ""}`);
  });

  console.log("\n── Warnings ──────────────────────────────");
  printWarnings(warnings);
  return 0;
}

function stripApplied(tokens: Record<string, unknown>): Record<string, unknown> {
  const { applied, ...rest } = tokens as { applied?: unknown };
  void applied;
  return rest;
}

function printWarnings(warnings: Warnings): void {
  if (warnings.count === 0) {
    console.log("No warnings.");
  } else {
    console.log(`${warnings.count} warning(s):`);
    console.log(warnings.format());
  }
}

async function cmdGenerate(args: Args): Promise<number> {
  const topic = args.topic ?? args._[0];
  if (!topic) {
    console.error("Error: --topic is required.\n\n" + USAGE);
    return 1;
  }
  const out = args.out ?? "examples/out/generated.pptx";
  const { generateDeck } = await import("./agent/orchestrate.js");

  const { deck, scene, warnings, yaml, content, sources } = await generateDeck(
    {
      topic,
      theme: args.theme,
      appearance: args.appearance,
      pages: args.pages,
      language: args.lang,
      model: args.model,
      research: args.research,
      premium: args.premium,
      imagePct: args.imagePct,
      imageQuality: args.imageQuality,
    },
    { envPath: args.env, onProgress: (m) => console.log("  • " + m) }
  );

  // Save the generated DeckSpec YAML next to the pptx for inspection/editing.
  mkdirSync(dirname(resolve(out)), { recursive: true });
  const yamlPath = resolve(dirname(resolve(out)), basename(out).replace(/\.pptx$/i, "") + ".yaml");
  writeFileSync(yamlPath, yaml, "utf8");
  console.log(`✓ Wrote ${yamlPath}`);

  const buffer = await buildPptxBuffer(scene, { title: content.deckTitle });
  writeFileSync(resolve(out), buffer);
  console.log(`✓ Wrote ${out} (${scene.slides.length} slides, ${buffer.length} bytes)`);

  if (args.preview) {
    const svgPath = resolve(dirname(resolve(out)), "preview.svg");
    writeFileSync(svgPath, renderSceneSvg(scene), "utf8");
    console.log(`✓ Wrote ${svgPath}`);
  }
  await maybePdf(resolve(out), args.pdf);

  console.log(`theme: ${deck.theme ?? deck.deck ?? "(default)"} / appearance: ${deck.appearance ?? "(theme default)"}`);
  if (sources && sources.length) {
    console.log(`sources (${sources.length}, also in title slide notes):`);
    for (const s of sources.slice(0, 8)) console.log(`  - ${s.url}`);
  }
  printWarnings(warnings);
  return 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const command = args._.shift();

  if (args.help || !command) {
    console.log(USAGE);
    return command ? 0 : 1;
  }

  switch (command) {
    case "build":
      return cmdBuild(args);
    case "inspect":
      return cmdInspect(args);
    case "generate":
      return cmdGenerate(args);
    default:
      console.error(`Unknown command: ${command}\n\n${USAGE}`);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("✗ " + (err instanceof Error ? err.message : String(err)));
    process.exit(1);
  });
