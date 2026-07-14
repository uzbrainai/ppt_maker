/**
 * slidewind — core type definitions
 *
 * Two formats live here:
 *  1. DeckSpec Lite   — the compact, LLM-facing authoring format.
 *  2. PPTScene        — the resolved, explicit, deterministic internal format
 *                       that the OOXML compiler consumes.
 *
 * All geometry in PPTScene is expressed in INCHES. The compiler converts to
 * EMUs (English Metric Units) at the very end. See core/units.ts.
 */

/* ------------------------------------------------------------------ *
 * Geometry primitives
 * ------------------------------------------------------------------ */

export interface Box {
  /** left edge, inches */
  x: number;
  /** top edge, inches */
  y: number;
  /** width, inches */
  w: number;
  /** height, inches */
  h: number;
}

/* ------------------------------------------------------------------ *
 * Fills, strokes, shadows
 * ------------------------------------------------------------------ */

export interface GradientStop {
  /** hex color, e.g. "#1d4ed8" (with or without leading #) */
  color: string;
  /** stop position, 0..1 */
  pos: number;
  /** opacity, 0..1 (1 = opaque) */
  opacity?: number;
}

export type FillSpec =
  | { type: "solid"; color: string; opacity?: number }
  | {
      type: "linearGradient";
      /** gradient angle in degrees (0 = left→right, 90 = top→bottom) */
      angle: number;
      stops: GradientStop[];
    }
  | {
      type: "radialGradient";
      stops: GradientStop[];
      /** center x, 0..1 (default 0.5) */
      cx?: number;
      /** center y, 0..1 (default 0.5) */
      cy?: number;
      /** radius, 0..1 (default 0.5) */
      r?: number;
      /** what to do if PowerPoint cannot render a true radial gradient */
      fallback?: "raster" | "solid";
    }
  | {
      /** an editable PowerPoint pattern fill (hatch/lines/dots/zebra) */
      type: "pattern";
      /** DrawingML preset, e.g. ltUpDiag, ltHorz, dotGrid, pct20 */
      preset: string;
      /** foreground (the lines/dots) */
      fg: string;
      /** background (the fill behind) */
      bg: string;
      fgOpacity?: number;
    }
  | { type: "none" };

export interface StrokeSpec {
  color: string;
  /** stroke width in points */
  width: number;
  opacity?: number;
  dash?: "solid" | "dash" | "dot" | "dashDot";
  /** arrowhead on the start point */
  headStart?: ArrowHead;
  /** arrowhead on the end point */
  headEnd?: ArrowHead;
  /** round line caps + joins (used by stroked icons) */
  round?: boolean;
}

export type ArrowHead = "none" | "triangle" | "arrow" | "stealth" | "oval";

export interface ShadowSpec {
  /** whether the shadow is rendered at all */
  enabled: boolean;
  /** blur radius in points */
  blur: number;
  /** offset distance in points */
  distance: number;
  /** direction in degrees (90 = downward) */
  direction: number;
  color: string;
  /** opacity of the shadow color, 0..1 */
  opacity: number;
}

/* ------------------------------------------------------------------ *
 * Typography
 * ------------------------------------------------------------------ */

export interface TextStyle {
  /** font family name */
  font?: string;
  /** font size in points */
  size: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
  vAlign?: "top" | "middle" | "bottom";
  /** line spacing multiplier (1 = single) */
  lineSpacing?: number;
  /** letter spacing in points */
  letterSpacing?: number;
  /** per-paragraph spacing before/after, points */
  spaceBefore?: number;
  spaceAfter?: number;
}

/* ------------------------------------------------------------------ *
 * Geometry spec — flexible shape description
 * ------------------------------------------------------------------ */

/**
 * A single absolute path segment, reduced to the four kinds DrawingML custom
 * geometry understands (plus close). Cubic absorbs H/V/S; quad absorbs T; arcs
 * are pre-converted to cubics. See geometry/svgPath.ts.
 */
