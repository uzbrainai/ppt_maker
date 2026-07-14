/**
 * Text compilation: build `<p:txBody>` fragments from a TextStyle.
 *
 * Multi-line text (containing "\n") becomes multiple `<a:p>` paragraphs.
 */

import type { TextStyle } from "../../core/types.js";
import { escapeXml } from "../../core/xml.js";
import { emu, fontSizeToOoxml } from "../../core/units.js";
import { srgbClr } from "./ooxmlFill.js";

function alignAttr(align: TextStyle["align"]): string {
  switch (align) {
    case "center":
      return "ctr";
    case "right":
      return "r";
    default:
      return "l";
  }
}

function anchorAttr(vAlign: TextStyle["vAlign"]): string {
  switch (vAlign) {
    case "middle":
      return "ctr";
    case "bottom":
      return "b";
    default:
      return "t";
  }
}

export interface TxBodyOptions {
  /** inner padding in inches (applied to all sides) */
  padding?: number;
  /** wrap text (default true) */
  wrap?: boolean;
  /** relationship id for an external hyperlink applied to every run */
  linkRId?: string;
}

/** Build the run properties shared by every run in a paragraph. */
function runProps(style: TextStyle, linkRId?: string): string {
  const sz = fontSizeToOoxml(style.size);
  const attrs: string[] = [`lang="en-US"`, `sz="${sz}"`, `dirty="0"`];
  if (style.bold) attrs.push(`b="1"`);
  if (style.italic) attrs.push(`i="1"`);
  if (style.letterSpacing) attrs.push(`spc="${Math.round(style.letterSpacing * 100)}"`);
  const fill = style.color ? `<a:solidFill>${srgbClr(style.color)}</a:solidFill>` : "";
  const font = style.font
    ? `<a:latin typeface="${escapeXml(style.font)}"/><a:cs typeface="${escapeXml(style.font)}"/>`
    : "";
  // hlinkClick must come after fill/latin in the rPr child order.
  const hlink = linkRId ? `<a:hlinkClick xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${linkRId}"/>` : "";
  return `<a:rPr ${attrs.join(" ")}>${fill}${font}${hlink}</a:rPr>`;
}

function paragraph(line: string, style: TextStyle, linkRId?: string): string {
  const algn = alignAttr(style.align);
  const lnSpc = style.lineSpacing
    ? `<a:lnSpc><a:spcPct val="${Math.round(style.lineSpacing * 100000)}"/></a:lnSpc>`
    : "";
  const spcBef = style.spaceBefore
    ? `<a:spcBef><a:spcPts val="${Math.round(style.spaceBefore * 100)}"/></a:spcBef>`
    : "";
  const spcAft = style.spaceAfter
    ? `<a:spcAft><a:spcPts val="${Math.round(style.spaceAfter * 100)}"/></a:spcAft>`
    : "";
  const pPr = `<a:pPr algn="${algn}">${lnSpc}${spcBef}${spcAft}</a:pPr>`;
  // endParaRPr keeps PowerPoint from resetting size on empty lines.
  if (line.length === 0) {
    return `<a:p>${pPr}<a:endParaRPr lang="en-US" sz="${fontSizeToOoxml(style.size)}"/></a:p>`;
  }
  const run = `<a:r>${runProps(style, linkRId)}<a:t>${escapeXml(line)}</a:t></a:r>`;
  return `<a:p>${pPr}${run}</a:p>`;
}

export function txBody(text: string, style: TextStyle, opts: TxBodyOptions = {}): string {
  const pad = opts.padding ?? 0.05;
  const ins = emu(pad);
  const anchor = anchorAttr(style.vAlign);
  const wrap = opts.wrap === false ? "none" : "square";
  const bodyPr =
    `<a:bodyPr wrap="${wrap}" lIns="${ins}" tIns="${ins}" rIns="${ins}" bIns="${ins}" ` +
    `anchor="${anchor}" anchorCtr="0"><a:noAutofit/></a:bodyPr>`;

  const lines = text.split("\n");
  const paras = lines.map((l) => paragraph(l, style, opts.linkRId)).join("");
  return `<p:txBody>${bodyPr}<a:lstStyle/>${paras}</p:txBody>`;
}
