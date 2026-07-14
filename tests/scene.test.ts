import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseDeckSpec } from "../src/dsl/parseDeckSpec.js";
import { expandDeck } from "../src/macros/expandDeck.js";
import { validateScene } from "../src/validation/validateScene.js";
import type { PPTElement } from "../src/core/types.js";

function loadExample() {
  const src = readFileSync(resolve(process.cwd(), "examples/deck.yaml"), "utf8");
  const { deck } = parseDeckSpec(src);
  return expandDeck(deck);
}

function flatten(els: PPTElement[]): PPTElement[] {
  const out: PPTElement[] = [];
  for (const el of els) {
    out.push(el);
    if (el.type === "group") out.push(...flatten(el.children));
  }
  return out;
}

describe("expandDeck", () => {
  it("produces a PPTScene with the right slide count and theme", () => {
    const { scene } = loadExample();
    expect(scene.version).toBe("pptscene/0.1");
    expect(scene.slides).toHaveLength(3);
    expect(scene.theme.name).toBe("modern.enterprise");
    expect(scene.size.width).toBeCloseTo(13.333, 2);
  });

  it("title slide has a gradient background as the first element", () => {
    const { scene } = loadExample();
    const first = scene.slides[0].elements[0];
    expect(first.type).toBe("shape");
    if (first.type === "shape") {
      expect(first.shape).toBe("rect");
      expect(first.style.fill?.type).toBe("linearGradient");
    }
    expect(scene.slides[0].background?.type).toBe("linearGradient");
  });

  it("cards slide expands into groups containing shapes and text", () => {
    const { scene } = loadExample();
    const cardsSlide = scene.slides[1];
    const groups = cardsSlide.elements.filter((e) => e.type === "group");
    expect(groups.length).toBe(6); // grid-3x2, 6 items
    const all = flatten(cardsSlide.elements);
    expect(all.some((e) => e.type === "text")).toBe(true);
    expect(all.some((e) => e.type === "shape")).toBe(true);
  });

  it("workflow slide has arrows (lines) between steps and a callout", () => {
    const { scene } = loadExample();
    const wf = scene.slides[2];
    const all = flatten(wf.elements);
    const lines = all.filter((e) => e.type === "line");
    expect(lines.length).toBeGreaterThanOrEqual(4); // 5 steps → 4 arrows
    // callout text present
    expect(all.some((e) => e.type === "text" && e.text.includes("Slidewind owns"))).toBe(true);
  });

  it("scene validation reports no fatal structural problems", () => {
    const { scene } = loadExample();
    const warnings = validateScene(scene);
    // Out-of-bounds decor is tolerated; there should be no 'schema' warnings.
    expect(warnings.all().some((w) => w.code === "schema")).toBe(false);
  });
});
