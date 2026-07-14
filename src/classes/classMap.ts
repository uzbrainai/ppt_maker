/**
 * The Tailwind-like utility class system.
 *
 * Each class string token maps to a partial patch of `ResolvedClasses`. The
 * resolver applies patches left-to-right; later classes win on conflict.
 *
 * Spacing values are stored as semantic keys (xs/sm/md/lg/xl) here and turned
 * into real inch values by the layout engine using the active theme.
 */

export type SpacingKey = "xs" | "sm" | "md" | "lg" | "xl";
export type Density = "low" | "medium" | "high";
export type CardVariant = "flat" | "outline" | "elevated" | "muted" | "tinted";
export type IconStyle = "line" | "filled";
export type Accent = "blue" | "green" | "purple" | "orange" | "teal" | "pink" | "multi";
export type TitleScale = "lg" | "xl";
/** Geometric effect styles for the cover (title) slide. */
export type CoverDecor = "rings" | "grid" | "blobs" | "mesh" | "waves" | "scatter" | "arcs" | "shards" | "none";

export type BackgroundKind =
  | "clean"
  | "muted"
  | "dark"
  | "gradient-soft"
  | "gradient-primary"
  | "gradient-radial-soft";

export interface GridLayout {
  kind: "grid";
  cols: number;
  rows: number;
}
export interface WorkflowLayout {
  kind: "workflow";
  steps: number;
}
export interface SplitLayout {
  kind: "split";
  /** left fraction 0..1 */
  ratio: number;
}
export interface CenterLayout {
  kind: "center";
}
export interface HeroLayout {
  kind: "hero";
}

export type LayoutToken =
  | GridLayout
  | WorkflowLayout
  | SplitLayout
  | CenterLayout
  | HeroLayout;

export interface ResolvedClasses {
  layout?: LayoutToken;
  /** explicit hero flag (can co-exist with another layout, e.g. title) */
  hero?: boolean;
  gap?: SpacingKey;
  pad?: SpacingKey;
  /** safe-area margin override */
  safe?: SpacingKey;
  card?: { variant: CardVariant };
  /** generic "cards" / "elevated" markers used by workflow/cards macros */
  useCards?: boolean;
  elevated?: boolean;
  background?: BackgroundKind;
  titleScale?: TitleScale;
  density?: Density;
  icons?: { style: IconStyle };
  arrows?: { style: "soft" | "bold" };
  accent?: Accent;
  /** cards get distinct per-item colors from the palette */
  colorful?: boolean;
  /** draw a colored accent strip at the top of each card */
  accentTop?: boolean;
  /** colored accent strip on the left edge of each card */
  accentLeft?: boolean;
  /** number each card/item */
  numbered?: boolean;
  /** show/hide the slide footer (deck name + page number) */
  footer?: boolean;
  /** geometric effect on the cover slide (title macro); auto-picked if unset */
  decor?: CoverDecor;
  /** raw list of every recognized class, for debugging */
  applied: string[];
}

export type ClassPatch = (r: ResolvedClasses) => void;

