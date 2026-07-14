/**
 * Normalization helpers that turn the terse authoring forms (tuples, missing
 * fields) into explicit objects the macro expanders can rely on.
 */

import type { ItemTuple, NormalizedItem, SlideSpec } from "../core/types.js";

/** Determine which macro a slide spec uses. */
export type SlideKind =
  | "title"
  | "cards"
  | "wf"
  | "kpi"
  | "bullets"
  | "section"
  | "cmp"
  | "chart"
  | "timeline"
  | "summary"
  | "gauge"
  | "pyramid"
  | "table"
  | "agenda"
  | "roadmap"
  | "problem"
  | "stat"
  | "criteria"
  | "highlight"
  | "spine"
  | "showcase"
  | "columns"
  | "radial"
  | "funnel"
  | "arch"
  | "unknown";

export function slideKind(slide: SlideSpec | Record<string, unknown>): SlideKind {
  const s = slide as Record<string, unknown>;
  if (s.title) return "title";
  if (s.cards) return "cards";
  if (s.wf) return "wf";
  if (s.kpi) return "kpi";
  if (s.bullets) return "bullets";
  if (s.section) return "section";
  if (s.cmp) return "cmp";
  if (s.chart) return "chart";
  if (s.timeline) return "timeline";
  if (s.summary) return "summary";
  if (s.gauge) return "gauge";
  if (s.pyramid) return "pyramid";
  if (s.table) return "table";
  if (s.agenda) return "agenda";
  if (s.roadmap) return "roadmap";
  if (s.problem) return "problem";
  if (s.stat) return "stat";
  if (s.criteria) return "criteria";
  if (s.highlight) return "highlight";
  if (s.spine) return "spine";
  if (s.showcase) return "showcase";
  if (s.columns) return "columns";
  if (s.radial) return "radial";
  if (s.funnel) return "funnel";
  if (s.arch) return "arch";
  return "unknown";
}

/** Normalize one `[icon, title, body]`-style tuple into a NormalizedItem. */
export function normalizeItem(item: ItemTuple): NormalizedItem {
  if (Array.isArray(item)) {
    if (item.length === 3) {
      return { icon: item[0], title: item[1], body: item[2] };
    }
    // length 2 → [title, body] (no icon)
    return { title: item[0], body: item[1] };
  }
  // object form
  return {
    icon: item.icon,
    title: item.title ?? item.t ?? "",
    body: item.body ?? item.s,
    group: item.group ?? item.g,
    len: item.len,
  };
}

export function normalizeItems(items: ItemTuple[]): NormalizedItem[] {
  return items.map(normalizeItem);
}
