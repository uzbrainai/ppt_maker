/**
 * Shape + line compilation.
 *
 *  - shapePresetToOoxml → <a:prstGeom>
 *  - strokeToOoxml      → <a:ln> (width, color, dash, arrowheads)
 *  - shapeElementXml    → full <p:sp>
 *  - lineElementXml     → full <p:cxnSp> straight connector
 */

import type {
  GeometrySpec,
  LineElement,
  PathSeg,
  ShapeElement,
  ShapeName,
  StrokeSpec,
} from "../../core/types.js";
import { escapeXml } from "../../core/xml.js";
import { emu, lineWidthToEmu } from "../../core/units.js";
import { angleToOoxml } from "../../core/color.js";
import { presetFor, roundRectAdj } from "../../geometry/shapePresets.js";
import { fillToOoxml, srgbClr } from "./ooxmlFill.js";
import { shadowToOoxml } from "./ooxmlEffects.js";
import { txBody } from "./ooxmlText.js";

function xfrm(box: { x: number; y: number; w: number; h: number }, rotation?: number): string {
  const rot = rotation ? ` rot="${angleToOoxml(rotation)}"` : "";
  // Extents MUST be positive — PowerPoint rejects zero/negative cx/cy and shows
  // a "repair" dialog (LibreOffice tolerates it). Clamp to ≥ 1 EMU.
  return (
    `<a:xfrm${rot}>` +
    `<a:off x="${emu(box.x)}" y="${emu(box.y)}"/>` +
    `<a:ext cx="${Math.max(1, emu(box.w))}" cy="${Math.max(1, emu(box.h))}"/>` +
    `</a:xfrm>`
  );
}

export function shapePresetToOoxml(
  shape: ShapeName,
  box: { w: number; h: number },
  radiusInches?: number,
  adjust?: Record<string, number>
): string {
  const prst = presetFor(shape);
  const guides: string[] = [];

  if (shape === "roundRect" && radiusInches !== undefined) {
    guides.push(`<a:gd name="adj" fmla="val ${roundRectAdj(radiusInches, box.w, box.h)}"/>`);
  }
  if (adjust) {
    for (const [name, val] of Object.entries(adjust)) {
      guides.push(`<a:gd name="${escapeXml(name)}" fmla="val ${Math.round(val)}"/>`);
    }
  }
  const avLst = guides.length ? `<a:avLst>${guides.join("")}</a:avLst>` : `<a:avLst/>`;
  return `<a:prstGeom prst="${prst}">${avLst}</a:prstGeom>`;
}

/** DrawingML custom geometry path coordinate space (path-local units). */
const GEOM_SPACE = 21600;

