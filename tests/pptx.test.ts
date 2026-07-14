import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { parseDeckSpec } from "../src/dsl/parseDeckSpec.js";
import { expandDeck } from "../src/macros/expandDeck.js";
import { compileScene, buildPptxBuffer } from "../src/compiler/pptx/buildPptx.js";

function example() {
  const src = readFileSync(resolve(process.cwd(), "examples/deck.yaml"), "utf8");
  const { deck } = parseDeckSpec(src);
  return expandDeck(deck).scene;
}

const REQUIRED_PARTS = [
  "[Content_Types].xml",
  "_rels/.rels",
  "docProps/core.xml",
  "docProps/app.xml",
  "ppt/presentation.xml",
  "ppt/_rels/presentation.xml.rels",
  "ppt/theme/theme1.xml",
  "ppt/slideMasters/slideMaster1.xml",
  "ppt/slideMasters/_rels/slideMaster1.xml.rels",
  "ppt/slideLayouts/slideLayout1.xml",
  "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
  "ppt/slides/slide1.xml",
  "ppt/slides/_rels/slide1.xml.rels",
];

describe("compileScene (parts)", () => {
  it("emits all required OOXML parts", () => {
    const parts = compileScene(example());
    for (const p of REQUIRED_PARTS) {
      expect(parts[p], `missing ${p}`).toBeDefined();
    }
    expect(parts["ppt/slides/slide2.xml"]).toBeDefined();
    expect(parts["ppt/slides/slide3.xml"]).toBeDefined();
  });

  it("slide1 contains a gradient fill (bg-gradient-soft)", () => {
    const parts = compileScene(example());
    expect(parts["ppt/slides/slide1.xml"]).toContain("<a:gradFill");
    expect(parts["ppt/slides/slide1.xml"]).toContain("<a:lin ang=");
  });

  it("slides contain editable shapes and text", () => {
    const parts = compileScene(example());
    const slide2 = parts["ppt/slides/slide2.xml"];
    expect(slide2).toContain("<p:sp>");
    expect(slide2).toContain("<p:txBody>");
    expect(slide2).toContain("prstGeom prst=\"roundRect\"");
    // grouped cards
    expect(slide2).toContain("<p:grpSp>");
  });

  it("lucide icons compile to editable custom geometry (custGeom + beziers)", () => {
    const parts = compileScene(example());
    const slide2 = parts["ppt/slides/slide2.xml"];
    expect(slide2).toContain("<a:custGeom>");
    expect(slide2).toContain("<a:cubicBezTo>");
    expect(slide2).toContain("<a:pathLst>");
    // icon paths are stroked, not filled
    expect(slide2).toContain('<a:path w="21600" h="21600" fill="none">');
  });

  it("workflow slide contains connector arrows", () => {
    const parts = compileScene(example());
    const slide3 = parts["ppt/slides/slide3.xml"];
    expect(slide3).toContain("<p:cxnSp>");
    expect(slide3).toContain("straightConnector1");
    expect(slide3).toContain("<a:tailEnd");
  });

  it("content types lists every slide", () => {
    const parts = compileScene(example());
    const ct = parts["[Content_Types].xml"];
    expect(ct).toContain("/ppt/slides/slide1.xml");
    expect(ct).toContain("/ppt/slides/slide2.xml");
    expect(ct).toContain("/ppt/slides/slide3.xml");
  });
});

describe("buildPptxBuffer (zip)", () => {
  it("produces a valid zip that contains the parts", async () => {
    const buffer = await buildPptxBuffer(example());
    expect(buffer.length).toBeGreaterThan(1000);

    const zip = await JSZip.loadAsync(buffer);
    for (const p of REQUIRED_PARTS) {
      expect(zip.file(p), `zip missing ${p}`).not.toBeNull();
    }
    const slide1 = await zip.file("ppt/slides/slide1.xml")!.async("string");
    expect(slide1).toContain("<a:gradFill");
  });
});
