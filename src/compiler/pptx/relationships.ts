/**
 * Relationship (.rels) parts. Relationship IDs are referenced by the XML parts
 * that own them, so the numbering here must match presentationXml/masterXml/etc.
 */

import { XML_DECL, escapeXml } from "../../core/xml.js";

const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

function relationships(items: string[]): string {
  return XML_DECL + `<Relationships xmlns="${PKG}">` + items.join("") + `</Relationships>`;
}

/** Root _rels/.rels */
export function rootRels(): string {
  return relationships([
    `<Relationship Id="rId1" Type="${R}/officeDocument" Target="ppt/presentation.xml"/>`,
    `<Relationship Id="rId2" Type="${R}/metadata/core-properties" Target="docProps/core.xml"/>`,
    `<Relationship Id="rId3" Type="${R}/extended-properties" Target="docProps/app.xml"/>`,
  ]);
}

/**
 * ppt/_rels/presentation.xml.rels
 * rId1 → slideMaster; rId2..(N+1) → slides.
 */
export function presentationRels(slideCount: number): string {
  const items = [
    `<Relationship Id="rId1" Type="${R}/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
  ];
  for (let i = 0; i < slideCount; i++) {
    items.push(
      `<Relationship Id="rId${i + 2}" Type="${R}/slide" Target="slides/slide${i + 1}.xml"/>`
    );
  }
  return relationships(items);
}

/** Maps a slide index (0-based) to its presentation relationship id. */
export function slideRelId(index: number): string {
  return `rId${index + 2}`;
}

/** ppt/slideMasters/_rels/slideMaster1.xml.rels */
export function masterRels(): string {
  return relationships([
    `<Relationship Id="rId1" Type="${R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`,
    `<Relationship Id="rId2" Type="${R}/theme" Target="../theme/theme1.xml"/>`,
  ]);
}

/** ppt/slideLayouts/_rels/slideLayout1.xml.rels */
export function layoutRels(): string {
  return relationships([
    `<Relationship Id="rId1" Type="${R}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>`,
  ]);
}

/** ppt/slides/_rels/slideN.xml.rels — every slide points at the one layout. */
export function slideRels(rels: Array<{ id: string; kind: "hyperlink" | "image"; target: string }> = []): string {
  return relationships([
    `<Relationship Id="rId1" Type="${R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`,
    ...rels.map((r) =>
      r.kind === "hyperlink"
        ? `<Relationship Id="${r.id}" Type="${R}/hyperlink" Target="${escapeXml(r.target)}" TargetMode="External"/>`
        : `<Relationship Id="${r.id}" Type="${R}/image" Target="${escapeXml(r.target)}"/>`
    ),
  ]);
}