export type PathSeg =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Q"; x1: number; y1: number; x: number; y: number }
  | { type: "Z" };

export interface GeometrySpec {
  /** corner radius in inches (roundRect) */
  cornerRadius?: number;
  /** preset shape adjustment values (preset-specific guide names) */
  adjust?: Record<string, number>;
  /** custom polygon points, normalized 0..1 within the box (freeform) */
  points?: Array<{ x: number; y: number }>;
  /** raw SVG-ish path string (freeform; informational) */
  path?: string;
  /**
   * Parsed absolute path segments, expressed in `viewBox` coordinate space.
   * When present, the compiler emits a DrawingML <a:custGeom> for this shape.
   */
  segments?: PathSeg[];
  /** coordinate space the segments/points are defined in (e.g. 24×24 for lucide) */
  viewBox?: { w: number; h: number };
  /** whether the path should be filled (closed icons) vs stroked only */
  filled?: boolean;
}

export type ShapeName =
  | "rect"
  | "roundRect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "parallelogram"
  | "hexagon"
  | "pentagon"
  | "chevron"
  | "rightArrow"
  | "leftRightArrow"
  | "freeform";

/* ------------------------------------------------------------------ *
 * PPTScene elements
 * ------------------------------------------------------------------ */

export interface ElementBase {
  id: string;
  box: Box;
  /** rotation in degrees, clockwise */
  rotation?: number;
}

export interface TextElement extends ElementBase {
  type: "text";
  text: string;
  style: TextStyle;
  /** optional external hyperlink (the whole text becomes clickable) */
  link?: string;
  /** optional fill behind the text (acts like a filled text box) */
  fill?: FillSpec;
  stroke?: StrokeSpec;
  /** inner padding in inches (defaults applied by compiler) */
  padding?: number;
  /** disable word wrap (single line; e.g. big KPI values) */
  noWrap?: boolean;
  fit?: {
    mode: "none" | "shrink";
    maxLines?: number;
    minFontSize?: number;
  };
}

export interface ShapeStyle {
  fill?: FillSpec;
  stroke?: StrokeSpec;
  /** corner radius in inches (roundRect convenience) */
  radius?: number;
  shadow?: ShadowSpec;
  /** whole-shape opacity, 0..1 */
  opacity?: number;
}

export interface ShapeElement extends ElementBase {
  type: "shape";
  shape: ShapeName;
  style: ShapeStyle;
  geometry?: GeometrySpec;
  /** optional text drawn inside the shape */
  text?: string;
  textStyle?: TextStyle;
}

export interface LineElement extends ElementBase {
  type: "line";
  /** start point in inches (absolute) */
  from: { x: number; y: number };
  /** end point in inches (absolute) */
  to: { x: number; y: number };
  stroke: StrokeSpec;
}

export interface IconElement extends ElementBase {
  type: "icon";
  /** logical icon name, e.g. "mail", "shield" */
  name: string;
  style: {
    color: string;
    strokeWidth?: number;
    variant?: "line" | "filled";
  };
}

export interface GroupElement extends ElementBase {
  type: "group";
  children: PPTElement[];
}

/** A raster image embedded into the deck (premium AI-generated photos, etc.). */
export interface ImageElement extends ElementBase {
  type: "image";
  /** PNG/JPEG bytes embedded into ppt/media (deduped by content hash). */
  data: Buffer;
  /** how the image fills its box: cover crops to fill, contain fits inside */
  fit?: "cover" | "contain";
  /** corner radius in inches (rounds the image) */
  radius?: number;
  /** alt text */
  alt?: string;
}

export type PPTElement =
  | TextElement
  | ShapeElement
  | LineElement
  | IconElement
  | ImageElement
  | GroupElement;

/* ------------------------------------------------------------------ *
 * Theme
 * ------------------------------------------------------------------ */

