/**
 * Render one PPTSlide into a slide XML part.
 *
 * Z-order follows element array order. Groups are emitted as <p:grpSp> with a
 * 1:1 child coordinate space (children keep absolute inch coordinates).
 */

import type { PPTElement, PPTSlide, GroupElement } from "../../core/types.js";
import { XML_DECL } from "../../core/xml.js";
import { emu } from "../../core/units.js";
import {
  lineElementXml,
  shapeElementXml,
  textBoxXml,
  picXml,
  type ShapeRenderCtx,
} from "./ooxmlShape.js";
import { buildIcon } from "../../geometry/icons.js";
import { MediaRegistry, imageSize } from "./media.js";

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

class IdGen {
  private n = 1; // 1 is the spTree root group
  next(): number {
    this.n += 1;
    return this.n;
  }
}

/** A slide relationship: external hyperlink or internal media (image). */
export interface SlideRel {
  id: string;
  kind: "hyperlink" | "image";
  /** url for hyperlink; package path (ppt/media/..) for image */
  target: string;
}

/** Collects per-slide relationships. rId1 is the layout; these start at rId2. */
class RelCollector {
  readonly rels: SlideRel[] = [];
  private next(): string {
    return `rId${this.rels.length + 2}`;
  }
  addHyperlink(url: string): string {
    const id = this.next();
    this.rels.push({ id, kind: "hyperlink", target: url });
    return id;
  }
  addImage(path: string): string {
    const id = this.next();
    this.rels.push({ id, kind: "image", target: `../media/${path.split("/").pop()}` });
    return id;
  }
}

function renderElement(el: PPTElement, ids: IdGen, rels: RelCollector, media: MediaRegistry): string {
  switch (el.type) {
    case "shape": {
      const ctx: ShapeRenderCtx = { id: ids.next(), name: `${el.shape}-${el.id}` };
      return shapeElementXml(el, ctx);
    }
    case "text": {
      const ctx: ShapeRenderCtx = { id: ids.next(), name: `text-${el.id}` };
      return textBoxXml(
        {
          box: el.box,
          rotation: el.rotation,
          text: el.text,
          style: el.style,
          padding: el.padding,
          fill: el.fill,
          stroke: el.stroke,
          noWrap: el.noWrap,
          linkRId: el.link ? rels.addHyperlink(el.link) : undefined,
        },
        ctx
      );
    }
    case "line": {
      const ctx: ShapeRenderCtx = { id: ids.next(), name: `line-${el.id}` };
      return lineElementXml(el, ctx);
    }
    case "image": {
      const ctx: ShapeRenderCtx = { id: ids.next(), name: `image-${el.id}` };
      const path = media.add(el.data, el.data[0] === 0xff && el.data[1] === 0xd8 ? "jpeg" : "png");
      const rId = rels.addImage(path);
      return picXml({ box: el.box, rotation: el.rotation, fit: el.fit, radius: el.radius, alt: el.alt, dims: imageSize(el.data) }, ctx, rId);
    }
    case "icon": {
      // Late binding: an IconElement compiles to its editable child shapes.
      const { elements } = buildIcon(el.name, el.box, {
        color: el.style.color,
        strokeWidth: el.style.strokeWidth,
        variant: el.style.variant,
      });
      return elements.map((child) => renderElement(child, ids, rels, media)).join("");
    }
    case "group":
      return renderGroup(el, ids, rels, media);
  }
}

function renderGroup(group: GroupElement, ids: IdGen, rels: RelCollector, media: MediaRegistry): string {
  const id = ids.next();
  const off = `<a:off x="${emu(group.box.x)}" y="${emu(group.box.y)}"/>`;
  const ext = `<a:ext cx="${emu(group.box.w)}" cy="${emu(group.box.h)}"/>`;
  // 1:1 child coordinate space => children keep absolute inch coords.
  const chOff = `<a:chOff x="${emu(group.box.x)}" y="${emu(group.box.y)}"/>`;
  const chExt = `<a:chExt cx="${emu(group.box.w)}" cy="${emu(group.box.h)}"/>`;
  const children = group.children.map((c) => renderElement(c, ids, rels, media)).join("");
  return (
    `<p:grpSp>` +
    `<p:nvGrpSpPr><p:cNvPr id="${id}" name="group-${group.id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm>${off}${ext}${chOff}${chExt}</a:xfrm></p:grpSpPr>` +
    children +
    `</p:grpSp>`
  );
}

/**
 * Render a slide. `media` is the deck-wide image registry (deduped); the slide's
 * relationships (hyperlinks + images) are returned for its .rels part.
 */
export function renderSlideXml(slide: PPTSlide, media: MediaRegistry = new MediaRegistry()): { xml: string; rels: SlideRel[] } {
  const ids = new IdGen();
  const rels = new RelCollector();
  const body = slide.elements.map((el) => renderElement(el, ids, rels, media)).join("");

  const xml =
    XML_DECL +
    `<p:sld ${NS}>` +
    `<p:cSld>` +
    `<p:spTree>` +
    `<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
    `<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>` +
    body +
    `</p:spTree>` +
    `</p:cSld>` +
    `<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>` +
    `</p:sld>`;
  return { xml, rels: rels.rels };
}
