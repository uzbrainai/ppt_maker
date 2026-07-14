/**
 * Color helpers. PowerPoint uses 6-digit uppercase hex (no #) for sRGB colors
 * and integer "thousandths of a percent" (0..100000) for alpha and tint/shade.
 */

/** Strip "#", expand shorthand, validate, and return 6 uppercase hex digits. */
export function normalizeHex(input: string): string {
  let hex = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    // Fall back to a neutral gray rather than emitting invalid OOXML.
    return "808080";
  }
  return hex.toUpperCase();
}

/** Color string → OOXML srgbClr value (6 uppercase hex digits, no #). */
export function rgbHexToOoxml(color: string): string {
  return normalizeHex(color);
}

/** opacity 0..1 → OOXML alpha value (0..100000). Clamped. */
export function alphaToOoxml(opacity: number | undefined): number {
  const a = opacity === undefined ? 1 : opacity;
  return Math.round(clamp01(a) * 100000);
}

/** gradient angle in degrees → OOXML 60000ths of a degree (0..21600000). */
export function angleToOoxml(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return Math.round(d * 60000);
}

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return (c(r) + c(g) + c(b)).toUpperCase();
}

/**
 * Lighten a color toward white by amount 0..1 (tint).
 * amount 0 = unchanged, 1 = white.
 */
export function tint(color: string, amount: number): string {
  const a = clamp01(amount);
  const { r, g, b } = hexToRgb(color);
  return rgbToHex({
    r: r + (255 - r) * a,
    g: g + (255 - g) * a,
    b: b + (255 - b) * a,
  });
}

/**
 * Darken a color toward black by amount 0..1 (shade).
 * amount 0 = unchanged, 1 = black.
 */
export function shade(color: string, amount: number): string {
  const a = clamp01(amount);
  const { r, g, b } = hexToRgb(color);
  return rgbToHex({ r: r * (1 - a), g: g * (1 - a), b: b * (1 - a) });
}

/** Mix two colors; t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const tt = clamp01(t);
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * tt,
    g: ca.g + (cb.g - ca.g) * tt,
    b: ca.b + (cb.b - ca.b) * tt,
  });
}

export interface Hsl {
  h: number; // 0..360
  s: number; // 0..1
  l: number; // 0..1
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/** Relative luminance (0..1), used to choose readable text colors. */
export function luminance(color: string): number {
  const { r, g, b } = hexToRgb(color);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Pick black or white (whichever contrasts better) for text over `bg`. */
export function readableTextColor(bg: string, dark = "111827", light = "FFFFFF"): string {
  return luminance(bg) > 0.5 ? dark : light;
}

/** WCAG-style contrast ratio between two colors (1..21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export interface ReadableSet {
  /** highest-contrast color for headings */
  strong: string;
  /** slightly softened body color, still clearly readable */
  soft: string;
  /** muted/caption color that still passes a reasonable contrast */
  faint: string;
}

/**
 * Readable text colors for content placed on background `bg`. This is THE place
 * that decides foreground colors — callers must not hardcode text colors that
 * could collide with the background (e.g. dark text on a blue cover).
 */
export function readableOn(bg: string): ReadableSet {
  const dark = luminance(bg) < 0.5;
  if (dark) {
    return { strong: "#FFFFFF", soft: "#E7ECF3", faint: "#C2CCDA" };
  }
  return { strong: "#0F172A", soft: "#334155", faint: "#64748B" };
}

/**
 * Ensure `fg` is readable on `bg`; if the contrast is too low, fall back to the
 * best black/white. Use for accent-colored text over arbitrary surfaces.
 */
export function ensureReadable(fg: string, bg: string, min = 3): string {
  if (contrastRatio(fg, bg) >= min) return fg;
  return luminance(bg) > 0.5 ? "#0F172A" : "#FFFFFF";
}
