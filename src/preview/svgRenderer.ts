/**
 * PPTScene → SVG preview renderer.
 *
 * This is a debugging aid, NOT the product output. It approximates shapes,
 * gradients, shadows and text so a developer can eyeball layout without opening
 * PowerPoint. Slides are stacked vertically.
 */

import type {
  Box,
  FillSpec,
  LineElement,
  PathSeg,
  PPTElement,
  PPTScene,
  PPTSlide,
  ShapeElement,
  ShapeName,
  TextElement,
  TextStyle,
} from "../core/types.js";
import { escapeXml } from "../core/xml.js";
import { normalizeHex } from "../core/color.js";
import { buildIcon } from "../geometry/icons.js";

const PX_PER_INCH = 96;
const SLIDE_GAP = 24; // px between stacked slides

function px(inches: number): number {
  return Math.round(inches * PX_PER_INCH * 100) / 100;
}

let gradId = 0;
// When true, text is not drawn — used to render editable slide backgrounds that
// the web editor overlays with live, editable text boxes.
let skipText = false;

interface RenderState {
  defs: string[];
  /** vertical offset (px) for the current slide */
  oy: number;
}

function fillRef(fill: FillSpec | undefined, box: Box, state: RenderState): string {
  if (!fill || fill.type === "none") return "none";
  if (fill.type === "solid") {
    return `#${normalizeHex(fill.color)}`;
  }
  if (fill.type === "pattern") {
    // Preview approximates a pattern fill with its background color.
    return `#${normalizeHex(fill.bg)}`;
  }
  gradId += 1;
  const id = `g${gradId}`;
  if (fill.type === "linearGradient") {
    // angle: 0 = left→right, 90 = top→bottom
    const rad = (fill.angle * Math.PI) / 180;
    const x2 = 0.5 + Math.cos(rad) * 0.5;
    const y2 = 0.5 + Math.sin(rad) * 0.5;
    const x1 = 0.5 - Math.cos(rad) * 0.5;
    const y1 = 0.5 - Math.sin(rad) * 0.5;
    const stops = fill.stops
      .map(
        (s) =>
          `<stop offset="${Math.round(s.pos * 100)}%" stop-color="#${normalizeHex(s.color)}" stop-opacity="${s.opacity ?? 1}"/>`
      )
      .join("");
    state.defs.push(
      `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`
    );
    return `url(#${id})`;
  }
  // radial
  const stops = fill.stops
    .map(
      (s) =>
        `<stop offset="${Math.round(s.pos * 100)}%" stop-color="#${normalizeHex(s.color)}" stop-opacity="${s.opacity ?? 1}"/>`
    )
    .join("");
  state.defs.push(
    `<radialGradient id="${id}" cx="${(fill.cx ?? 0.5) * 100}%" cy="${(fill.cy ?? 0.5) * 100}%" r="${(fill.r ?? 0.5) * 100}%">${stops}</radialGradient>`
  );
  void box;
  return `url(#${id})`;
}

function fillOpacity(fill: FillSpec | undefined): number {
  if (fill && fill.type === "solid" && fill.opacity !== undefined) return fill.opacity;
  return 1;
}

function shapePath(shape: ShapeName, b: Box): { tag: "rect" | "ellipse" | "polygon"; attrs: string } {
  const x = px(b.x);
  const y = px(b.y);
  const w = px(b.w);
  const h = px(b.h);
  const poly = (pts: Array<[number, number]>) =>
    pts.map(([rx, ry]) => `${px(b.x + rx * b.w)},${px(b.y + ry * b.h)}`).join(" ");

  switch (shape) {
    case "ellipse":
      return { tag: "ellipse", attrs: `cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"` };
    case "triangle":
      return { tag: "polygon", attrs: `points="${poly([[0.5, 0], [1, 1], [0, 1]])}"` };
    case "diamond":
      return { tag: "polygon", attrs: `points="${poly([[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]])}"` };
    case "parallelogram":
      return { tag: "polygon", attrs: `points="${poly([[0.25, 0], [1, 0], [0.75, 1], [0, 1]])}"` };
    case "hexagon":
      return { tag: "polygon", attrs: `points="${poly([[0.25, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0.25, 1], [0, 0.5]])}"` };
    case "pentagon":
      return { tag: "polygon", attrs: `points="${poly([[0.5, 0], [1, 0.38], [0.81, 1], [0.19, 1], [0, 0.38]])}"` };
    case "chevron":
      return { tag: "polygon", attrs: `points="${poly([[0, 0], [0.75, 0], [1, 0.5], [0.75, 1], [0, 1], [0.25, 0.5]])}"` };
    case "rightArrow":
      return { tag: "polygon", attrs: `points="${poly([[0, 0.3], [0.6, 0.3], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.7], [0, 0.7]])}"` };
    case "leftRightArrow":
      return { tag: "polygon", attrs: `points="${poly([[0, 0.5], [0.25, 0.2], [0.25, 0.38], [0.75, 0.38], [0.75, 0.2], [1, 0.5], [0.75, 0.8], [0.75, 0.62], [0.25, 0.62], [0.25, 0.8]])}"` };
    case "rect":
    case "roundRect":
    case "freeform":
    default:
      return { tag: "rect", attrs: `x="${x}" y="${y}" width="${w}" height="${h}"` };
  }
}