/** Static class → patch table. */
export const CLASS_MAP: Record<string, ClassPatch> = {
  // ---- Layout: grids ----
  "grid-2x2": (r) => (r.layout = { kind: "grid", cols: 2, rows: 2 }),
  "grid-3x2": (r) => (r.layout = { kind: "grid", cols: 3, rows: 2 }),
  "grid-3x1": (r) => (r.layout = { kind: "grid", cols: 3, rows: 1 }),
  "grid-4x1": (r) => (r.layout = { kind: "grid", cols: 4, rows: 1 }),

  // ---- Layout: workflows ----
  "workflow-3": (r) => (r.layout = { kind: "workflow", steps: 3 }),
  "workflow-4": (r) => (r.layout = { kind: "workflow", steps: 4 }),
  "workflow-5": (r) => (r.layout = { kind: "workflow", steps: 5 }),
  "workflow-6": (r) => (r.layout = { kind: "workflow", steps: 6 }),

  // ---- Layout: splits / center / hero ----
  "split-50": (r) => (r.layout = { kind: "split", ratio: 0.5 }),
  "split-60-40": (r) => (r.layout = { kind: "split", ratio: 0.6 }),
  center: (r) => (r.layout = { kind: "center" }),
  hero: (r) => {
    r.layout = { kind: "hero" };
    r.hero = true;
  },

  // ---- Spacing ----
  "gap-xs": (r) => (r.gap = "xs"),
  "gap-sm": (r) => (r.gap = "sm"),
  "gap-md": (r) => (r.gap = "md"),
  "gap-lg": (r) => (r.gap = "lg"),
  "pad-sm": (r) => (r.pad = "sm"),
  "pad-md": (r) => (r.pad = "md"),
  "pad-lg": (r) => (r.pad = "lg"),
  "safe-md": (r) => (r.safe = "md"),
  "safe-lg": (r) => (r.safe = "lg"),

  // ---- Cards ----
  "card-flat": (r) => (r.card = { variant: "flat" }),
  "card-outline": (r) => (r.card = { variant: "outline" }),
  "card-elevated": (r) => (r.card = { variant: "elevated" }),
  "card-muted": (r) => (r.card = { variant: "muted" }),
  "card-tinted": (r) => (r.card = { variant: "tinted" }),
  cards: (r) => (r.useCards = true),
  elevated: (r) => (r.elevated = true),

  // ---- Card embellishments ----
  "cards-colorful": (r) => {
    r.colorful = true;
    r.accent = "multi";
  },
  colorful: (r) => {
    r.colorful = true;
    r.accent = "multi";
  },
  "accent-top": (r) => (r.accentTop = true),
  "accent-left": (r) => (r.accentLeft = true),
  numbered: (r) => (r.numbered = true),
  footer: (r) => (r.footer = true),
  "no-footer": (r) => (r.footer = false),

  // ---- Backgrounds ----
  "bg-clean": (r) => (r.background = "clean"),
  "bg-muted": (r) => (r.background = "muted"),
  "bg-dark": (r) => (r.background = "dark"),
  "bg-gradient-soft": (r) => (r.background = "gradient-soft"),
  "bg-gradient-primary": (r) => (r.background = "gradient-primary"),
  "bg-gradient-radial-soft": (r) => (r.background = "gradient-radial-soft"),

  // ---- Typography ----
  "title-xl": (r) => (r.titleScale = "xl"),
  "title-lg": (r) => (r.titleScale = "lg"),
  "density-low": (r) => (r.density = "low"),
  "density-medium": (r) => (r.density = "medium"),
  "density-high": (r) => (r.density = "high"),

  // ---- Visual ----
  "icons-line": (r) => (r.icons = { style: "line" }),
  "icons-filled": (r) => (r.icons = { style: "filled" }),
  "arrows-soft": (r) => (r.arrows = { style: "soft" }),
  "arrows-bold": (r) => (r.arrows = { style: "bold" }),
  "accent-blue": (r) => (r.accent = "blue"),
  "accent-green": (r) => (r.accent = "green"),
  "accent-purple": (r) => (r.accent = "purple"),
  "accent-orange": (r) => (r.accent = "orange"),
  "accent-teal": (r) => (r.accent = "teal"),
  "accent-pink": (r) => (r.accent = "pink"),
  "accent-multi": (r) => {
    r.accent = "multi";
    r.colorful = true;
  },

  // ---- Cover (title) geometric effects ----
  "decor-rings": (r) => (r.decor = "rings"),
  "decor-grid": (r) => (r.decor = "grid"),
  "decor-blobs": (r) => (r.decor = "blobs"),
  "decor-mesh": (r) => (r.decor = "mesh"),
  "decor-waves": (r) => (r.decor = "waves"),
  "decor-scatter": (r) => (r.decor = "scatter"),
  "decor-arcs": (r) => (r.decor = "arcs"),
  "decor-shards": (r) => (r.decor = "shards"),
  "decor-none": (r) => (r.decor = "none"),
};
