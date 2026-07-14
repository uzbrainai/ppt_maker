import { describe, it, expect } from "vitest";
import { palette, generatePalette } from "../src/core/palette.js";
import { readableOn, contrastRatio } from "../src/core/color.js";
import { resolveClasses } from "../src/classes/resolveClasses.js";
import { fitText, groupColors } from "../src/macros/shared.js";
import { parseDeckSpec } from "../src/dsl/parseDeckSpec.js";
import { expandDeck } from "../src/macros/expandDeck.js";
import { modernEnterprise } from "../src/themes/modernEnterprise.js";
import type { PPTElement } from "../src/core/types.js";

function flatten(els: PPTElement[]): PPTElement[] {
  const out: PPTElement[] = [];
  for (const el of els) {
    out.push(el);
    if (el.type === "group") out.push(...flatten(el.children));
  }
  return out;
}

describe("palette tool", () => {
  it("returns N distinct curated colors", () => {
    const p = palette(modernEnterprise, 6);
    expect(p).toHaveLength(6);
    expect(new Set(p).size).toBe(6);
    for (const c of p) expect(c).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("generates a hue-rotated palette from a base color", () => {
    const p = generatePalette("#2563EB", 5, false);
    expect(p).toHaveLength(5);
    expect(new Set(p).size).toBe(5);
  });
});

describe("contrast (color library)", () => {
  it("picks light text on dark backgrounds and dark text on light", () => {
    expect(readableOn("#1E3A8A").strong).toBe("#FFFFFF");
    expect(readableOn("#FFFFFF").strong).toBe("#0F172A");
  });
  it("readable strong color clears a reasonable contrast ratio", () => {
    for (const bg of ["#1E3A8A", "#FFFFFF", "#0B1020", "#15803D"]) {
      expect(contrastRatio(readableOn(bg).strong, bg)).toBeGreaterThan(4);
    }
  });
});

describe("length-aware fitText", () => {
  it("returns text unchanged when it fits", () => {
    const r = fitText("Short", { boxW: 4, boxH: 1, padding: 0.05, base: { size: 14 } });
    expect(r.text).toBe("Short");
  });
  it("truncates with an ellipsis when it cannot fit the line budget", () => {
    const long = "Bu juda uzun matn ".repeat(40);
    const r = fitText(long, { boxW: 1.5, boxH: 0.4, padding: 0.05, base: { size: 12 }, maxLines: 2, minFontSize: 9 });
    expect(r.text.length).toBeLessThan(long.length);
    expect(r.text.endsWith("…")).toBe(true);
  });
  it("len hint caps the number of lines", () => {
    const long = "word ".repeat(60);
    const r = fitText(long, { boxW: 3, boxH: 3, padding: 0.05, base: { size: 12 }, len: "sm", minFontSize: 10 });
    expect(r.text.endsWith("…")).toBe(true);
  });
});

describe("group-based coloring", () => {
  it("items in the same group share one color; ungrouped differ", () => {
    const items = [
      { group: "a" },
      { group: "a" },
      { group: "b" },
      {},
    ];
    const tokens = resolveClasses("cards-colorful").tokens;
    const colors = groupColors(items, tokens, modernEnterprise);
    expect(colors[0]).toBe(colors[1]); // same group → same color
    expect(colors[0]).not.toBe(colors[2]); // different group → different
    expect(colors[2]).not.toBe(colors[3]);
  });
  it("single-accent decks use one color for all items", () => {
    const tokens = resolveClasses("accent-green").tokens;
    const colors = groupColors([{}, {}, {}], tokens, modernEnterprise);
    expect(new Set(colors).size).toBe(1);
  });
});

describe("new utility classes", () => {
  it("cards-colorful enables colorful + multi accent", () => {
    const { tokens } = resolveClasses("grid-3x2 cards-colorful accent-top numbered card-tinted");
    expect(tokens.colorful).toBe(true);
    expect(tokens.accent).toBe("multi");
    expect(tokens.accentTop).toBe(true);
    expect(tokens.numbered).toBe(true);
    expect(tokens.card).toEqual({ variant: "tinted" });
  });
});

const DECK = `
format: deckspec/0.1
deck: modern.enterprise
slides:
  - section:
      t: "Bo'lim"
      s: "Tavsif"
      n: "01"
  - kpi:
      class: "grid-3x1 accent-multi"
      t: "Raqamlar"
      items:
        - ["40%", "Tejash"]
        - ["2x", "Tezlik"]
        - ["95%", "Aniqlik"]
  - bullets:
      class: "numbered accent-blue"
      t: "Ro'yxat"
      s: "Kichik tavsif"
      items:
        - ["Birinchi", "Izoh bir"]
        - ["Ikkinchi", "Izoh ikki"]
  - cards:
      class: "grid-2x2 cards-colorful accent-top icons-line"
      t: "Kartalar"
      items:
        - [brain, AI, Tahlil]
        - [shield, Xavfsizlik, Himoya]
  - cmp:
      t: "Taqqoslash"
      items:
        - { t: "Eski", tone: "bad", points: ["Sekin", "Qimmat"] }
        - { t: "Yangi", tone: "good", points: ["Tez", "Arzon"] }
`;

describe("new macros expand into scenes", () => {
  const { deck } = parseDeckSpec(DECK);
  const { scene, warnings } = expandDeck(deck);

  it("produces slides with no unknown-macro warnings", () => {
    expect(warnings.all().some((w) => w.code === "unknown-slide-macro")).toBe(false);
  });

  it("produces all 5 slides incl. cmp", () => {
    expect(scene.slides).toHaveLength(5);
  });

  it("section slide has a large number + title, with light text on dark bg", () => {
    const all = flatten(scene.slides[0].elements);
    const num = all.find((e) => e.type === "text" && e.text === "01");
    expect(num).toBeDefined();
    const titleEl = all.find((e) => e.type === "text" && e.text === "Bo'lim");
    expect(titleEl).toBeDefined();
    if (titleEl && titleEl.type === "text") {
      expect(titleEl.style.color).toBe("#FFFFFF"); // contrast-aware on gradient
    }
  });

  it("cmp slide renders tone columns with check/cross markers", () => {
    const cmp = scene.slides[4];
    const all = flatten(cmp.elements);
    expect(all.some((e) => e.type === "text" && e.text === "Eski")).toBe(true);
    expect(all.some((e) => e.type === "text" && e.text === "Tez")).toBe(true);
    // two column groups
    expect(cmp.elements.filter((e) => e.type === "group").length).toBe(2);
  });

  it("kpi slide renders big values", () => {
    const all = flatten(scene.slides[1].elements);
    expect(all.some((e) => e.type === "text" && e.text === "40%")).toBe(true);
    expect(all.filter((e) => e.type === "group").length).toBe(3);
  });

  it("bullets slide has numbered markers and lead text", () => {
    const all = flatten(scene.slides[2].elements);
    expect(all.some((e) => e.type === "text" && e.text === "Kichik tavsif")).toBe(true);
    expect(all.some((e) => e.type === "shape" && e.shape === "ellipse" && (e as any).text === "1")).toBe(true);
  });

  it("colorful cards get distinct chip colors", () => {
    const groups = scene.slides[3].elements.filter((e) => e.type === "group");
    expect(groups.length).toBe(2);
    // accent-top bar present in each card group
    for (const g of groups) {
      if (g.type !== "group") continue;
      const bars = g.children.filter((c) => c.type === "shape" && c.box.h < 0.12);
      expect(bars.length).toBeGreaterThan(0);
    }
  });

  it("content slides get a footer with page numbers", () => {
    const all = flatten(scene.slides[1].elements);
    expect(all.some((e) => e.type === "text" && /\d+ \/ \d+/.test(e.text))).toBe(true);
  });
});
