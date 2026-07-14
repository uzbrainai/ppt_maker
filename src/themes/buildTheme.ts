/**
 * Build a full Theme from a compact 5-role palette + an appearance (light/dark).
 *
 * The author/LLM only picks five colors — Text, Background, Primary, Secondary,
 * Accent — for each mode. Everything else (muted text, surfaces, borders,
 * shadows, the typography scale) is derived here so both modes stay coherent and
 * readable. This is what makes "one theme, two modes" a single small input.
 */

import type { Appearance, Theme, ThemeColors, ThemePalette, ShadowSpec } from "../core/types.js";
import { mix, luminance } from "../core/color.js";

function shadowSet(dark: boolean): Theme["shadows"] {
  const color = "#000000";
  const none: ShadowSpec = { enabled: false, blur: 0, distance: 0, direction: 90, color, opacity: 0 };
  if (dark) {
    return {
      none,
      soft: { enabled: true, blur: 8, distance: 2, direction: 90, color, opacity: 0.4 },
      md: { enabled: true, blur: 14, distance: 5, direction: 90, color, opacity: 0.5 },
      lg: { enabled: true, blur: 22, distance: 8, direction: 90, color, opacity: 0.6 },
    };
  }
  const ink = "#0F172A";
  return {
    none,
    soft: { enabled: true, blur: 6, distance: 2, direction: 90, color: ink, opacity: 0.12 },
    md: { enabled: true, blur: 10, distance: 4, direction: 90, color: ink, opacity: 0.18 },
    lg: { enabled: true, blur: 18, distance: 7, direction: 90, color: ink, opacity: 0.24 },
  };
}

export function deriveColors(p: ThemePalette, appearance: Appearance): ThemeColors {
  const dark = appearance === "dark";
  return {
    background: p.background,
    backgroundMuted: dark ? mix(p.background, p.text, 0.07) : mix(p.background, p.secondary, 0.6),
    text: p.text,
    textMuted: mix(p.text, p.background, 0.42),
    // In dark mode lift the background toward the text for visible cards; in
    // light mode cards are white (or the background if it's already light).
    surface: dark ? mix(p.background, p.text, 0.08) : luminance(p.background) > 0.9 ? "#FFFFFF" : mix(p.background, "#FFFFFF", 0.6),
    surfaceMuted: p.secondary,
    primary: p.primary,
    primaryDark: mix(p.primary, "#000000", 0.22),
    accent: p.accent,
    border: dark ? mix(p.background, p.text, 0.2) : mix(p.background, p.text, 0.14),
    success: dark ? "#22C55E" : "#16A34A",
    warning: dark ? "#FBBF24" : "#D97706",
    danger: dark ? "#F87171" : "#DC2626",
  };
}

export function buildTheme(name: string, palette: ThemePalette, appearance: Appearance): Theme {
  const dark = appearance === "dark";
  const c = deriveColors(palette, appearance);
  const bodyColor = mix(c.text, c.background, 0.18);

  return {
    name,
    colors: c,
    fonts: {
      heading: "Segoe UI Semibold",
      body: "Segoe UI",
      mono: "Consolas",
    },
    typography: {
      h1: { size: 40, bold: true, color: c.text, lineSpacing: 1.05 },
      h2: { size: 26, bold: true, color: c.text, lineSpacing: 1.1 },
      body: { size: 14, color: bodyColor, lineSpacing: 1.15 },
      bodyStrong: { size: 14, bold: true, color: c.text, lineSpacing: 1.15 },
      caption: { size: 11, color: c.textMuted, lineSpacing: 1.1 },
      kpi: { size: 32, bold: true, color: c.primary, lineSpacing: 1 },
    },
    spacing: { xs: 0.08, sm: 0.16, md: 0.28, lg: 0.45, xl: 0.7 },
    radius: { sm: 0.06, md: 0.12, lg: 0.2, xl: 0.32, pill: 1.5 },
    shadows: shadowSet(dark),
  };
}
