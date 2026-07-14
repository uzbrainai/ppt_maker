import { describe, it, expect } from "vitest";
import { buildIcon, isKnownIcon } from "../src/geometry/icons.js";
import type { ShapeElement } from "../src/core/types.js";

const BOX = { x: 1, y: 1, w: 0.5, h: 0.5 };

describe("buildIcon (lucide-backed)", () => {
  it("resolves a direct lucide name into editable shapes", () => {
    const { elements, known } = buildIcon("mail", BOX, { color: "#2563EB" });
    expect(known).toBe(true);
    expect(elements.length).toBeGreaterThan(0);
    // mail = path (envelope flap) + rect (body)
    expect(elements.some((e) => e.type === "shape" && e.shape === "freeform")).toBe(true);
    expect(elements.some((e) => e.type === "shape" && (e as ShapeElement).shape.includes("ect"))).toBe(true);
  });

  it("freeform icon shapes carry parsed path segments + 24x24 viewBox", () => {
    const { elements } = buildIcon("shield", BOX, { color: "#000000" });
    const free = elements.find(
      (e): e is ShapeElement => e.type === "shape" && e.shape === "freeform"
    );
    expect(free).toBeDefined();
    expect(free!.geometry?.segments?.length).toBeGreaterThan(1);
    expect(free!.geometry?.viewBox).toEqual({ w: 24, h: 24 });
    // stroked, not filled
    expect(free!.style.fill).toEqual({ type: "none" });
    expect(free!.style.stroke?.round).toBe(true);
  });

  it("maps friendly aliases (gear → settings)", () => {
    expect(isKnownIcon("gear")).toBe(true);
    const { known, elements } = buildIcon("gear", BOX, { color: "#111" });
    expect(known).toBe(true);
    expect(elements.length).toBeGreaterThan(0);
  });

  it("falls back to a lettered placeholder for unknown names", () => {
    const { elements, known } = buildIcon("definitely-not-an-icon-xyz", BOX, { color: "#111" });
    expect(known).toBe(false);
    expect(elements.some((e) => e.type === "text" && e.text === "D")).toBe(true);
  });

  it("scales geometry into the requested box", () => {
    const { elements } = buildIcon("workflow", { x: 2, y: 3, w: 1, h: 1 }, { color: "#111" });
    for (const el of elements) {
      expect(el.box.x).toBeGreaterThanOrEqual(2 - 0.01);
      expect(el.box.y).toBeGreaterThanOrEqual(3 - 0.01);
      expect(el.box.x + el.box.w).toBeLessThanOrEqual(2 + 1 + 0.01);
    }
  });
});
