import { describe, it, expect } from "vitest";
import { parseDeckSpec } from "../src/dsl/parseDeckSpec.js";
import { expandDeck } from "../src/macros/expandDeck.js";
import { resolveTheme, THEME_NAMES } from "../src/themes/index.js";

const DECK = `
format: deckspec/0.1
theme: midnight
appearance: dark
slides:
  - agenda:
      t: "Agenda"
      items: ["About", "Vision", "Services", "Team", "Case", "Stats", "Market", "Pricing"]
  - problem:
      t: "What's broken"
      items:
        - ["Data unused", "Sits idle in warehouses."]
        - ["Not optimized", "No modern AI in the loop."]
        - ["Manual decisions", "Humans do the deciding."]
  - roadmap:
      t: "Roadmap"
      items:
        - ["PHASE 1", "MVP", "Core features"]
        - ["PHASE 2", "Beta", "Early adopters"]
        - ["PHASE 3", "Scale", "Performance"]
  - stat:
      eyebrow: "Statistic"
      items:
        - { type: "bar", t: "Growth", body: "Up and to the right.", items: [["Q1", 8],["Q2", 12],["Q3", 16]] }
        - { type: "line", t: "Ranking", body: "Improving.", x: ["M1","M2","M3"], series: [{ name: "r", data: [18, 26, 35] }] }
`;

describe("new macros (agenda / roadmap / problem / stat)", () => {
  const { deck } = parseDeckSpec(DECK);
  const { scene, warnings } = expandDeck(deck);

  it("expands all four with no unknown-macro warnings", () => {
    expect(scene.slides).toHaveLength(4);
    expect(warnings.all().some((w) => w.code === "unknown-slide-macro")).toBe(false);
    expect(warnings.all().some((w) => w.code === "stub-macro")).toBe(false);
  });

  it("agenda renders a numbered pill (text '01.')", () => {
    const flat = scene.slides[0].elements;
    expect(flat.some((e) => e.type === "text" && e.text === "01.")).toBe(true);
  });

  it("problem renders big numbers as groups (one per item)", () => {
    expect(scene.slides[1].elements.filter((e) => e.type === "group").length).toBe(3);
  });

  it("roadmap renders phase circles (ellipses)", () => {
    expect(scene.slides[2].elements.some((e) => e.type === "shape" && e.shape === "ellipse")).toBe(true);
  });
});

describe("midnight theme registered", () => {
  it("is in the registry and resolves both modes", () => {
    expect(THEME_NAMES).toContain("midnight");
    expect(resolveTheme("midnight", "dark").colors.background).toBe("#03040D");
    expect(resolveTheme("midnight", "light").colors.background).toBe("#FFFFFF");
  });
});
