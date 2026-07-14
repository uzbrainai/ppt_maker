import { describe, it, expect } from "vitest";
import { resolveTheme, THEME_NAMES, THEME_DEFS } from "../src/themes/index.js";
import { buildTheme } from "../src/themes/buildTheme.js";
import { luminance } from "../src/core/color.js";
import { parseDeckSpec } from "../src/dsl/parseDeckSpec.js";
import { expandDeck } from "../src/macros/expandDeck.js";

describe("palette themes + appearance", () => {
  it("registers the attached indigo theme with both modes", () => {
    expect(THEME_NAMES).toContain("indigo");
    expect(THEME_DEFS.indigo.light.accent).toBeDefined();
    expect(THEME_DEFS.indigo.dark.accent).toBeDefined();
  });

  it("resolveTheme honors appearance: light is bright, dark is dark", () => {
    const light = resolveTheme("indigo", "light");
    const dark = resolveTheme("indigo", "dark");
    expect(luminance(light.colors.background)).toBeGreaterThan(0.7);
    expect(luminance(dark.colors.background)).toBeLessThan(0.1);
    // text always contrasts with background
    expect(luminance(light.colors.text)).toBeLessThan(0.3);
    expect(luminance(dark.colors.text)).toBeGreaterThan(0.6);
  });

  it("defaults to the theme's natural appearance when none is given", () => {
    expect(resolveTheme("dark.tech").name).toBe("dark.tech");
    // dark.tech defaults to dark
    expect(luminance(resolveTheme("dark.tech").colors.background)).toBeLessThan(0.2);
    // modern.enterprise defaults to light
    expect(luminance(resolveTheme("modern.enterprise").colors.background)).toBeGreaterThan(0.7);
  });

  it("derives accent + surfaces from the 5-role palette", () => {
    const t = buildTheme("x", { text: "#000000", background: "#FFFFFF", primary: "#3A36C9", secondary: "#D9DAF6", accent: "#4F46E5" }, "light");
    expect(t.colors.accent).toBe("#4F46E5");
    expect(t.colors.primary).toBe("#3A36C9");
    expect(t.colors.surfaceMuted).toBe("#D9DAF6");
  });

  it("unknown theme warns and falls back", () => {
    const t = resolveTheme("nope");
    expect(t.name).toBe("modern.enterprise");
  });
});

describe("DeckSpec theme + appearance fields", () => {
  it("reads theme + appearance from the deck", () => {
    const src = `
format: deckspec/0.1
theme: indigo
appearance: dark
slides:
  - title: { t: "Hi" }
`;
    const { deck } = parseDeckSpec(src);
    expect(deck.theme).toBe("indigo");
    expect(deck.appearance).toBe("dark");
    const { scene } = expandDeck(deck);
    expect(scene.theme.name).toBe("indigo");
    expect(luminance(scene.theme.colors.background)).toBeLessThan(0.1);
  });
});
