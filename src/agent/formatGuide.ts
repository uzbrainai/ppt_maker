/**
 * The DeckSpec authoring guide handed to the design agent. It enumerates the
 * available slide macros (as JSON shapes), utility classes, and the capacity
 * budgets, so the model emits valid, well-fitting slides.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CAPACITY } from "../core/capacity.js";
import { CLASS_MAP } from "../classes/classMap.js";
import { THEME_NAMES } from "../themes/index.js";

/** Load SKILL.md (the canonical strict-rules doc) if present. */
function loadSkill(): string | undefined {
  const here = dirname(fileURLToPath(import.meta.url)); // dist/agent or src/agent
  const candidates = [
    resolve(process.cwd(), "SKILL.md"),
    resolve(here, "../../SKILL.md"),
    resolve(here, "../../../SKILL.md"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  return undefined;
}

export function formatGuide(): string {
  // Prefer the editable SKILL.md as the agent's contract; append the live
  // capacity table + class list so they never drift from the code.
  const skill = loadSkill();
  if (skill) {
    return `${skill}

CLASSES available for "class": ${Object.keys(CLASS_MAP).join(", ")}
THEMES (system-set, do not choose): ${THEME_NAMES.join(", ")}`;
  }
  return legacyGuide();
}

function legacyGuide(): string {
  const classes = Object.keys(CLASS_MAP).join(", ");
  const C = CAPACITY;
  return `You design a slide deck as a JSON array of SLIDE objects for the "slidewind" engine.
Return ONLY JSON of the form: { "slides": [ <slide>, ... ] }. No prose.

Each slide is an object with exactly ONE of these macro keys:

1) title  (use once, first slide)
   { "title": { "class": "hero bg-gradient-primary title-xl", "t": "<deck title ≤${C.title.title.maxChars}>", "s": "<subtitle ≤${C.title.subtitle.maxChars}>" } }

2) section  (chapter divider; use to group the deck)
   { "section": { "class": "bg-gradient-primary", "n": "01", "t": "<≤${C.section.title.maxChars}>", "s": "<≤${C.section.subtitle.maxChars}>" } }

3) kpi  (3–4 big stats; only if you have real numbers)
   { "kpi": { "class": "grid-4x1 accent-multi", "t": "<title>", "items": [ ["<value ≤${C.kpi.value.maxChars} e.g. +40%>", "<label ≤${C.kpi.label.maxChars}>"], ... ] } }

4) cards  (2–6 feature cards; add a "note" summary sentence to fill the page)
   { "cards": { "class": "grid-3x2 cards-colorful card-tinted accent-top icons-line gap-md", "t": "<title>",
       "items": [ ["<icon>", "<title ≤${C.card.title.maxChars}>", "<body ≤${C.card.body.maxChars}>"], ... ],
       "note": "<1–2 sentence recap ≤${C.card.note.maxChars}>" } }

5) bullets  (numbered/dotted list; up to ~6)
   { "bullets": { "class": "numbered accent-purple", "t": "<title>", "s": "<optional lead>",
       "items": [ ["<title ≤${C.bullets.title.maxChars}>", "<body ≤${C.bullets.body.maxChars}>"], ... ] } }

6) wf  (left→right process, 3–6 steps)
   { "wf": { "class": "workflow-5 cards elevated arrows-soft accent-blue", "t": "<title>",
       "steps": [ ["<icon>", "<title ≤${C.wf.title.maxChars}>", "<body ≤${C.wf.body.maxChars}>"], ... ],
       "callout": "<≤${C.wf.callout.maxChars}>" } }

7) cmp  (comparison, 2–3 columns; tone good|bad|neutral)
   { "cmp": { "t": "<title>", "items": [ { "t": "<header ≤${C.cmp.header.maxChars}>", "icon": "<icon>", "tone": "good",
       "points": ["<≤${C.cmp.point.maxChars}>", ...] }, ... ] } }

8) chart  (NEVER alone — always include "s" and/or "points" as explanation)
   bar/donut:  { "chart": { "type": "bar|donut", "t": "<title>", "values": true,
       "items": [ ["<label>", <number>], ... ], "insightTitle": "<short>", "points": ["<insight ≤${C.chart.insightPoint.maxChars}>", ...] } }
   line/area:  { "chart": { "type": "area|line", "t": "<title>", "x": ["2021","2022", ...],
       "series": [ { "name": "<name>", "data": [<numbers>] } ], "s": "<trend sentence>", "points": [ ... ] } }
   scatter:    { "chart": { "type": "scatter", "t": "<title>", "series": [ { "name": "<n>", "points": [[x,y], ...] } ], "s": "..." } }

9) timeline  (full-width dated milestones; node label MUST be ≤${C.timeline.node.maxChars} chars — a year or number)
   { "timeline": { "eyebrow": "TIMELINE", "t": "<title>",
       "items": [ ["<node ≤${C.timeline.node.maxChars}>", "<title ≤${C.timeline.title.maxChars}>", "<body ≤${C.timeline.body.maxChars}>"], ... ],
       "callout": "<≤${C.timeline.callout.maxChars}>" } }

10) summary  (recap near the end)
   { "summary": { "class": "accent-blue", "t": "<≤${C.summary.title.maxChars}>", "s": "<lead>",
       "items": [ ["<icon>", "<title ≤${C.summary.itemTitle.maxChars}>", "<body ≤${C.summary.itemBody.maxChars}>"], ... ] } }

ICONS: use lucide names, e.g. brain, bot, shield, chart-column, stethoscope, microscope, pill, heart-pulse, dna,
file-search, database, user-check, check, zap, rocket, users, lightbulb, settings, lock, eye, message-square,
trending-up, sprout, factory, car, truck, graduation-cap, book-open, landmark, banknote, network, cpu, activity.

UTILITY CLASSES you may put in "class": ${classes}

THEMES (set by the system, do not choose): ${THEME_NAMES.join(", ")}.

RULES:
- Respect every character budget above; shorter is better. Timeline node labels are tiny (years/numbers only).
- A chart slide must always carry an explanation (s and/or points) — never a chart alone.
- Vary slide types: open with title, use section dividers between groups, use kpi/chart for data, cards/bullets for
  qualitative points, wf for processes, cmp for trade-offs, summary before a closing section.
- Only emit a kpi or chart when the content actually has numbers; otherwise prefer cards/bullets.
- Output strictly the JSON object { "slides": [...] } and nothing else.`;
}
