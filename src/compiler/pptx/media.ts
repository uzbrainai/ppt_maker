/**
 * Binary media (images) for the pptx package. Images are deduped by content
 * hash and assigned ppt/media/imageN.<ext> paths; the slide that uses one gets
 * an internal relationship to it (see relationships.ts / slideXml.ts).
 */

import { createHash } from "crypto";

export interface MediaItem {
  path: string;
  data: Buffer;
}

export class MediaRegistry {
  private byHash = new Map<string, string>();
  readonly items: MediaItem[] = [];

  /** Add image bytes (dedup by hash); returns the package path. */
  add(data: Buffer, ext = "png"): string {
    const h = createHash("sha1").update(data).digest("hex");
    const found = this.byHash.get(h);
    if (found) return found;
    const path = `ppt/media/image${this.items.length + 1}.${ext}`;
    this.byHash.set(h, path);
    this.items.push({ path, data });
    return path;
  }
}

/** Read pixel width/height from a PNG (IHDR) or JPEG; null if unknown. */
export function imageSize(b: Buffer): { w: number; h: number } | null {
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  // Minimal JPEG SOF scan.
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** Extension from magic bytes (png default). */
export function imageExt(b: Buffer): "png" | "jpeg" {
  return b.length > 1 && b[0] === 0xff && b[1] === 0xd8 ? "jpeg" : "png";
}
