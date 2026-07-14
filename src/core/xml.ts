/**
 * Minimal XML string-building helpers. We build OOXML by hand (no DOM) to keep
 * the dependency surface small and to make the generated parts easy to read.
 */

/** Escape text content / attribute values for XML. */
export function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type Attrs = Record<string, string | number | boolean | undefined | null>;

/** Render an attribute map to a string (leading space included when non-empty). */
export function attrs(map: Attrs): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined || v === null || v === false) continue;
    if (v === true) {
      parts.push(`${k}="1"`);
    } else {
      parts.push(`${k}="${escapeXml(String(v))}"`);
    }
  }
  return parts.length ? " " + parts.join(" ") : "";
}

/** Self-closing or container tag. Children may be a string or array of strings. */
export function tag(
  name: string,
  attributes: Attrs = {},
  children?: string | string[]
): string {
  const a = attrs(attributes);
  if (children === undefined) {
    return `<${name}${a}/>`;
  }
  const body = Array.isArray(children) ? children.join("") : children;
  return `<${name}${a}>${body}</${name}>`;
}

export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n';

/** Join non-empty XML fragments. */
export function frag(...parts: Array<string | undefined | null | false>): string {
  return parts.filter(Boolean).join("");
}
