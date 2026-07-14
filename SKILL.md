# slidewind — Deck authoring SKILL (strict rules for the agent)

You output a deck as JSON: `{ "slides": [ <slide>, ... ] }`. Each slide is an
object with **exactly one** macro key. These rules are MANDATORY.

## Global
- DO NOT set `format`, `theme`, `appearance`, `size` — the system adds them.
- One macro key per slide object. No extra/unknown keys.
- All visible text in the requested language.
- Obey the capacity budgets (see table). Shorter is better; the engine truncates
  over-budget text, so respect the limits.
- Variety: never repeat a content slide type until every other type has been
  used. Follow the exact storyboard you are given (one slide per planned line).

## Field shorthands (used across macros)
- `t` = title (heading)         `s` = subtitle / lead sentence
- `n` = section number ("01")   `note` = summary paragraph under cards
- `class` = optional utility classes string

## Array item shapes — ORDER MATTERS
Each `items`/`steps` entry is a tuple array in this exact order:
- cards / summary → `["<icon>", "<title>", "<body>"]`
- wf `steps`      → `["<icon>", "<title>", "<body>"]`
- bullets         → `["<title>", "<body>"]`   (no icon)
- kpi             → `["<value>", "<label>"]`  (value is a number like "+40%")
- timeline        → `["<node>", "<title>", "<body>"]`  (node ≤ 6 chars: a year/number)
- chart bar/donut → `["<label>", <number>]`
- cmp `items`     → OBJECTS: `{ "t": "<header>", "icon": "<icon>", "tone": "good|bad|neutral", "points": ["...", ...] }`

## Charts — pick the right data shape
- `type: "bar"` or `"donut"`  → use `items: [["Label", 30], ...]`. DO NOT use `series`.
- `type: "line"` or `"area"`  → use `x: ["2021","2022", ...]` + `series: [{ "name": "...", "data": [n, n, ...] }]`. DO NOT use `items`.
- `type: "scatter"`           → `series: [{ "name": "...", "points": [[x,y], ...] }]`.
- A chart is NEVER alone: ALWAYS add `insightTitle` and `points: [...]` (and `s` for line/area).
- Single-accent bar/donut auto-color by INTENSITY (largest value = most saturated). Add `"pattern": true`
  to fill segments with distinct thin white patterns (lines/dots/zebra) — good for monochrome charts.

## Always fill enrichment fields (richness)
- cards → `note` (1–2 sentence recap)        wf → `callout`
- chart → `insightTitle` + `points` (+ `s`)  timeline → `body` per item + `callout`
- bullets → a body for each item             cmp → 3–4 `points` per column with `tone`
- section → `s`                              summary → 3–4 items with bodies

## Macro quick reference (one key per slide)
- `title`    { t, s, class:"hero bg-gradient-primary title-xl" }
             A geometric cover effect is applied automatically. To force one, add
             ONE of: `decor-rings | decor-grid | decor-blobs | decor-mesh |
             decor-waves | decor-scatter | decor-arcs` (or `decor-none` to disable).
- `section`  { n, t, s, class:"bg-gradient-primary" }
- `cards`    { t, items:[[icon,title,body]...], note, class:"grid-3x2 cards-colorful card-tinted accent-top icons-line" }
- `kpi`      { t, items:[[value,label]...], class:"grid-4x1 accent-multi" }
- `bullets`  { t, s, items:[[title,body]...], class:"numbered accent-purple" }
- `wf`       { t, steps:[[icon,title,body]...], callout, class:"workflow-5 cards elevated arrows-soft accent-blue" }
- `cmp`      { t, items:[{t,icon,tone,points[]}, ...] }
- `chart`    { type, t, (items | x+series), insightTitle, points, s, values:true }
- `timeline` { eyebrow:"TIMELINE", t, items:[[node,title,body]...], callout }
- `summary`  { t, s, items:[[icon,title,body]...], class:"accent-blue" }
- `gauge`    { t, items:[[value,title,body]...] }   value is a PERCENT like "78%"; renders ring gauges
- `pyramid`  { eyebrow, t, items:[[title,body]...] }   layers apex→base (item 0 = top); shows a matching numbered list
- `table`    { t, columns:["A","B","C"], rows:[["x", 12, "y"], ...], summary:"<bottom note>" }
             header + zebra rows; numeric columns auto right-align; keep cells short (≤40 chars)
