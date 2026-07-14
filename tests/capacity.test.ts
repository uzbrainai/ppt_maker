import { describe, it, expect } from "vitest";
import { CAPACITY, checkBudget } from "../src/core/capacity.js";
import { Warnings } from "../src/validation/warnings.js";
import { parseDeckSpec } from "../src/dsl/parseDeckSpec.js";
import { expandDeck } from "../src/macros/expandDeck.js";
import type { PPTElement } from "../src/core/types.js";

function flatten(els: PPTElement[]): PPTElement[] {
  const out: PPTElement[] = [];
  for (const el of els) {
    out.push(el);
    if (el.type === "group") out.push(...flatten(el.children));
  }
  return out;
}

describe("capacity contract", () => {
  it("defines a tiny budget for timeline nodes", () => {
    expect(CAPACITY.timeline.node.maxChars).toBeLessThanOrEqual(6);
    expect(CAPACITY.timeline.node.maxLines).toBe(1);
  });

  it("checkBudget warns when text exceeds the budget and returns maxLines", () => {
    const w = new Warnings();
    const lines = checkBudget("1-bosqich", CAPACITY.timeline.node, "node", w, "slide 1");
    expect(lines).toBe(1);
    expect(w.count).toBe(1);
    expect(w.all()[0].code).toBe("text-overflow-risk");
  });

  it("checkBudget stays silent for in-budget text", () => {
    const w = new Warnings();
    checkBudget("2025", CAPACITY.timeline.node, "node", w);
    expect(w.count).toBe(0);
  });
});

describe("timeline node rendering", () => {
  const DECK = `
format: deckspec/0.1
slides:
  - timeline:
      t: "T"
      items:
        - ["1-bosqich", "Audit", "x"]
        - ["2025", "Pilot", "y"]
`;
  const { deck } = parseDeckSpec(DECK);
  const { scene, warnings } = expandDeck(deck);

  it("renders the node label as a non-wrapping text overlay (never a 3-line stack)", () => {
    const all = flatten(scene.slides[0].elements);
    const nodeTexts = all.filter((e) => e.type === "text" && (e.text === "1-bosqich" || e.text === "2025"));
    expect(nodeTexts.length).toBe(2);
    for (const t of nodeTexts) {
      if (t.type === "text") expect(t.noWrap).toBe(true);
    }
  });

  it("warns that the long node label exceeds its budget", () => {
    expect(
      warnings.all().some((wn) => wn.code === "text-overflow-risk" && wn.message.includes("1-bosqich"))
    ).toBe(true);
  });
});
