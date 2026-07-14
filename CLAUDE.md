# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Slidewind is "Tailwind CSS for editable PowerPoint." An LLM writes a compact
**DeckSpec Lite** (YAML/JSON with semantic blocks + utility classes); Slidewind
expands it into an explicit **PPTScene** and hand-emits an OOXML `.pptx` package
(via `jszip`) so every object is real, editable PowerPoint — not a raster image
and not a wrapper around `pptxgenjs`/`python-pptx`. See `README.md` for the full
feature tour.

## Commands

```bash
npm run build          # tsc → dist/ (the published artifact; bin = dist/cli.js)
npm test               # vitest run (all tests under tests/)
npm run test:watch     # vitest watch mode
npx vitest run tests/macros2.test.ts   # single test file
npx vitest run -t "donut"              # single test by name

# Run the CLI from source without building (tsx):
npm run dev -- build examples/deck.yaml -o examples/out/demo.pptx --preview
npm run dev -- inspect examples/deck.yaml          # dump parsed spec, tokens, scene, warnings
npm run dev -- generate --topic "AI in logistics" --theme indigo --mode dark -o out/x.pptx
npm run demo           # shorthand: build examples/deck.yaml with preview

npm run serve          # Fastify HTTP API on :8081 (src/services/server.ts)
```

- There is **no separate lint step**; type-checking happens via `npm run build`.
  `tsconfig.json` is strict (`noUnusedLocals`/`noUnusedParameters`), so unused
  symbols fail the build.
- `generate` and the server require `OPENAI_API_KEY` (pass a `.env` with
  `--env <path>`, or set it in the environment). `--premium` images additionally
  use `OPENAI_IMAGE_MODEL` / `IMAGE_SERVICE_URL`.
- `--pdf` shells out to LibreOffice (`src/compiler/pdf.ts`); the Docker image
  bakes it in. Without LibreOffice, PDF export is skipped with a warning, not an
  error.

## The pipeline (read this before changing rendering)

```
DeckSpec Lite ──dsl/parseDeckSpec (+ dsl/schema zod)──▶ DeckSpec
   ──classes/resolveClasses (utility classes → tokens)──▶
   ──macros/expandDeck (one expander per macro)──▶ PPTScene  (explicit, in inches)
   ──validation/validateScene──▶
   ──compiler/pptx/* (contentTypes, relationships, presentation, theme, master,
     layout, slideXml + ooxmlFill/Shape/Text/Effects)──▶ .pptx (jszip)
                                  └── preview/svgRenderer : PPTScene → SVG (debug)
```

`src/index.ts` is the public API and `compileDeck()` the high-level entry;
`src/cli.ts` wires the same stages for `build`/`inspect`/`generate`.

## The generation (LLM) pipeline — `src/agent/`

`generate`/the server call `orchestrate.ts:generateDeck()`, which chains more
stages than just content→design:

```
prefs (topic, theme, mode, pages)
  ─▶ storyboard.planStoryboard()   deterministic slide-type plan (variety by construction)
  ─▶ research.researchTopic()      web grounding (Tavily; webSearchFallback) — optional
  ─▶ contentAgent.generateContent()  structured content per page (OpenAI)
  ─▶ designAgent.designDeck()      → slides JSON; validate (zod) → repairDeck() once
  ─▶ artDirector.illustrateDeck()  premium image direction → imageClient/imageGen
  ─▶ DeckSpec → expandDeck → PPTScene
```

OpenAI access is centralized in `agent/openai.ts`; `agent/env.ts` loads the
`.env`. `formatGuide.ts` mirrors `SKILL.md` into the model prompt — keep the two
in sync (see the SKILL.md section below).

## The generation server & persistence — `src/services/` + `src/db/`

`services/server.ts` (Fastify, port `SLIDEWIND_PORT`/8081) wraps the generator
with a user/credit layer; `services/imagesvc.ts` is the separate premium-image
microservice (8082). Key behaviors:

- **Degrades gracefully without a DB:** when `DATABASE_URL` is unset the service
  runs "untracked" — no credits, no persistence — exactly like the prototype.
  `db/pool.ts` exposes `dbEnabled`; guard DB work with it.
- **Schema lives in one place:** `db/migrate.ts` is idempotent (`IF NOT EXISTS`,
  additive `ALTER`s) and runs on boot — edit it, don't write ad-hoc migrations.
- **Credits** (`db/credits.ts`) meter generation at 1 credit/page with a monthly
  freemium allowance (`FREE_MONTHLY_CREDITS`); `charge` throws
  `InsufficientCreditsError`. **Auth**: JWT (`@fastify/jwt`) with the `sub` claim
  as user id; slidewind can also be the auth backend itself (scrypt hashes via
  `services/passwords.ts`, `role` gates admin routes).
- Generated scenes are persisted so the canvas editor (`GET /deck/:id/editor`,
  `POST /deck/:id/build`, backed by `core/deckEdit.ts`) survives restarts.

**The core invariant:** the LLM never writes coordinates, font sizes, gradient
XML, or OOXML. Everything geometric/visual is *owned* by Slidewind (themes,
spacing/typography scales, layout, text fitting, shape geometry, OOXML
emission). When adding a feature, keep author-facing input minimal and put the
richness in the expander/compiler. Unknown utility classes and unknown icons
emit a **warning** (`validation/warnings.ts`) — never crash.

## Conventions that bite

- **ESM + NodeNext.** `package.json` is `"type": "module"`. All relative
  imports must carry a `.js` extension even though the source is `.ts`
  (e.g. `import { expandDeck } from "./macros/expandDeck.js"`). Omitting it
  breaks the build.
- **No `Date.now`/`Math.random` purity issues** here, but tests run under
  vitest with `globals: false` — import `describe`/`it`/`expect` explicitly.
- Adding a macro means: a `macros/<name>Slide.ts` expander, wiring it in
  `macros/expandDeck.ts`, extending the zod schema in `dsl/schema.ts`, and (if
  it has length-bounded fields) a budget in `core/capacity.ts`.

## The LLM authoring contract — `SKILL.md`

`SKILL.md` is the strict spec the content/design agents follow to emit deck
JSON: every macro's exact field shape, the tuple ordering of `items`, the
per-field character **capacity budgets**, and the icon list. The agent pipeline
(above) and `agent/formatGuide.ts` mirror these rules. **If you change a macro's
shape or a capacity budget in
code, update `SKILL.md` (and `core/capacity.ts`) to match** — they are the
contract the model is prompted against, and drift produces validation failures
that the one repair round in `orchestrate.ts` may not fix.

Note: `README.md`'s "MVP limitations" section is dated — many macros it lists as
stubbed/missing (`table`, `pyramid`, `gauge`, `roadmap`, `agenda`, `problem`,
`stat`, `criteria`, `highlight`, `spine`, `columns`, `radial`, `funnel`,
`showcase`) are now implemented. `SKILL.md`'s macro list is the authoritative
inventory.

## Multiple packages in this repo

- **Root** (`/`) — the library + CLI + generation server (this is the main one).
- **`front/web/`** — a separate Vite + React + three.js web UI with its own
  `package.json` (`npm run dev`/`build` from inside that dir). Not built by the
  root `npm run build`.
- **`src/services/imagesvc.ts`** — the premium image-generation microservice
  (port 8082), run alongside the deck API via `docker-compose.yml`.
- `deploy/` holds PM2 (`ecosystem.config.cjs`), nginx config, and `DEPLOY.md`.