export interface ThemeColors {
  background: string;
  backgroundMuted: string;
  text: string;
  textMuted: string;
  surface: string;
  surfaceMuted: string;
  primary: string;
  primaryDark: string;
  /** the accent / highlight color (distinct from primary) */
  accent: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
}

/** Light/dark appearance for a theme. */
export type Appearance = "light" | "dark";

/**
 * The compact 5-role palette an author/LLM thinks in. A theme provides one of
 * these per appearance; the engine derives the full ThemeColors from it.
 */
export interface ThemePalette {
  text: string;
  background: string;
  primary: string;
  secondary: string;
  accent: string;
}

/** A theme definition: a palette for each appearance + a default appearance. */
export interface ThemeDef {
  name: string;
  defaultAppearance: Appearance;
  light: ThemePalette;
  dark: ThemePalette;
}

export interface ThemeFonts {
  heading: string;
  body: string;
  mono: string;
}

export interface ThemeTypography {
  h1: TextStyle;
  h2: TextStyle;
  body: TextStyle;
  bodyStrong: TextStyle;
  caption: TextStyle;
  kpi: TextStyle;
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface ThemeRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
}

export interface ThemeShadows {
  none: ShadowSpec;
  soft: ShadowSpec;
  md: ShadowSpec;
  lg: ShadowSpec;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radius: ThemeRadius;
  shadows: ThemeShadows;
}

/**
 * A theme that has been resolved/normalized for a specific deck (currently
 * identical in shape to Theme, but kept distinct so the scene format does not
 * leak future authoring-time-only fields).
 */
export type ResolvedTheme = Theme;

/* ------------------------------------------------------------------ *
 * PPTScene
 * ------------------------------------------------------------------ */

export interface SlideSize {
  /** width in inches */
  width: number;
  /** height in inches */
  height: number;
}

export interface PPTSlide {
  id: string;
  background?: FillSpec;
  elements: PPTElement[];
  notes?: string;
}

export interface PPTScene {
  version: "pptscene/0.1";
  unit: "inch";
  size: SlideSize;
  theme: ResolvedTheme;
  slides: PPTSlide[];
}

/* ------------------------------------------------------------------ *
 * DeckSpec Lite (LLM-facing authoring format)
 * ------------------------------------------------------------------ */

export type DeckTarget = "ppt365" | "ppt365.mac" | "ppt365.win" | "generic";
export type DeckMode = "editable" | "balanced" | "pixel";
export type DeckSize = "wide" | "standard";

/**
 * Author-facing text-length hint. Lets an LLM declare roughly how long a text
 * is so the engine can size/clamp it up front and guarantee it never overflows
 * its container. Maps to a max line budget; see macros/shared.ts `lenToLines`.
 */
export type LenHint = "xs" | "sm" | "md" | "lg" | "xl";

/** [icon, title, body] tuple OR an object form (richer: group + length hint). */
export type ItemTuple =
  | [string, string, string]
  | [string, string]
  | {
      icon?: string;
      t?: string;
      title?: string;
      s?: string;
      body?: string;
      /** grouping key — items sharing it get one identical palette color */
      group?: string;
      g?: string;
      /** length hint for the body text */
      len?: LenHint;
    };

export interface NormalizedItem {
  icon?: string;
  title: string;
  body?: string;
  /** grouping key for shared coloring */
  group?: string;
  /** length hint for the body text */
  len?: LenHint;
}

/**
 * An image for a macro container. `data` (runtime bytes, e.g. premium-generated)
 * is preferred; `src` (a local file path) is resolved to bytes before expand;
 * `prompt` is what the art director asks the image model to generate.
 */
export interface ImageSpec {
  data?: Buffer;
  src?: string;
  prompt?: string;
  alt?: string;
}

export interface TitleSlideSpec {
  title: {
    class?: string;
    t: string;
    s?: string;
    /** optional full-bleed background image (with a contrast scrim) */
    image?: ImageSpec;
    notes?: string;
  };
}

