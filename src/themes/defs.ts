/**
 * Theme definitions as compact 5-role palettes, one per appearance.
 * `buildTheme` (see buildTheme.ts) expands these into full themes on demand.
 */

import type { ThemeDef } from "../core/types.js";

export const THEME_DEFS: Record<string, ThemeDef> = {
  "modern.enterprise": {
    name: "modern.enterprise",
    defaultAppearance: "light",
    light: { text: "#0F172A", background: "#FFFFFF", primary: "#2563EB", secondary: "#F1F5F9", accent: "#2563EB" },
    dark: { text: "#E7ECF3", background: "#0B1020", primary: "#3B82F6", secondary: "#111831", accent: "#60A5FA" },
  },

  "agrobank.ai": {
    name: "agrobank.ai",
    defaultAppearance: "light",
    light: { text: "#0B2818", background: "#FFFFFF", primary: "#15803D", secondary: "#ECF5EE", accent: "#16A34A" },
    dark: { text: "#E6F2EA", background: "#07140D", primary: "#22C55E", secondary: "#0E2418", accent: "#34D399" },
  },

  "dark.tech": {
    name: "dark.tech",
    defaultAppearance: "dark",
    light: { text: "#0B1020", background: "#FFFFFF", primary: "#0EA5E9", secondary: "#E2F4FD", accent: "#0891B2" },
    dark: { text: "#F8FAFC", background: "#0B1020", primary: "#38BDF8", secondary: "#161E36", accent: "#22D3EE" },
  },

  // The attached "electric indigo" theme — Text / Background / Primary /
  // Secondary / Accent in both modes.
  indigo: {
    name: "indigo",
    defaultAppearance: "light",
    light: { text: "#0B0B1A", background: "#FFFFFF", primary: "#3A36C9", secondary: "#D9DAF6", accent: "#4F46E5" },
    dark: { text: "#E7E9F8", background: "#06060F", primary: "#4F46E5", secondary: "#0B0B22", accent: "#3B3BE3" },
  },

  // Orchid on cool slate — pale steel-blue primary, deep-purple panels, an
  // orchid accent. (Dark mode is the supplied palette; light mode is derived.)
  amethyst: {
    name: "amethyst",
    defaultAppearance: "dark",
    light: { text: "#15121F", background: "#FFFFFF", primary: "#4A7588", secondary: "#E6E1F0", accent: "#8E4FAC" },
    dark: { text: "#ECF2F6", background: "#0D161B", primary: "#A6C5D4", secondary: "#4B366E", accent: "#965BB0" },
  },

  // Mint + electric blue on near-black green — a "northern lights" feel.
  // (Dark mode is the supplied palette; light mode is derived.)
  aurora: {
    name: "aurora",
    defaultAppearance: "dark",
    light: { text: "#06231A", background: "#FFFFFF", primary: "#0E9E73", secondary: "#DCE9F4", accent: "#3F77DE" },
    dark: { text: "#E7FCF5", background: "#02130C", primary: "#7AEFC7", secondary: "#135F9C", accent: "#4981E9" },
  },

  // Vivid purple / pink / orange on soft lavender — a bright, playful set.
  // (Light mode is the supplied palette; dark mode is derived.)
  sorbet: {
    name: "sorbet",
    defaultAppearance: "light",
    light: { text: "#0D0027", background: "#F3EBFF", primary: "#6109FF", secondary: "#FF698D", accent: "#FF753F" },
    dark: { text: "#F3EBFF", background: "#0B0420", primary: "#8B45FF", secondary: "#1C0C38", accent: "#FF753F" },
  },

  // Electric blue on near-black — the "Get in Touch / Web3" look: a glowing
  // royal-blue accent over deep black. Pairs with the `decor-shards` effect.
  midnight: {
    name: "midnight",
    defaultAppearance: "dark",
    light: { text: "#0A1024", background: "#FFFFFF", primary: "#2747E0", secondary: "#E5EAFF", accent: "#3D6BFF" },
    dark: { text: "#EAF0FF", background: "#03040D", primary: "#2E5BFF", secondary: "#0A1230", accent: "#4F7CFF" },
  },
};

export const DEFAULT_THEME = "modern.enterprise";
