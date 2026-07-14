# slidewind

**Tailwind CSS for editable PowerPoint generation.**

```text
LLM writes compact DeckSpec Lite.
Slidewind expands it into a rich PPTScene.
PPTScene compiles into editable PPTX objects.
```

Slidewind is **not** a screenshot/raster pipeline and **not** a wrapper around
`pptxgenjs` or `python-pptx`. It generates the OOXML `.pptx` package by hand
(with `jszip`) so the result is **real, editable PowerPoint**: text boxes,
shapes, gradients, lines, arrows, grouped cards, and placeholder icons — every
object selectable and editable in PowerPoint.

The design philosophy:

```text
LLM output should be minimal.
Slidewind output should be rich.
PowerPoint output should be editable.
```

The LLM writes a few semantic blocks and Tailwind-style utility classes:

```yaml
- cards:
    class: "grid-3x2 card-elevated icons-line gap-md density-medium accent-blue"
    t: Main AI Opportunities
    items:
      - [bot, Chatbots, Customer service automation]
      - [mic, Call Metrics, Analyze operator-client conversations]
```

…and Slidewind owns everything else: theme, spacing scale, typography scale,
PowerPoint-safe shadows and gradients, shape geometry, layout, text fitting, and
OOXML generation. It feels like:

```html
<div class="p-6 rounded-xl shadow-lg bg-white">  <!-- the web -->
```

```yaml
class: "grid-3x2 card-elevated icons-line gap-md"  <!-- slidewind -->
```

---

## Installation

```bash
npm install
npm run build
```

### Output formats & Docker

Add `--pdf` to also export a PDF (renders the editable `.pptx` via LibreOffice):

```bash
npm run slidewind -- build examples/deck.yaml -o out/deck.pptx --preview --pdf
```

Run anywhere with Docker (Node + LibreOffice + fonts baked in):

```bash
docker build -t slidewind .
# build a deck from a mounted YAML, get pptx + pdf in ./out
docker run --rm -v "$PWD/out:/out" -v "$PWD/examples:/examples" \
  slidewind build /examples/deck.yaml -o /out/deck.pptx --pdf
# LLM generation (pass your key)
docker run --rm -e OPENAI_API_KEY -v "$PWD/out:/out" \
  slidewind generate --topic "AI in logistics" --theme indigo --mode dark --pdf -o /out/deck.pptx
```

> Uses **npm** (the machine has no `pnpm`). The pnpm equivalents are
> `pnpm install` / `pnpm build` / `pnpm slidewind …` if you have it.

---

## CLI usage

Build a `.pptx` (and an optional SVG debug preview):

```bash
npm run slidewind -- build examples/deck.yaml -o examples/out/demo.pptx --preview
# or, via the shorthand script:
npm run demo
```

Produces:

```text
examples/out/demo.pptx     # open in PowerPoint — fully editable
examples/out/preview.svg   # quick layout preview for debugging
```

Generate a deck end-to-end with an LLM (two-agent orchestration):

```bash
npm run slidewind -- generate \
  --topic "AI in education" --theme indigo --mode dark --pages 10 --lang en \
  -o examples/out/generated.pptx --preview
```

How it works (`src/agent/`): a **content agent** writes the substance for N
pages (sections, points, and — where they fit — metrics/comparison/timeline/chart
data); a **design agent** then chooses the slide macro for each section, orders
them (title → sections → summary → closing), and emits our slide JSON honoring
the capacity contract. The output is validated against the zod schema (with one
automatic repair round) before compiling to `.pptx`. The resolved DeckSpec is
also saved as `<out>.yaml` so you can tweak and rebuild.

- Theme, mode (light/dark), topic, page count and language come from your flags.
- Set `OPENAI_API_KEY` via `--env <path>` or the environment; `--model` selects
  the model (default `$OPENAI_MODEL` or `gpt-4o-mini` — a fast gpt-4-class model;
  pass `--model gpt-4` for the base model, which is slower).

Inspect the pipeline without compiling:

```bash
npm run slidewind -- inspect examples/deck.yaml
```

`inspect` prints the parsed DeckSpec, the resolved class tokens per slide, the
slide count, a scene element summary, and all warnings.

After `npm run build`, the `slidewind` binary is also available directly
(`node dist/cli.js …`, or globally via `npm link`).

---