export interface CardsSlideSpec {
  cards: {
    class?: string;
    t?: string;
    items: ItemTuple[];
    /** a summary paragraph rendered as a block in the whitespace below the
     * (content-sized) cards; keeps slides from looking empty */
    note?: string;
    s?: string;
    notes?: string;
  };
}

export interface WorkflowSlideSpec {
  wf: {
    class?: string;
    t?: string;
    steps: ItemTuple[];
    callout?: string;
    notes?: string;
  };
}

/** KPI / stat tiles: [value, label] or [value, label, icon]. */
export type KpiTuple =
  | [string, string]
  | [string, string, string]
  | { value?: string; v?: string; label?: string; l?: string; icon?: string };

export interface KpiSlideSpec {
  kpi: {
    class?: string;
    t?: string;
    items: KpiTuple[];
    notes?: string;
  };
}

/** Bulleted list: items are strings or [title, body] tuples or objects. */
export type BulletItem =
  | string
  | [string, string]
  | { t?: string; title?: string; s?: string; body?: string; icon?: string; group?: string; g?: string; len?: LenHint };

export interface BulletsSlideSpec {
  bullets: {
    class?: string;
    t?: string;
    s?: string;
    items: BulletItem[];
    notes?: string;
  };
}

/** Section divider slide. */
export interface SectionSlideSpec {
  section: {
    class?: string;
    t: string;
    s?: string;
    /** optional section index label, e.g. "02" */
    n?: string;
    /** optional full-bleed background image (with a contrast scrim) */
    image?: ImageSpec;
    notes?: string;
  };
}

/** Showcase slide: a large image alongside a title + caption. */
export interface ShowcaseSlideSpec {
  showcase: {
    class?: string;
    t?: string;
    s?: string;
    /** the hero image (right by default; left with class "image-left") */
    image: ImageSpec;
    /** supporting points: plain text, or [title, body], or an object */
    points?: Array<string | [string, string] | { t?: string; title?: string; body?: string; s?: string }>;
    notes?: string;
  };
}

/** Chart slide. */
export type ChartType = "bar" | "barh" | "line" | "area" | "scatter" | "donut";

/** [label, value] tuple OR object form for categorical charts. */
export type ChartItemTuple =
  | [string, number]
  | { label?: string; l?: string; value?: number; v?: number; color?: string };

export interface ChartSeriesSpec {
  name?: string;
  color?: string;
  /** y values aligned to categories (line/area) */
  data?: number[];
  /** raw [x, y] points (scatter) */
  points?: Array<[number, number]>;
}

export interface ChartSlideSpec {
  chart: {
    class?: string;
    type: ChartType;
    t?: string;
    /** categorical data: [label, value] */
    items?: ChartItemTuple[];
    /** multi-series data (line/area/scatter) */
    series?: ChartSeriesSpec[];
    /** category labels for line/area when using `series` */
    x?: string[];
    /** show a legend (default true for donut, false otherwise) */
    legend?: boolean;
    /** show value labels on bars */
    values?: boolean;
    /** fill segments with thin white patterns (distinct per segment) */
    pattern?: boolean;
    /** insight paragraph shown in the explanation panel beside the chart */
    s?: string;
    /** insight bullet points shown in the explanation panel */
    points?: string[];
    /** heading for the explanation panel (default "Tahlil"/"Insights") */
    insightTitle?: string;
    notes?: string;
  };
}

/** Table slide: structured rows with a header and an optional bottom summary. */
export interface TableSlideSpec {
  table: {
    class?: string;
    t?: string;
    /** column headers */
    columns: string[];
    /** data rows (cells are strings or numbers) */
    rows: Array<Array<string | number>>;
    /** a summary/notes line shown as a block under the table */
    summary?: string;
    notes?: string;
  };
}

/** Gauge slide: KPI cards each with a circular progress ring. */
export type GaugeTuple =
  | [string, string]
  | [string, string, string]
  | { value?: string; v?: string; title?: string; t?: string; label?: string; body?: string; s?: string; icon?: string };

