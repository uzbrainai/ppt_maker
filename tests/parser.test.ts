import { describe, it, expect } from "vitest";
import { parseDeckSpec } from "../src/dsl/parseDeckSpec.js";
import { normalizeItem } from "../src/dsl/normalize.js";

const YAML = `
format: deckspec/0.1
deck: modern.enterprise
size: wide
slides:
  - title:
      class: "hero bg-gradient-soft"
      t: Hello
      s: World
  - cards:
      class: "grid-2x2"
      t: Cards
      items:
        - [bot, Chatbots, Customer service]
        - [mic, Calls, Analyze conversations]
`;

describe("parseDeckSpec", () => {
  it("parses valid YAML", () => {
    const { deck, warnings } = parseDeckSpec(YAML);
    expect(deck.format).toBe("deckspec/0.1");
    expect(deck.deck).toBe("modern.enterprise");
    expect(deck.slides).toHaveLength(2);
    expect(warnings.count).toBe(0);
  });

  it("parses JSON input", () => {
    const json = JSON.stringify({
      format: "deckspec/0.1",
      slides: [{ title: { t: "Hi" } }],
    });
    const { deck } = parseDeckSpec(json);
    expect(deck.slides).toHaveLength(1);
  });

  it("throws on missing format", () => {
    expect(() => parseDeckSpec("slides: []")).toThrow(/Invalid DeckSpec/);
  });

  it("skips invalid slides with a warning instead of crashing", () => {
    const src = `
format: deckspec/0.1
slides:
  - title:
      t: Good
  - bogus:
      foo: bar
`;
    const { deck, warnings } = parseDeckSpec(src);
    expect(deck.slides).toHaveLength(1);
    expect(warnings.count).toBeGreaterThan(0);
    expect(warnings.all().some((w) => w.code === "unknown-slide-macro")).toBe(true);
  });
});

describe("normalizeItem", () => {
  it("handles [icon, title, body] tuples", () => {
    expect(normalizeItem(["bot", "Title", "Body"])).toEqual({
      icon: "bot",
      title: "Title",
      body: "Body",
    });
  });

  it("handles [title, body] tuples", () => {
    expect(normalizeItem(["Title", "Body"])).toEqual({
      title: "Title",
      body: "Body",
    });
  });

  it("handles object form", () => {
    expect(normalizeItem({ icon: "x", t: "T", s: "S" })).toEqual({
      icon: "x",
      title: "T",
      body: "S",
    });
  });
});