- `agenda`   { t, items:["About Us","Vision", ...] }   numbered pill rows, auto two-column; a deck opener / table of contents
- `roadmap`  { eyebrow, t, items:[["PHASE 1","MVP Launch","short desc"]...], callout }
             phase circles on a looping path, labels alternating above/below
- `problem`  { t, items:[["Problem title","1–2 sentence detail"]...] }
             big 01/02/03 cards with alternating accent/ink/light fills (3 items ideal)
- `stat`     { eyebrow:"<1 word>", t, items:[ {type:"bar"|"line", t, body, items:[[label,val]...] | x+series } ... ] }
             2–3 panels, each a chart over a caption; `eyebrow` is a 1-word rotated side label (e.g. "Statistic")
- `criteria` { t, s, items:[["Title","short body"]...] }   numbered circles + connector + cards, 2 columns (4–6 items)
- `highlight`{ t, s, featured:"<1–2 words>", icon:"<lucide>", items:["Pill A","Pill B", ...] }
             left statement (t + s) + a featured card (short heading + a decorative ICON, not a chart)
             + outlined pill list. `featured` = 1–2 words tied to the title; `icon` = a relevant lucide name.
- `spine`    { brand, t, items:[["Heading","paragraph"]...] }   left title + right list on a curved spine (3–4 items)
- `columns`  { t, s, items:[[icon,title,body]...] }   header band + 2–4 full-height text columns (icon optional)
- `radial`   { t, center, items:[["Label","detail"]...] }   ring split into N numbered segments + a matching list (2–6)
- `funnel`   { eyebrow, t, items:[["Stage","detail"]...] }   stacked narrowing stages + side detail (3–6, widest first)
- `showcase` { t, s, points:["...","..."], image:{ src|prompt } }   hero image beside title + points (class "image-left" to flip)
  - Image fields (premium): `title`/`section` take `image` for a full-bleed background; `highlight` takes `image`
    for the featured card. Authors use `image:{ src:"path.png" }`; premium fills `image` automatically.
- chart `type:"barh"`  → horizontal bars (same data as bar: items:[[label,val]...]); good for ranked magnitudes

Use `table` for structured/tabular data (specs, comparisons across many attributes, plans, pricing).
Use `gauge` for a set of percentage indicators (adoption %, accuracy %, share %).
Use `pyramid` for a hierarchy / maturity levels / priority stack (3–5 layers).
Use `agenda` as the second slide (table of contents). Use `problem` for a pains/gaps slide.
Use `roadmap` for phased plans; `stat` to show 2–3 charts side-by-side with takeaways.

## Capacity (max characters per field)
- slide title 60 · card title 26 · card body 80 · card note 220
- kpi value 6 · kpi label 48
- bullets title 40 · bullets body 90
- wf title 18 · wf body 60 · callout 120
- cmp header 22 · cmp point 56
- timeline node 6 · timeline title 22 · timeline body 70
- section title 48 · section subtitle 80
- summary item title 36 · summary item body 80 · chart insight point 70
- agenda item 30 · roadmap node 10 · roadmap title 28 · roadmap body 90
- problem title 40 · problem body 160 · stat title 40 · stat body 220
- criteria title 28 · criteria body 90 · highlight title 60 · highlight body 260 · highlight item 30
- spine title 28 · spine body 200

## Icons (lucide names)
brain, bot, shield, chart-column, stethoscope, microscope, pill, heart-pulse,
dna, file-search, database, user-check, check, x, zap, rocket, users, lightbulb,
settings, lock, eye, message-square, trending-up, sprout, factory, car, truck,
graduation-cap, book-open, landmark, banknote, network, cpu, activity, sparkles,
map-pin, shopping-cart, gavel, scan-search, camera, languages, layout-dashboard.

Output strictly `{ "slides": [ ... ] }` and nothing else.
