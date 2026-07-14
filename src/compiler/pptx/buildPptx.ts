/**
 * Compile a PPTScene into a .pptx package (a ZIP of OOXML parts) using jszip.
 */

import JSZip from "jszip";
import type { PPTScene } from "../../core/types.js";
import { buildParts } from "./parts.js";

export interface BuildOptions {
  /** deck title written to docProps/core.xml */
  title?: string;
}

/** Build the raw OOXML parts (useful for tests / debugging). XML parts are
 * strings; embedded media are Buffers. */
export function compileScene(scene: PPTScene, opts: BuildOptions = {}): Record<string, string | Buffer> {
  return buildParts(scene, opts.title);
}

/** Build a .pptx as a Node Buffer. */
export async function buildPptxBuffer(scene: PPTScene, opts: BuildOptions = {}): Promise<Buffer> {
  const parts = buildParts(scene, opts.title);
  const zip = new JSZip();

  // [Content_Types].xml must be stored at the archive root (it is, by path).
  for (const [path, content] of Object.entries(parts)) {
    zip.file(path, content);
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}