export interface GaugeSlideSpec {
  gauge: {
    class?: string;
    t?: string;
    /** [value, title, body] — value like "78%" */
    items: GaugeTuple[];
    notes?: string;
  };
}

/** Pyramid slide: stacked hierarchy layers + a numbered list beside it. */
export type PyramidTuple =
  | [string, string]
  | [string]
  | { title?: string; t?: string; body?: string; s?: string };

export interface PyramidSlideSpec {
  pyramid: {
    class?: string;
    eyebrow?: string;
    t?: string;
    /** layers, top → bottom: [title, body] */
    items: PyramidTuple[];
    notes?: string;
  };
}

/** Timeline slide: a horizontal sequence of dated milestones. */
export type TimelineTuple =
  | [string, string]
  | [string, string, string]
  | { date?: string; d?: string; t?: string; title?: string; s?: string; body?: string; icon?: string };

export interface TimelineSlideSpec {
  timeline: {
    class?: string;
    /** small uppercase label above the title (e.g. "TIMELINE") */
    eyebrow?: string;
    t?: string;
    items: TimelineTuple[];
    /** bottom roadmap callout bar text */
    callout?: string;
    notes?: string;
  };
}

/** Summary / recap slide. */
export interface SummarySlideSpec {
  summary: {
    class?: string;
    t?: string;
    s?: string;
    items: ItemTuple[];
    notes?: string;
  };
}

/** A comparison column: a header + a list of points, with an optional tone. */
export type CmpColumn = {
  t?: string;
  title?: string;
  s?: string;
  subtitle?: string;
  icon?: string;
  /** good → green/check, bad → red/cross, neutral → muted/dot */
  tone?: "good" | "bad" | "neutral";
  points?: string[];
  group?: string;
};

export interface CmpSlideSpec {
  cmp: {
    class?: string;
    t?: string;
    items: CmpColumn[];
    notes?: string;
  };
}

/** Stubbed macros (arch) — accepted but not fully expanded. */
export interface StubSlideSpec {
  arch?: { class?: string; t?: string; [k: string]: unknown };
}

/** Agenda / table-of-contents: a numbered list, auto-flowed into columns. */
export type AgendaTuple =
  | string
  | [string]
  | { title?: string; t?: string; label?: string };

export interface AgendaSlideSpec {
  agenda: {
    class?: string;
    t?: string;
    /** the agenda entries, in order (numbered automatically) */
    items: AgendaTuple[];
    notes?: string;
  };
}

/** Roadmap: phase nodes on a connected path, labels alternating above/below. */
export type RoadmapTuple =
  | [string, string]
  | [string, string, string]
  | { phase?: string; n?: string; t?: string; title?: string; body?: string; s?: string };

export interface RoadmapSlideSpec {
  roadmap: {
    class?: string;
    eyebrow?: string;
    t?: string;
    /** ordered phases: [phaseLabel, description] or [phaseLabel, title, body] */
    items: RoadmapTuple[];
    callout?: string;
    notes?: string;
  };
}

/** Problem / big-number cards: large numbered cards with alternating fills. */
export type ProblemTuple =
  | [string, string]
  | { t?: string; title?: string; body?: string; s?: string };

export interface ProblemSlideSpec {
  problem: {
    class?: string;
    t?: string;
    s?: string;
    /** the items, numbered 01.. automatically: [title, body] */
    items: ProblemTuple[];
    notes?: string;
  };
}

/** One stat panel: a small chart over a title + description. */
export interface StatPanel {
  type?: "bar" | "line" | "area" | "donut";
  t?: string;
  title?: string;
  body?: string;
  s?: string;
  /** bar/donut data */
  items?: ChartItemTuple[];
  /** line/area data */
  series?: ChartSeriesSpec[];
  x?: string[];
  pattern?: boolean;
}

