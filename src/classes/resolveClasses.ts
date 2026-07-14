/**
 * Resolve a Tailwind-like class string into structured tokens.
 *
 * Unknown classes produce a warning (code "unknown-class") but never throw.
 */

import { CLASS_MAP, type ResolvedClasses } from "./classMap.js";
import { Warnings } from "../validation/warnings.js";

export interface ResolveResult {
  tokens: ResolvedClasses;
  warnings: Warnings;
}

export function resolveClasses(
  classString: string | undefined,
  where?: string
): ResolveResult {
  const warnings = new Warnings();
  const tokens: ResolvedClasses = { applied: [] };

  const names = (classString ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const name of names) {
    const patch = CLASS_MAP[name];
    if (!patch) {
      warnings.add("unknown-class", `Unknown utility class "${name}" ignored.`, where);
      continue;
    }
    patch(tokens);
    tokens.applied.push(name);
  }

  return { tokens, warnings };
}

/** Accent class → theme-relative hex chooser is done at layout time; here we
 * only expose a convenience for tests/inspection. */
export const ACCENT_HEX: Record<string, string> = {
  blue: "#2563EB",
  green: "#15803D",
  purple: "#7C3AED",
};
