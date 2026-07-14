import { describe, it, expect } from "vitest";
import { compileScene } from "../src/compiler/pptx/buildPptx.js";
import { resolveTheme } from "../src/themes/index.js";
import { slideSize } from "../src/core/units.js";
import type { PPTScene } from "../src/core/types.js";

// 1x1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function sceneWithImage(): PPTScene {
  const theme = resolveTheme("midnight", "dark");
  const size = slideSize("wide");
  return {
    version: "pptscene/0.1",
    unit: "inch",
    size,
    theme,
    slides: [
      {
        id: "s1",
        background: { type: "solid", color: "#000000" },
        elements: [
          { id: "i1", type: "image", box: { x: 1, y: 1, w: 4, h: 3 }, data: PNG, fit: "cover", radius: 0.2 },
          { id: "i2", type: "image", box: { x: 6, y: 1, w: 4, h: 3 }, data: PNG, fit: "cover" }, // identical → dedupe
        ],
      },
    ],
  };
}

describe("image embedding", () => {
  const parts = compileScene(sceneWithImage());

  it("writes a single deduped media part for identical images", () => {
    expect(Buffer.isBuffer(parts["ppt/media/image1.png"])).toBe(true);
    expect(parts["ppt/media/image2.png"]).toBeUndefined();
  });

  it("declares the png content type", () => {
    expect(String(parts["[Content_Types].xml"])).toContain('Extension="png"');
  });

  it("adds image relationships and a <p:pic> blip", () => {
    const rels = String(parts["ppt/slides/_rels/slide1.xml.rels"]);
    expect(rels).toContain("relationships/image");
    expect((rels.match(/relationships\/image/g) ?? []).length).toBe(2); // two rels, one media file
    const xml = String(parts["ppt/slides/slide1.xml"]);
    expect(xml).toContain("<p:pic>");
    expect(xml).toContain("<a:blip r:embed=");
  });
});
