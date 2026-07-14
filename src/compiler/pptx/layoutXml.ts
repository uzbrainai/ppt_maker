/**
 * ppt/slideLayouts/slideLayout1.xml — a single blank layout. slidewind draws
 * everything explicitly on each slide, so the layout is intentionally empty.
 */

import { XML_DECL } from "../../core/xml.js";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const EMPTY_TREE =
  `<p:spTree>` +
  `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
  `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
  `</p:spTree>`;

export function layoutXml(): string {
  return (
    XML_DECL +
    `<p:sldLayout ${NS} type="blank" preserve="1">` +
    `<p:cSld name="Blank">${EMPTY_TREE}</p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
    `</p:sldLayout>`
  );
}
