/**
 * Editable-text extraction + edit application for the web canvas editor.
 *
 * The web editor renders a text-less slide background (svgRenderer omitText) and
 * overlays the boxes returned by `extractEditables` as live, editable fields.
 * On save it sends back a { id → newText } map, which `applyTextEdits` writes
 * onto a clone of the scene before recompiling the .pptx. Only text strings
 * change — every shape, chart, icon and image is preserved exactly.
 */

import type { PPTElement, PPTScene, TextStyle } from "./types.js";
import { normalizeHex } from "./color.js";

export interface EditableText {
  id: string;
  text: string;
  /** box in inches (absolute on the slide) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** font size in points */
  sizePt: number;
  bold: boolean;
  italic: boolean;
  /** hex color like #RRGGBB */
  color: string;
  align: "left" | "center" | "right";
  vAlign: "top" | "middle" | "bottom";
  lineSpacing: number;
}

export interface SlideEditables {
  texts: EditableText[];
}

function toEditable(id: string, text: string, box: { x: number; y: number; w: number; h: number }, style: TextStyle): EditableText {
  return {
    id,
    text,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    sizePt: style.size ?? 12,
    bold: !!style.bold,
    italic: !!style.italic,
    color: style.color ? `#${normalizeHex(style.color)}` : "#111827",
    align: style.align ?? "left",
    vAlign: style.vAlign ?? "top",
    lineSpacing: style.lineSpacing ?? 1.15,
  };
}

function collect(el: PPTElement, out: EditableText[]): void {
  if (el.type === "text") {
    out.push(toEditable(el.id, el.text, el.box, el.style));
  } else if (el.type === "shape" && el.text) {
    out.push(toEditable(el.id, el.text, el.box, el.textStyle ?? { size: 12, align: "center", vAlign: "middle" }));
  } else if (el.type === "group") {
    el.children.forEach((c) => collect(c, out));
  }
}

/** One editable-text list per slide, in slide order. */
export function extractEditables(scene: PPTScene): SlideEditables[] {
  return scene.slides.map((slide) => {
    const texts: EditableText[] = [];
    slide.elements.forEach((el) => collect(el, texts));
    return { texts };
  });
}

function applyToElement(el: PPTElement, edits: Record<string, string>): void {
  if (el.type === "text") {
    if (el.id in edits) el.text = edits[el.id];
  } else if (el.type === "shape") {
    if (el.text !== undefined && el.id in edits) el.text = edits[el.id];
  } else if (el.type === "group") {
    el.children.forEach((c) => applyToElement(c, edits));
  }
}

/** Mutate a scene in place, replacing text on elements named in `edits`. */
export function applyTextEdits(scene: PPTScene, edits: Record<string, string>): void {
  scene.slides.forEach((slide) => slide.elements.forEach((el) => applyToElement(el, edits)));
}
