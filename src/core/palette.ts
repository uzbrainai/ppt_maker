/**
 * Color palette tool — "the right tool to choose the right colors".
 *
 * The palette is ALWAYS derived from the active theme, so every multi-color
 * surface (charts, colorful cards, kpi, summary, gauge rings, icons) stays on
 * brand. Two strategies:
 *   - THEME palette (default): anchored on the theme's own brand colors
 *     (primary, accent) and extended with hue-rotated variants that share the
 *     theme's saturation/lightness band — distinct but tonally consistent;
 *   - GENERATED palette from an explicit base color (used for single-accent
 *     intensity scales), rotating hue in the same pleasant band.
 *
 * All colors are returned as #RRGGBB and adapt brightness to the theme so they
 * stay legible on dark backgrounds.
 */

import type { ResolvedTheme } from "./types.js";
import { hexToHsl, hslToHex, luminance } from "./color.js";

function isDarkTheme(theme: ResolvedTheme): boolean {
  return luminance(theme.colors.background) < 0.4;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Normalize to #RRGGBB and drop blanks / near-duplicates. */
function uniqueHexes(colors: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of colors) {
    if (!c) continue;
    const k = c.trim().toUpperCase();
    if (!/^#?[0-9A-F]{6}$/.test(k)) continue;
    const hex = k.startsWith("#") ? k : `#${k}`;
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
  }
  return out;
}

/** Ensure a leading "#": hslToHex/rgbToHex return bare RRGGBB. */
function withHash(hex: string): string {
  return hex.startsWith("#") ? hex : `#${hex}`;
}

/** Generate `n` colors by rotating hue around a base color. */
export function generatePalette(base: string, n: number, dark: boolean): string[] {
  const { h, s, l } = hexToHsl(base);
  const sat = Math.min(0.85, Math.max(0.45, s));
  const lig = dark ? Math.min(0.7, Math.max(0.55, l)) : Math.min(0.55, Math.max(0.4, l));
  const out: string[] = [];
  // Golden-angle-ish spacing keeps adjacent colors distinct.
  const step = 360 / Math.max(3, n);
  for (let i = 0; i < n; i++) {
    out.push(withHash(hslToHex({ h: h + i * step * 1.0, s: sat, l: lig })));
  }
  return out;
}

/**
 * Build `n` theme-anchored colors: the brand colors first (so a deck leads with
 * its identity), then hue-rotated variants derived from the primary that keep
 * the theme's saturation/lightness band — so extra categories read as part of
 * the same palette rather than a foreign rainbow.
 */
export function themePalette(theme: ResolvedTheme, n: number): string[] {
  const dark = isDarkTheme(theme);
  const c = theme.colors;
  const anchors = uniqueHexes([c.primary, c.accent]);
  if (n <= anchors.length) return anchors.slice(0, Math.max(1, n));

  const { h, s, l } = hexToHsl(anchors[0] ?? c.primary);
  const sat = clamp(s, 0.4, 0.85);
  const lig = dark ? clamp(l, 0.52, 0.72) : clamp(l, 0.36, 0.56);
  const out = [...anchors];
  const need = n - anchors.length;
  // Spread the remaining hues across the wheel, offset from the primary hue so
  // they don't collide with the anchors.
  for (let i = 0; i < need; i++) {
    const hue = h + 40 + i * (300 / need);
    out.push(withHash(hslToHex({ h: hue, s: sat, l: lig })));
  }
  return out;
}

/**
 * Return a palette of at least `n` colors for the given theme. When `base` is
 * provided the palette is generated from it; otherwise it is anchored on the
 * theme's brand colors.
 */
export function palette(theme: ResolvedTheme, n: number, base?: string): string[] {
  if (base) return generatePalette(base, n, isDarkTheme(theme));
  return themePalette(theme, n);
}

/** A single color from the curated/generated palette at index `i`. */
export function paletteColor(theme: ResolvedTheme, i: number, base?: string): string {
  const p = palette(theme, Math.max(8, i + 1), base);
  return p[i % p.length];
}