function renderShape(el: ShapeElement, state: RenderState): string {
  const fill = fillRef(el.style.fill, el.box, state);
  const fo = fillOpacity(el.style.fill) * (el.style.opacity ?? 1);
  const stroke = el.style.stroke;
  const lineCap = stroke?.round ? ' stroke-linecap="round" stroke-linejoin="round"' : "";
  const strokeAttrs = stroke
    ? `stroke="#${normalizeHex(stroke.color)}" stroke-width="${stroke.width}"${lineCap} ${stroke.dash === "dash" ? 'stroke-dasharray="6 4"' : ""}`
    : `stroke="none"`;
  const shadow = el.style.shadow?.enabled
    ? ` filter="url(#softshadow)"`
    : "";

  // Freeform geometry (e.g. lucide icon paths) → an SVG <path>.
  if (el.shape === "freeform" && el.geometry?.segments?.length) {
    const d = segmentsToSvgPath(el.geometry.segments, el.box, el.geometry.viewBox ?? { w: 1, h: 1 });
    return `<path d="${d}" fill="${el.geometry.filled ? fill : "none"}" fill-opacity="${fo}" ${strokeAttrs}${shadow}/>`;
  }

  const { tag, attrs } = shapePath(el.shape, el.box);
  const rx =
    el.shape === "roundRect" && el.style.radius
      ? ` rx="${px(Math.min(el.style.radius, Math.min(el.box.w, el.box.h) / 2))}"`
      : "";

  let out = `<${tag} ${attrs}${rx} fill="${fill}" fill-opacity="${fo}" ${strokeAttrs}${shadow}/>`;

  if (el.text && !skipText) {
    out += renderTextBlock(el.text, el.box, el.textStyle ?? { size: 12, align: "center", vAlign: "middle" });
  }
  return out;
}

function renderTextBlock(text: string, box: Box, style: TextStyle): string {
  const align = style.align ?? "left";
  const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
  const tx = align === "center" ? px(box.x + box.w / 2) : align === "right" ? px(box.x + box.w) - 4 : px(box.x) + 4;
  const sizePx = style.size * (PX_PER_INCH / 72);
  const lineH = sizePx * (style.lineSpacing ?? 1.15);

  // naive wrap by character estimate
  const charsPerLine = Math.max(1, Math.floor((px(box.w) - 8) / (sizePx * 0.52)));
  const lines = wrap(text, charsPerLine);
  const totalH = lines.length * lineH;
  let startY: number;
  if (style.vAlign === "middle") startY = px(box.y + box.h / 2) - totalH / 2 + sizePx * 0.8;
  else if (style.vAlign === "bottom") startY = px(box.y + box.h) - totalH + sizePx * 0.8;
  else startY = px(box.y) + sizePx * 0.9;

  const color = style.color ? `#${normalizeHex(style.color)}` : "#111827";
  const weight = style.bold ? "700" : "400";
  const fontStyle = style.italic ? "italic" : "normal";
  const family = style.font ? escapeXml(style.font) : "Segoe UI, Arial, sans-serif";

  const tspans = lines
    .map((ln, i) => `<tspan x="${tx}" y="${Math.round(startY + i * lineH)}">${escapeXml(ln)}</tspan>`)
    .join("");
  return `<text text-anchor="${anchor}" font-size="${Math.round(sizePx)}" font-weight="${weight}" font-style="${fontStyle}" font-family="${family}" fill="${color}">${tspans}</text>`;
}