## Example DeckSpec Lite

```yaml
format: deckspec/0.1
deck: modern.enterprise
target: ppt365
mode: editable
size: wide

slides:
  - title:
      class: "hero bg-gradient-soft title-xl"
      t: Slidewind
      s: Tailwind-style DSL for editable PowerPoint generation

  - cards:
      class: "grid-3x2 card-elevated icons-line gap-md density-medium accent-blue"
      t: Why Slidewind?
      items:
        - [layout, Compact DSL, LLM outputs small semantic instructions]
        - [shape, Editable Shapes, Cards and diagrams become PPT objects]
        - [gradient, Gradients, PPT-native gradient backgrounds]

  - wf:
      class: "workflow-5 cards elevated arrows-soft accent-blue"
      t: Generation Pipeline
      steps:
        - [prompt, Prompt, User asks for a deck]
        - [code, DeckSpec, LLM writes compact YAML]
        - [ppt, Compile, OOXML PPTX generation]
      callout: The LLM chooses classes; Slidewind owns rendering details.
```

---

## What the output contains

Every slide compiles to native, editable OOXML objects:

| DeckSpec block | PowerPoint objects produced |
| -------------- | --------------------------- |
| `title` (hero) | full-slide gradient rect, decorative ellipses, accent bar, title + subtitle text boxes |
| `cards`        | title text box + a **group** per card (rounded-rect background, optional accent bar, colored icon chip with editable icon shapes, title + body text boxes) |
| `wf`           | title, a group per step (card, numbered badge, icon, title, body), connector **arrows** between steps, optional callout band |
| `kpi`          | title + a group per stat tile (big colored value, accent divider, caption label, optional icon) |
| `bullets`      | title + lead paragraph + numbered/icon/dot markers with bold lead and supporting text (auto two-column for long lists) |
| `section`      | full-bleed gradient divider: large section number, accent bar, big title, subtitle, decorative circle |
| `cmp`          | 2–4 comparison columns, each a card with a colored (tone-aware) header + check/cross/dot point markers |
| `chart`        | a full-area editable **vector chart** (bar / line / area / scatter / donut) with axes, labels, %-labels, legend, intensity colors, and optional pattern fills |
| `timeline`     | a full-width horizontal timeline: central axis, colored nodes, alternating above/below milestone cards |
| `summary`      | end-of-deck recap: a gradient headline panel + numbered/icon takeaways that fill the height |
| `gauge`        | KPI cards each with a circular **ring gauge** (percent), value, title and description |
| `pyramid`      | a stacked hierarchy (apex→base) beside a matching numbered list |
| `table`        | a clean table: colored header, zebra rows, auto right-aligned numeric columns, and a bottom summary block |

Backgrounds like `bg-gradient-soft` become a full-slide rectangle with a native
`<a:gradFill>` — editable, not a flattened image. Content slides also get a slim
footer (deck name + page number).

### Color tool & contrast

`core/palette.ts` is "the right tool to choose the right colors". With
`accent-multi` / `cards-colorful`, each card/stat draws a distinct, harmonious
color — either from a curated multi-hue set or generated by rotating hue around
a base color (brightness auto-adapts to light vs. dark themes). Single-accent
decks (`accent-blue`, `accent-teal`, …) stay monochrome by design.

**Contrast is automatic.** Foreground text colors are never hardcoded against a
background — `core/color.ts` (`readableOn` / `ensureReadable`) derives readable
heading/body/caption colors from the actual (solid *or* gradient) background, so
a title on a blue cover renders white, not invisible dark text.

### Grouping

Give items a `group` key and all items in that group get **one identical**
palette color (the library picks it), while unrelated items stay distinct — handy
for visually tying a family of cards/columns together:

```yaml
items:
  - { icon: brain, t: "NLP",     group: "ai" }
  - { icon: eye,   t: "Vision",  group: "ai" }   # same color as NLP
  - { icon: lock,  t: "Security", group: "sec" } # different color
```

### Capacity contract (write text that fits, by design)

Every container has a **documented, enforced length budget** so an LLM can
generate text that's *not too long, not too short* and fills each shape cleanly.
The budgets live in `core/capacity.ts` (exported as `CAPACITY`), are used as the
layout engine's line caps, and are **checked at expand time** — exceeding one
emits a `text-overflow-risk` warning naming the field and limit (the text is
still safely truncated, so it never overflows).