function gi(n: number): number {
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function pt(x: number, y: number, sx: number, sy: number): string {
  return `<a:pt x="${gi(x * sx)}" y="${gi(y * sy)}"/>`;
}

/**
 * Compile parsed path segments into a DrawingML <a:custGeom>. Segments are in
 * `viewBox` space; they are scaled into the GEOM_SPACE×GEOM_SPACE path space,
 * which DrawingML then maps onto the shape's extents.
 */
export function customGeometryOoxml(
  segments: PathSeg[],
  viewBox: { w: number; h: number },
  filled: boolean
): string {
  const sx = GEOM_SPACE / viewBox.w;
  const sy = GEOM_SPACE / viewBox.h;

  const parts: string[] = [];
  for (const seg of segments) {
    switch (seg.type) {
      case "M":
        parts.push(`<a:moveTo>${pt(seg.x, seg.y, sx, sy)}</a:moveTo>`);
        break;
      case "L":
        parts.push(`<a:lnTo>${pt(seg.x, seg.y, sx, sy)}</a:lnTo>`);
        break;
      case "C":
        parts.push(
          `<a:cubicBezTo>${pt(seg.x1, seg.y1, sx, sy)}${pt(seg.x2, seg.y2, sx, sy)}${pt(seg.x, seg.y, sx, sy)}</a:cubicBezTo>`
        );
        break;
      case "Q":
        parts.push(`<a:quadBezTo>${pt(seg.x1, seg.y1, sx, sy)}${pt(seg.x, seg.y, sx, sy)}</a:quadBezTo>`);
        break;
      case "Z":
        parts.push(`<a:close/>`);
        break;
    }
  }

  const fillAttr = filled ? "" : ' fill="none"';
  return (
    `<a:custGeom>` +
    `<a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/>` +
    `<a:rect l="0" t="0" r="${GEOM_SPACE}" b="${GEOM_SPACE}"/>` +
    `<a:pathLst><a:path w="${GEOM_SPACE}" h="${GEOM_SPACE}"${fillAttr}>${parts.join("")}</a:path></a:pathLst>` +
    `</a:custGeom>`
  );
}

/** Geometry block for a shape: custGeom if freeform-with-segments, else preset. */
function geometryOoxml(shape: ShapeName, box: { w: number; h: number }, radius: number | undefined, geometry: GeometrySpec | undefined): string {
  if (geometry?.segments && geometry.segments.length > 0) {
    return customGeometryOoxml(
      geometry.segments,
      geometry.viewBox ?? { w: 1, h: 1 },
      geometry.filled ?? false
    );
  }
  return shapePresetToOoxml(shape, box, radius ?? geometry?.cornerRadius, geometry?.adjust);
}

function dashAttr(dash: StrokeSpec["dash"]): string {
  switch (dash) {
    case "dash":
      return `<a:prstDash val="dash"/>`;
    case "dot":
      return `<a:prstDash val="sysDot"/>`;
    case "dashDot":
      return `<a:prstDash val="dashDot"/>`;
    case "solid":
    default:
      return `<a:prstDash val="solid"/>`;
  }
}

function arrowEnd(tag: "headEnd" | "tailEnd", head: StrokeSpec["headStart"]): string {
  if (!head || head === "none") return "";
  const typeMap: Record<string, string> = {
    triangle: "triangle",
    arrow: "arrow",
    stealth: "stealth",
    oval: "oval",
  };
  const type = typeMap[head] ?? "triangle";
  return `<a:${tag} type="${type}" w="med" len="med"/>`;
}

export function strokeToOoxml(stroke: StrokeSpec | undefined): string {
  if (!stroke) return "";
  const w = lineWidthToEmu(stroke.width);
  const cap = stroke.round ? "rnd" : "flat";
  const fill = `<a:solidFill>${srgbClr(stroke.color, stroke.opacity)}</a:solidFill>`;
  const dash = dashAttr(stroke.dash);
  const join = stroke.round ? `<a:round/>` : "";
  const heads = arrowEnd("headEnd", stroke.headStart) + arrowEnd("tailEnd", stroke.headEnd);
  // join element must precede dash/heads per CT_LineProperties ordering.
  return `<a:ln w="${w}" cap="${cap}">${fill}${dash}${join}${heads}</a:ln>`;
}

export interface ShapeRenderCtx {
  /** numeric cNvPr id (unique within the slide) */
  id: number;
  name: string;
}

export function shapeElementXml(el: ShapeElement, ctx: ShapeRenderCtx): string {
  const geom = geometryOoxml(el.shape, el.box, el.style.radius, el.geometry);
  const fill = fillToOoxml(el.style.fill);
  const ln = strokeToOoxml(el.style.stroke);
  const effect = shadowToOoxml(el.style.shadow);

  const spPr =
    `<p:spPr>` +
    xfrm(el.box, el.rotation) +
    geom +
    fill +
    ln +
    effect +
    `</p:spPr>`;

  // Optional inline text (e.g. step number badge).
  const body = el.text
    ? txBody(el.text, el.textStyle ?? { size: 12, align: "center", vAlign: "middle" }, { padding: 0.02 })
    : `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>`;

  return (
    `<p:sp>` +
    `<p:nvSpPr><p:cNvPr id="${ctx.id}" name="${escapeXml(ctx.name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    spPr +
    body +
    `</p:sp>`
  );
}

export function lineElementXml(el: LineElement, ctx: ShapeRenderCtx): string {
  const x = Math.min(el.from.x, el.to.x);
  const y = Math.min(el.from.y, el.to.y);
  const w = Math.abs(el.to.x - el.from.x);
  const h = Math.abs(el.to.y - el.from.y);
  const flipH = el.from.x > el.to.x;
  const flipV = el.from.y > el.to.y;

  const flips = `${flipH ? ' flipH="1"' : ""}${flipV ? ' flipV="1"' : ""}`;
  const xfrmLine =
    `<a:xfrm${flips}>` +
    `<a:off x="${emu(x)}" y="${emu(y)}"/>` +
    `<a:ext cx="${emu(w)}" cy="${emu(h)}"/>` +
    `</a:xfrm>`;
  const ln = strokeToOoxml(el.stroke);

  return (
    `<p:cxnSp>` +
    `<p:nvCxnSpPr><p:cNvPr id="${ctx.id}" name="${escapeXml(ctx.name)}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` +
    `<p:spPr>${xfrmLine}<a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom>${ln}</p:spPr>` +
    `</p:cxnSp>`
  );
}

/** Build a standalone text box <p:sp> (no geometry fill unless provided). */
export function textBoxXml(
  opts: {
    box: { x: number; y: number; w: number; h: number };
    rotation?: number;
    text: string;
    style: import("../../core/types.js").TextStyle;
    padding?: number;
    fill?: import("../../core/types.js").FillSpec;
    stroke?: StrokeSpec;
    noWrap?: boolean;
    linkRId?: string;
  },
  ctx: ShapeRenderCtx
): string {
  const fill = opts.fill ? fillToOoxml(opts.fill) : `<a:noFill/>`;
  const ln = opts.stroke ? strokeToOoxml(opts.stroke) : "";
  const spPr =
    `<p:spPr>` +
    xfrm(opts.box, opts.rotation) +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    fill +
    ln +
    `</p:spPr>`;
  const body = txBody(opts.text, opts.style, { padding: opts.padding, wrap: opts.noWrap ? false : undefined, linkRId: opts.linkRId });
  // Mark as a text box so PowerPoint treats it as one.
  return (
    `<p:sp>` +
    `<p:nvSpPr><p:cNvPr id="${ctx.id}" name="${escapeXml(ctx.name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    spPr +
    body +
    `</p:sp>`
  );
}

/** Build an embedded picture <p:pic> referencing media via relationship `rId`. */
export function picXml(
  opts: {
    box: { x: number; y: number; w: number; h: number };
    rotation?: number;
    fit?: "cover" | "contain";
    radius?: number;
    alt?: string;
    dims?: { w: number; h: number } | null;
  },
  ctx: ShapeRenderCtx,
  rId: string
): string {
  // "cover": crop the overflowing dimension (srcRect) so the image fills the box
  // without distortion. Needs the image's pixel dimensions.
  let srcRect = "";
  if ((opts.fit ?? "cover") === "cover" && opts.dims && opts.dims.w > 0 && opts.dims.h > 0) {
    const boxAR = opts.box.w / opts.box.h;
    const imgAR = opts.dims.w / opts.dims.h;
    if (imgAR > boxAR) {
      const p = Math.round(((1 - boxAR / imgAR) / 2) * 100000);
      srcRect = `<a:srcRect l="${p}" r="${p}"/>`;
    } else if (imgAR < boxAR) {
      const p = Math.round(((1 - imgAR / boxAR) / 2) * 100000);
      srcRect = `<a:srcRect t="${p}" b="${p}"/>`;
    }
  }
  const geom = opts.radius
    ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${roundRectAdj(opts.radius, opts.box.w, opts.box.h)}"/></a:avLst></a:prstGeom>`
    : `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`;
  return (
    `<p:pic>` +
    `<p:nvPicPr><p:cNvPr id="${ctx.id}" name="${escapeXml(ctx.name)}" descr="${escapeXml(opts.alt ?? "")}"/><p:cNvPicPr><a:picLocks noChangeAspect="0"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip r:embed="${rId}"/>${srcRect}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>${xfrm(opts.box, opts.rotation)}${geom}</p:spPr>` +
    `</p:pic>`
  );
}
