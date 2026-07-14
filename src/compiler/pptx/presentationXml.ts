/**
 * ppt/presentation.xml + docProps. Declares slide size, the slide master, and
 * the ordered slide id list (whose r:id values match presentationRels()).
 */

import { XML_DECL, escapeXml } from "../../core/xml.js";
import { emu } from "../../core/units.js";
import type { SlideSize } from "../../core/types.js";
import { slideRelId } from "./relationships.js";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

export function presentationXml(size: SlideSize, slideCount: number): string {
  const sldIds = Array.from({ length: slideCount }, (_, i) =>
    `<p:sldId id="${256 + i}" r:id="${slideRelId(i)}"/>`
  ).join("");

  const cx = emu(size.width);
  const cy = emu(size.height);
  const sldType = size.width > size.height * 1.4 ? "screen16x9" : "screen4x3";

  return (
    XML_DECL +
    `<p:presentation ${NS} saveSubsetFonts="1">` +
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
    `<p:sldIdLst>${sldIds}</p:sldIdLst>` +
    `<p:sldSz cx="${cx}" cy="${cy}" type="${sldType}"/>` +
    `<p:notesSz cx="6858000" cy="9144000"/>` +
    `</p:presentation>`
  );
}

export function corePropsXml(title: string): string {
  return (
    XML_DECL +
    `<cp:coreProperties ` +
    `xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ` +
    `xmlns:dc="http://purl.org/dc/elements/1.1/" ` +
    `xmlns:dcterms="http://purl.org/dc/terms/" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:title>${escapeXml(title)}</dc:title>` +
    `<dc:creator>slidewind</dc:creator>` +
    `<cp:lastModifiedBy>slidewind</cp:lastModifiedBy>` +
    `</cp:coreProperties>`
  );
}

export function appPropsXml(slideCount: number): string {
  return (
    XML_DECL +
    `<Properties ` +
    `xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ` +
    `xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>slidewind</Application>` +
    `<Slides>${slideCount}</Slides>` +
    `<Company></Company>` +
    `</Properties>`
  );
}