| Container | Field | ~max chars | lines |
| --------- | ----- | ---------- | ----- |
| any slide | title | 60 | 2 |
| cards | title / body / summary | 26 / 80 / 220 | 2 / 3 / 3 |
| kpi | value / label | **6** / 48 | 1 / 3 |
| timeline | **node** / title / body | **6** / 22 / 70 | 1 / 1 / 3 |
| bullets | title / body | 40 / 90 | 1 / 2 |
| cmp | header / point | 22 / 56 | 1 / 2 |
| section | title / subtitle | 48 / 80 | 2 / 2 |
| chart | insight point | 70 | 2 |

Example: a timeline **node** is a tiny circle, so its label budget is 6 chars —
use `"2025"` or `"3"`, not `"1-bosqich"`. Over-budget labels are shrunk to a
single line (never wrapped into an unreadable stack) and flagged with a warning.

> Tip for prompting: tell the model to honor `CAPACITY` — e.g. "timeline node
> labels ≤ 6 chars, card titles ≤ 26 chars, KPI values ≤ 6 chars."

### Text-length hint & overflow safety

Text is **guaranteed** to stay inside its container: after shrinking to the
minimum font size, over-long strings are word-truncated with an ellipsis. An LLM
can additionally declare a `len` hint (`xs`/`sm`/`md`/`lg`/`xl` → a line budget)
so length is controlled up front:

```yaml
items:
  - { icon: chart, t: "Scoring", s: "A long description…", len: "sm" }
```

---

## Architecture

```text
DeckSpec Lite  (compact, LLM-facing YAML/JSON)
      │   dsl/parseDeckSpec  +  dsl/schema (zod)
      ▼
Parsed DeckSpec  (+ warnings)
      │   classes/resolveClasses  (Tailwind-like utility classes → tokens)
      ▼
Resolved class tokens
      │   macros/expandDeck → title|cards|wf|kpi|bullets|section|cmp|chart|timeline|summary|stubs
      │   layout/{boxes,grid,workflow,title}   themes/*   geometry/{shapePresets,icons}
      ▼
PPTScene  (explicit, deterministic, inches; boxes/fills/strokes/shadows/text)
      │   validation/validateScene
      │   compiler/pptx/* → contentTypes, relationships, presentation, theme,
      │                     master, layout, slideXml (+ ooxmlFill/Shape/Text/Effects)
      ▼
.pptx  (OOXML package zipped with jszip — editable in PowerPoint)

           └── preview/svgRenderer : PPTScene → SVG (debug only)
```

### Key boundaries

- The **LLM never** writes x/y coordinates, font sizes, gradient XML, or OOXML.
- Slidewind **owns** the theme system, spacing/typography scales,
  PowerPoint-safe shadows/gradients, shape geometry, layout rules, text fitting,
  and OOXML emission.
- Unknown utility classes produce a **warning**, never a crash.

### Themes (palette + light/dark mode)

A theme is a compact **5-role palette** — Text, Background, Primary, Secondary,
Accent — defined once per appearance (`light` / `dark`). The engine *derives*
the full theme from those five colors per mode: muted text, surfaces, borders,
the typography scale, and PowerPoint-safe shadows (`themes/buildTheme.ts`). So
"one theme, two modes" is a tiny input.

Built-in themes (`themes/defs.ts`): `modern.enterprise` (default, light),
`agrobank.ai` (light), `dark.tech` (dark), and `indigo` (electric indigo).
Every theme supports **both** modes.

Select theme + mode from the deck header:

```yaml
format: deckspec/0.1
theme: indigo        # theme name (alias: `deck`)
appearance: dark     # light | dark — omit to use the theme's natural mode
size: wide
slides: [ ... ]
```

Define your own by adding a `ThemeDef` to `themes/defs.ts`:

```ts
indigo: {
  name: "indigo",
  defaultAppearance: "light",
  light: { text: "#0B0B1A", background: "#FFFFFF", primary: "#3A36C9", secondary: "#D9DAF6", accent: "#4F46E5" },
  dark:  { text: "#E7E9F8", background: "#06060F", primary: "#4F46E5", secondary: "#0B0B22", accent: "#3B3BE3" },
}
```

Text colors are never hardcoded against the background — see "Color tool &
contrast" — so both modes stay readable automatically.

