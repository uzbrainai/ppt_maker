/**
 * Theme registry. Themes are 5-role palette pairs (light/dark); `resolveTheme`
 * builds a concrete Theme for the requested appearance, falling back to
 * modern.enterprise with a warning on unknown names.
 */

import type { Appearance, ResolvedTheme, ThemeDef } from "../core/types.js";
import type { Warnings } from "../validation/warnings.js";
import { buildTheme } from "./buildTheme.js";
import { THEME_DEFS, DEFAULT_THEME } from "./defs.js";

export { THEME_DEFS, DEFAULT_THEME };

/** Names of all registered themes. */
export const THEME_NAMES = Object.keys(THEME_DEFS);

function build(def: ThemeDef, appearance: Appearance): ResolvedTheme {
  return buildTheme(def.name, def[appearance], appearance);
}

/**
 * Resolve a theme by name + optional appearance. When appearance is omitted the
 * theme's natural (default) appearance is used.
 */
export function resolveTheme(
  name: string | undefined,
  appearance?: Appearance,
  warnings?: Warnings
): ResolvedTheme {
  let def = name ? THEME_DEFS[name] : THEME_DEFS[DEFAULT_THEME];
  if (!def) {
    warnings?.add("unknown-theme", `Unknown theme "${name}"; falling back to "${DEFAULT_THEME}".`);
    def = THEME_DEFS[DEFAULT_THEME];
  }
  return build(def, appearance ?? def.defaultAppearance);
}

/** Concrete default builds (back-compat / convenience). */
export { modernEnterprise } from "./modernEnterprise.js";
export { agrobankAi } from "./agrobankAi.js";
export { darkTech } from "./darkTech.js";

/** Map of name → default-appearance theme (used by inspect/tooling). */
export const THEMES: Record<string, ResolvedTheme> = Object.fromEntries(
  Object.values(THEME_DEFS).map((d) => [d.name, build(d, d.defaultAppearance)])
);