function segmentsToSvgPath(segments: PathSeg[], box: Box, viewBox: { w: number; h: number }): string {
  const mapX = (v: number) => round(px(box.x + (v / viewBox.w) * box.w));
  const mapY = (v: number) => round(px(box.y + (v / viewBox.h) * box.h));
  const parts: string[] = [];
  for (const s of segments) {
    switch (s.type) {
      case "M":
        parts.push(`M${mapX(s.x)} ${mapY(s.y)}`);
        break;
      case "L":
        parts.push(`L${mapX(s.x)} ${mapY(s.y)}`);
        break;
      case "C":
        parts.push(`C${mapX(s.x1)} ${mapY(s.y1)} ${mapX(s.x2)} ${mapY(s.y2)} ${mapX(s.x)} ${mapY(s.y)}`);
        break;
      case "Q":
        parts.push(`Q${mapX(s.x1)} ${mapY(s.y1)} ${mapX(s.x)} ${mapY(s.y)}`);
        break;
      case "Z":
        parts.push("Z");
        break;
    }
  }
  return parts.join(" ");
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function renderText(el: TextElement, state: RenderState): string {
  let bg = "";
  if (el.fill && el.fill.type !== "none") {
    const fill = fillRef(el.fill, el.box, state);
    bg = `<rect x="${px(el.box.x)}" y="${px(el.box.y)}" width="${px(el.box.w)}" height="${px(el.box.h)}" fill="${fill}"/>`;
  }
  return bg + (skipText ? "" : renderTextBlock(el.text, el.box, el.style));
}

function renderLine(el: LineElement): string {
  const s = el.stroke;
  const marker = s.headEnd && s.headEnd !== "none" ? ` marker-end="url(#arrow)"` : "";
  const markerStart = s.headStart && s.headStart !== "none" ? ` marker-start="url(#arrow)"` : "";
  return `<line x1="${px(el.from.x)}" y1="${px(el.from.y)}" x2="${px(el.to.x)}" y2="${px(el.to.y)}" stroke="#${normalizeHex(s.color)}" stroke-width="${s.width}"${marker}${markerStart}/>`;
}

function renderElement(el: PPTElement, state: RenderState): string {
  switch (el.type) {
    case "shape":
      return renderShape(el, state);
    case "text":
      return renderText(el, state);
    case "line":
      return renderLine(el);
    case "icon": {
      const { elements } = buildIcon(el.name, el.box, {
        color: el.style.color,
        strokeWidth: el.style.strokeWidth,
        variant: el.style.variant,
      });
      return elements.map((c) => renderElement(c, state)).join("");
    }
    case "image": {
      const mime = el.data[0] === 0xff && el.data[1] === 0xd8 ? "image/jpeg" : "image/png";
      const par = (el.fit ?? "cover") === "cover" ? "xMidYMid slice" : "xMidYMid meet";
      return `<image href="data:${mime};base64,${el.data.toString("base64")}" x="${px(el.box.x)}" y="${px(el.box.y)}" width="${px(el.box.w)}" height="${px(el.box.h)}" preserveAspectRatio="${par}"/>`;
    }
    case "group":
      return el.children.map((c) => renderElement(c, state)).join("");
  }
}

function renderSlide(slide: PPTSlide, size: { width: number; height: number }, state: RenderState): string {
  const w = px(size.width);
  const h = px(size.height);
  const border = `<rect x="0" y="0" width="${w}" height="${h}" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1"/>`;
  const body = slide.elements.map((el) => renderElement(el, state)).join("");
  return `<g transform="translate(0, ${state.oy})">${border}${body}</g>`;
}

function wrap(text: string, charsPerLine: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const word of words) {
      if (cur.length === 0) cur = word;
      else if (cur.length + 1 + word.length <= charsPerLine) cur += " " + word;
      else {
        out.push(cur);
        cur = word;
      }
    }
    out.push(cur);
  }
  return out.length ? out : [""];
}

export function renderSceneSvg(scene: PPTScene): string {
  gradId = 0;
  const slideW = px(scene.size.width);
  const slideH = px(scene.size.height);
  const totalH = scene.slides.length * slideH + (scene.slides.length - 1) * SLIDE_GAP;

  const state: RenderState = { defs: [], oy: 0 };
  const slideSvgs: string[] = [];
  scene.slides.forEach((slide, i) => {
    state.oy = i * (slideH + SLIDE_GAP);
    slideSvgs.push(renderSlide(slide, scene.size, state));
  });

  const defs =
    `<defs>` +
    `<filter id="softshadow" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.18"/>` +
    `</filter>` +
    `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/>` +
    `</marker>` +
    state.defs.join("") +
    `</defs>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${slideW}" height="${totalH}" viewBox="0 0 ${slideW} ${totalH}" font-family="Segoe UI, Arial, sans-serif">` +
    `<rect x="0" y="0" width="${slideW}" height="${totalH}" fill="#E5E7EB"/>` +
    defs +
    slideSvgs.join("") +
    `</svg>`
  );
}

const PREVIEW_DEFS =
  `<filter id="softshadow" x="-20%" y="-20%" width="140%" height="140%">` +
  `<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.18"/>` +
  `</filter>` +
  `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
  `<path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/>` +
  `</marker>`;

/**
 * Render each slide as its own standalone SVG (width × height of one slide).
 * Used for slide-by-slide previews in the web UI.
 */
export function renderSlideSvgs(scene: PPTScene, opts: { omitText?: boolean } = {}): string[] {
  const slideW = px(scene.size.width);
  const slideH = px(scene.size.height);
  skipText = !!opts.omitText;
  try {
    return scene.slides.map((slide) => {
      gradId = 0;
      const state: RenderState = { defs: [], oy: 0 };
      const body = renderSlide(slide, scene.size, state);
      const defs = `<defs>${PREVIEW_DEFS}${state.defs.join("")}</defs>`;
      return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${slideW}" height="${slideH}" viewBox="0 0 ${slideW} ${slideH}" font-family="Segoe UI, Arial, sans-serif">` +
        defs +
        body +
        `</svg>`
      );
    });
  } finally {
    skipText = false;
  }
}