### Icons (lucide → editable vector geometry)

slidewind ships [lucide](https://lucide.dev)'s full icon set (`lucide-static`)
and converts each icon's SVG geometry into **native, editable PowerPoint
shapes** — not images:

- `<path>` / `<polyline>` / `<polygon>` → a freeform shape with a DrawingML
  `<a:custGeom>` (the SVG path is parsed and **elliptical arcs are converted to
  cubic Béziers**, then emitted as `moveTo` / `lnTo` / `cubicBezTo` / `quadBezTo`).
- `<circle>` / `<ellipse>` → ellipse preset
- `<rect>` → rect / roundRect preset
- `<line>` → straight connector

Every primitive is stroked (round caps/joins, no fill) to match lucide's line
style, so an icon becomes a small group of selectable shapes you can recolor or
reshape in PowerPoint.

You can use **any lucide icon id** (`shield`, `bar-chart`, `circle-check`, …) or
a friendly alias resolved by slidewind:

| alias | lucide | alias | lucide |
| ----- | ------ | ----- | ------ |
| `gear` | `settings` | `text` | `type` |
| `gradient` | `blend` | `prompt` | `message-square` |
| `layout` | `layout-dashboard` | `ppt` | `presentation` |
| `shape` | `shapes` | `edit` | `square-pen` |
| `chart` | `chart-column` | `doc` | `file-text` |

Unknown names render a lettered-circle placeholder and emit an `unknown-icon`
warning. The pipeline is modular (`geometry/svgPath.ts` + `geometry/icons.ts`),
so the same SVG→custGeom path importer can later ingest arbitrary SVGs/logos.

### Charts (editable vector, not images)

The `chart` macro renders **bar, line, area, scatter, and donut** charts built
from native editable primitives — rectangles (bars), ellipses (scatter/donut
nodes), connectors (axes/gridlines), and freeform `<a:custGeom>` paths (lines,
areas, and donut ring sectors, the latter via SVG-arc→bézier). Series colors come
from the palette tool. They are **not** raster images and **not** native
`c:chart` parts (which embed a workbook — see roadmap), so they stay editable as
shapes and render identically everywhere.

```yaml
- chart: { type: donut, t: "Share", items: [["A", 30], ["B", 50], ["C", 20]] }
- chart: { type: bar,  t: "Gains", values: true, items: [["Q1", 35], ["Q2", 42]] }
- chart:
    type: area
    t: "Growth"
    x: ["2023", "2024", "2025"]
    series: [{ name: "Market", data: [62, 137, 279] }]
```

### Gradients (first-principles abstraction)

`FillSpec` supports `solid`, `linearGradient`, and `radialGradient`:

- **solid** → `<a:solidFill>`
- **linear** → `<a:gradFill>` with `<a:lin>` (angle in 60000ths of a degree)
- **radial** → native path gradient `<a:path path="circle">` (closest editable
  equivalent), with a documented `fallback: "solid" | "raster"` for renderers
  that disagree.

---

## MVP limitations

- **Macros**: `title`, `cards`, `wf`, `kpi`, `bullets`, `section`, `cmp`,
  `chart`, `timeline`, and `summary` are fully implemented. `arch` and `roadmap`
  are **stubbed** — they render a titled placeholder panel and emit a
  `stub-macro` warning.
- **Charts** are editable vector shapes, not native `c:chart` parts (which embed
  a spreadsheet); you can recolor/reshape them but not edit them via the chart
  data dialog. TODO: optional native chart export.
- **Card styling classes**: `cards-colorful` / `accent-multi` (per-card palette
  colors), `card-tinted`, `accent-top`, `accent-left`, `numbered`, and accents
  `accent-{blue,green,purple,orange,teal,pink}`; `footer` / `no-footer` toggle
  the slide footer.
- **Text fitting** is conservative (character-estimate shrink with extra
  padding to avoid overflow). It is **not pixel-accurate**. TODO: calibrate
  against the real PowerPoint text engine.
- **Icons** are real [lucide](https://lucide.dev) icons, converted into
  **editable PowerPoint geometry** — see "Icons" below. Unknown names fall back
  to a lettered mini-circle.
- **Radial gradients** compile to a native path gradient; appearance can differ
  from CSS/browser radial gradients.
- **Freeform geometry** is compiled to native `<a:custGeom>` when a shape
  carries parsed `geometry.segments` (this is what powers lucide icons). The
  convenience authoring fields `geometry.points` / `geometry.path` (raw strings)
  are not yet auto-parsed at author time — they're parsed for icons via
  `geometry/svgPath.ts`. TODO: wire raw author-supplied paths through the parser.
- **Speaker notes** are captured in the scene (`slide.notes`) but not yet
  emitted as notes slides.

---

## Roadmap

- Arbitrary SVG / logo import (the SVG→custGeom path importer already powers
  lucide icons; generalize it to full SVG documents)
- Filled / duotone icon variants
- Native `c:chart` export (editable chart data) alongside the vector charts
- Tables
- Image handling
- Speaker notes parts
- More macros: `arch` (layered diagram), `roadmap`, `quote`, `split` (text +
  visual), `table`, `gallery`/`image`, `pyramid`/`funnel`, `matrix` (2×2)
- Animations / transitions
- Custom freeform geometry compiler (polygons, blobs, ribbons, connector paths)
- PowerPoint render-calibration loop + visual diff validation

---

## Project layout

```text
src/
  core/        types, units (EMU), color, xml helpers
  dsl/         schema (zod), parseDeckSpec, normalize
  themes/      defs (palettes), buildTheme (palette→theme), registry + 4 themes
  classes/     classMap (utility classes), resolveClasses
  layout/      boxes, grid, workflow, title
  geometry/    shapePresets, svgPath (parser + arc→bézier), icons (lucide), charts
  macros/      expandDeck, titleSlide, cardsSlide, workflowSlide, kpiSlide,
               bulletsSlide, sectionSlide, cmpSlide, chartSlide, timelineSlide,
               summarySlide, gaugeSlide, pyramidSlide, tableSlide, shared
  agent/       env, openai, formatGuide, storyboard, contentAgent,
               designAgent, orchestrate (content→design→DeckSpec→pptx)
  compiler/pptx/  contentTypes, relationships, presentationXml, themeXml,
                  masterXml, layoutXml, slideXml, parts, buildPptx,
                  ooxmlFill, ooxmlShape, ooxmlText, ooxmlEffects
  preview/     svgRenderer
  validation/  warnings, validateScene
  cli.ts       build / inspect
  index.ts     public API (parse → expand → compile / render)
```

## Tests

```bash
npm test
```

Covers YAML/JSON parsing, class resolution, the SVG path parser (incl.
arc→bézier and a real lucide path), the lucide icon builder (custGeom segments,
aliases, fallback), scene generation from the example deck, the PPTX package
contents (required parts present), editable shape/text/arrow XML, the
`<a:custGeom>` icon geometry, and the presence of `<a:gradFill>` when
`bg-gradient-soft` is used.

## License

MIT

## Services (general + premium) in Docker

`docker compose` runs **both** services from the one `slidewind:slim` image:

- **slidewind** (`:8081`) — deck generation API, general **and** premium.
- **imagesvc** (`:8082`) — image generation microservice (premium), prompt-hash cached.

```
docker compose --env-file .env up -d           # starts both, wired together
curl localhost:8081/health                      # -> imageService: http://imagesvc:8082

# standard deck:
curl -s localhost:8081/generate -H 'content-type: application/json' \
  -d '{"topic":"...","theme":"midnight","pages":10}' | jq -r .pptxBase64 | base64 -d > deck.pptx

# premium deck (~40% photographic images via imagesvc):
curl -s localhost:8081/generate -H 'content-type: application/json' \
  -d '{"topic":"...","premium":true,"imagePct":40,"imageQuality":"medium"}' -o resp.json
```

Decks are also written to the `/out` volume (`examples/out/api/`). The CLI still works too:
`node dist/cli.js generate --topic "..." --premium` (set `IMAGE_SERVICE_URL` to use the service,
else images generate in-process).

- Image homes: full-bleed title/section backgrounds (with scrim) + contained `showcase`/`highlight`.
- Env: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_IMAGE_MODEL` (default gpt-image-2), `IMAGE_CACHE_DIR`,
  `IMAGE_SERVICE_URL`, `SLIDEWIND_TOKEN`/`IMAGE_SVC_TOKEN` (optional auth).
- Premium is opt-in; standard decks are unchanged.