/** Statistic slide: 2–3 chart panels with captions + a rotated side label. */
export interface StatSlideSpec {
  stat: {
    class?: string;
    eyebrow?: string;
    t?: string;
    items: StatPanel[];
    notes?: string;
  };
}

/** Criteria / comparison points: numbered circle + connector + card, 2 columns. */
export type CriteriaTuple =
  | [string, string]
  | { t?: string; title?: string; body?: string; s?: string };

export interface CriteriaSlideSpec {
  criteria: {
    class?: string;
    t?: string;
    s?: string;
    items: CriteriaTuple[];
    notes?: string;
  };
}

/** Highlight: a left statement card + a right featured card over a pill list. */
export interface HighlightSlideSpec {
  highlight: {
    class?: string;
    /** left statement title */
    t: string;
    /** left statement body */
    s?: string;
    /** featured card heading (top-right) — 1–2 words tied to the title */
    featured?: string;
    /** lucide icon shown on the featured card (decorative) */
    icon?: string;
    /** optional image filling the featured card instead of the icon */
    image?: ImageSpec;
    /** the pill items listed under the featured card */
    items: Array<string | [string] | { t?: string; title?: string; label?: string }>;
    notes?: string;
  };
}

/** Spine: a left title + a right list whose items hang off a curved spine. */
export type SpineTuple =
  | [string, string]
  | { t?: string; title?: string; body?: string; s?: string };

export interface SpineSlideSpec {
  spine: {
    class?: string;
    /** small brand label above the title */
    brand?: string;
    t?: string;
    items: SpineTuple[];
    notes?: string;
  };
}

/** Columns: a header band + 2–4 full-height text columns. */
export type ColumnTuple =
  | [string, string]
  | [string, string, string]
  | { icon?: string; t?: string; title?: string; body?: string; s?: string };

export interface ColumnsSlideSpec {
  columns: {
    class?: string;
    t?: string;
    s?: string;
    items: ColumnTuple[];
    notes?: string;
  };
}

/** Radial: a ring split into N labeled segments + a matching item list. */
export type RadialTuple =
  | [string, string]
  | { t?: string; title?: string; body?: string; s?: string };

export interface RadialSlideSpec {
  radial: {
    class?: string;
    t?: string;
    s?: string;
    /** optional label in the ring center */
    center?: string;
    items: RadialTuple[];
    notes?: string;
  };
}

/** Funnel: stacked narrowing stages with optional side detail. */
export type FunnelTuple =
  | [string, string]
  | { t?: string; title?: string; body?: string; s?: string; value?: string };

export interface FunnelSlideSpec {
  funnel: {
    class?: string;
    eyebrow?: string;
    t?: string;
    /** stages, widest (top) → narrowest (bottom) */
    items: FunnelTuple[];
    notes?: string;
  };
}

export type SlideSpec =
  | TitleSlideSpec
  | CardsSlideSpec
  | WorkflowSlideSpec
  | KpiSlideSpec
  | BulletsSlideSpec
  | SectionSlideSpec
  | CmpSlideSpec
  | ChartSlideSpec
  | TimelineSlideSpec
  | SummarySlideSpec
  | GaugeSlideSpec
  | PyramidSlideSpec
  | TableSlideSpec
  | AgendaSlideSpec
  | RoadmapSlideSpec
  | ProblemSlideSpec
  | StatSlideSpec
  | CriteriaSlideSpec
  | HighlightSlideSpec
  | SpineSlideSpec
  | ShowcaseSlideSpec
  | ColumnsSlideSpec
  | RadialSlideSpec
  | FunnelSlideSpec
  | StubSlideSpec;

export interface DeckSpec {
  format: "deckspec/0.1";
  /** theme name (alias: `deck`) */
  theme?: string;
  deck?: string;
  /** light or dark mode; defaults to the theme's natural appearance */
  appearance?: Appearance;
  target?: DeckTarget;
  mode?: DeckMode;
  size?: DeckSize;
  slides: SlideSpec[];
}
