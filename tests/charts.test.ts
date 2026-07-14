import { describe, it, expect } from "vitest";
import { parseDeckSpec } from "../src/dsl/parseDeckSpec.js";
import { expandDeck } from "../src/macros/expandDeck.js";
import { compileScene } from "../src/compiler/pptx/buildPptx.js";
import type { PPTElement } from "../src/core/types.js";

function flatten(els: PPTElement[]): PPTElement[] {
  const out: PPTElement[] = [];
  for (const el of els) {
    out.push(el);
    if (el.type === "group") out.push(...flatten(el.children));
  }
  return out;
}

const DECK = `
format: deckspec/0.1
deck: modern.enterprise
slides:
  - chart:
      type: donut
      t: "Donut"
      insightTitle: "Insights"
      items:
        - ["A", 30]
        - ["B", 50]
        - ["C", 20]
      points:
        - "B is the largest"
        - "C is smallest"
  - chart:
      type: bar
      t: "Bar"
      values: true
      items:
        - ["X", 10]
        - ["Y", 20]
  - chart:
      type: area
      t: "Area"
      x: ["2020","2021","2022"]
      series:
        - { name: "S", data: [5, 12, 22] }
  - timeline:
      eyebrow: "Roadmap"
      t: "Timeline"
      callout: "phased approach"
      items:
        - ["Q1", "Boshlash", "izoh"]
        - ["Q2", "Pilot"]
        - ["Q3", "Masshtab"]
  - summary:
      t: "Xulosa"
      s: "lead"
      items:
        - [rocket, "Tez", "izoh"]
        - [shield, "Xavfsiz", "izoh"]
`;

describe("chart / timeline / summary macros", () => {
  const { deck } = parseDeckSpec(DECK);
  const { scene, warnings } = expandDeck(deck);

  it("expands all 5 slides without unknown-macro warnings", () => {
    expect(scene.slides).toHaveLength(5);
    expect(warnings.all().some((w) => w.code === "unknown-slide-macro")).toBe(false);
  });

  it("donut chart produces editable freeform (custGeom) ring sectors + legend + insight", () => {
    const all = flatten(scene.slides[0].elements);
    const free = all.filter((e) => e.type === "shape" && e.shape === "freeform");
    expect(free.length).toBe(3); // one sector per datum
    // legend labels present
    expect(all.some((e) => e.type === "text" && e.text === "A")).toBe(true);
    // explanation panel: insight title + bullet text
    expect(all.some((e) => e.type === "text" && e.text === "Insights")).toBe(true);
    expect(all.some((e) => e.type === "text" && e.text === "B is the largest")).toBe(true);
  });

  it("bar chart produces rectangles + value labels + axis", () => {
    const all = flatten(scene.slides[1].elements);
    expect(all.filter((e) => e.type === "shape" && e.shape === "roundRect").length).toBeGreaterThanOrEqual(2);
    expect(all.some((e) => e.type === "text" && e.text === "10")).toBe(true);
    expect(all.some((e) => e.type === "line")).toBe(true); // gridlines/axis
  });

  it("area chart produces a filled freeform + a stroked line", () => {
    const all = flatten(scene.slides[2].elements);
    const free = all.filter((e): e is Extract<PPTElement, { type: "shape" }> => e.type === "shape" && e.shape === "freeform");
    expect(free.length).toBeGreaterThanOrEqual(2);
    expect(free.some((f) => f.geometry?.filled)).toBe(true);
  });

  it("timeline has an axis, one node per item, milestone cards, eyebrow + callout", () => {
    const top = scene.slides[3].elements;
    const all = flatten(top);
    expect(all.some((e) => e.type === "line")).toBe(true);
    expect(top.filter((e) => e.type === "group").length).toBe(3);
    expect(all.some((e) => e.type === "shape" && e.shape === "ellipse")).toBe(true); // nodes
    expect(all.some((e) => e.type === "text" && e.text === "ROADMAP")).toBe(true); // eyebrow upper
    expect(all.some((e) => e.type === "text" && e.text.includes("phased approach"))).toBe(true);
  });

  it("summary has a panel + one takeaway group per item", () => {
    const top = scene.slides[4].elements;
    expect(top.filter((e) => e.type === "group").length).toBe(2);
    const all = flatten(top);
    expect(all.some((e) => e.type === "text" && e.text === "Xulosa")).toBe(true);
  });

  it("donut compiles to OOXML custGeom with bezier arcs", () => {
    const parts = compileScene(scene);
    const s1 = parts["ppt/slides/slide1.xml"];
    expect(s1).toContain("<a:custGeom>");
    expect(s1).toContain("<a:cubicBezTo>");
  });
});
