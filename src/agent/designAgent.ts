/**
 * Design agent — decides slide order and maps content onto slidewind macros,
 * emitting the `slides` array in our JSON format. It owns: which macro fits each
 * section, how to sequence them (title → sections w/ dividers → summary →
 * closing), and honoring the capacity budgets via the format guide.
 */

import { chat, parseJson } from "./openai.js";
import { formatGuide } from "./formatGuide.js";
import type { ContentPlan, DeckPrefs } from "./contentAgent.js";
import { type StoryStep, storyboardText } from "./storyboard.js";

export interface SlidesDoc {
  slides: unknown[];
}

export async function designDeck(
  content: ContentPlan,
  prefs: DeckPrefs,
  storyboard: StoryStep[]
): Promise<unknown[]> {
  const user = `User preferences: theme="${prefs.theme ?? "modern.enterprise"}", appearance="${prefs.appearance ?? "default"}", language="${content.language}".
(The system applies theme/appearance/size — do NOT add them.)

PRODUCE EXACTLY THESE SLIDES, IN THIS ORDER (one slide per line, same type, no extras, no reordering):
${storyboardText(storyboard)}

Hard rules:
- One slide per planned line, in order. Do NOT repeat a slide type beyond what the plan specifies.
- FILL EACH SLIDE RICHLY — use the fuller end of every budget and ALWAYS populate the enrichment
  fields: cards→"note"; chart→"insightTitle"+"points" (and "s" for line/area); wf→"callout";
  bullets→sub-body for each item; cmp→3–4 "points" per column with tone good/bad; timeline→"body"
  per item + "callout"; section→"s"; summary→3–4 items with bodies. Pick fitting lucide icons.
- Map the CONTENT PLAN below onto these slides (use the richest, most specific material; don't invent
  generic filler). Charts must use the datasets from the content. All text in language "${content.language}".
- Respect every character budget; timeline node labels ≤ 6 chars.

CONTENT PLAN (JSON):
${JSON.stringify(content, null, 2)}

Return STRICT JSON: { "slides": [ ... ] } with exactly ${storyboard.length} slides.`;

  const reply = await chat({
    system: formatGuide(),
    user,
    json: true,
    model: prefs.model,
    temperature: 0.4,
    maxTokens: 4000,
  });
  const doc = parseJson<SlidesDoc>(reply);
  if (!doc.slides || !Array.isArray(doc.slides) || doc.slides.length === 0) {
    throw new Error("Design agent returned no slides.");
  }
  return doc.slides;
}

/** One repair round: ask the design agent to fix slides that failed validation. */
export async function repairDeck(
  slides: unknown[],
  problems: string,
  prefs: DeckPrefs
): Promise<unknown[]> {
  const user = `These slides were rejected or dropped by the validator. Fix them and return corrected JSON.
Keep all valid slides; correct only what's wrong (wrong/missing keys, over-budget text, unknown macro,
chart without explanation, timeline node > 6 chars, etc.).

PROBLEMS:
${problems}

CURRENT SLIDES JSON:
${JSON.stringify({ slides }, null, 2)}

Return STRICT JSON: { "slides": [ ... ] }.`;
  // Repair rewrites most/all of the deck plus problem context, so it needs at
  // least as much headroom as the initial design call. Undersizing this used
  // to truncate the JSON mid-output and crash the request.
  const reply = await chat({ system: formatGuide(), user, json: true, model: prefs.model, temperature: 0.2, maxTokens: 6000 });
  try {
    const doc = parseJson<SlidesDoc>(reply);
    return Array.isArray(doc.slides) && doc.slides.length ? doc.slides : slides;
  } catch (e) {
    // The repair reply was malformed or truncated — never crash the whole
    // generation over a repair pass. Keep the pre-repair slides; the validator
    // already dropped/corrected the worst offenders, and the caller will
    // surface any remaining warnings.
    console.error(`[designAgent] repair reply unparseable, keeping original slides :: ${(e as Error).message}`);
    return slides;
  }
}
