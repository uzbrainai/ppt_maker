import { buildTheme } from "./buildTheme.js";
import { THEME_DEFS } from "./defs.js";

/** modern.enterprise — clean light corporate theme (default appearance: light). */
export const modernEnterprise = buildTheme(
  "modern.enterprise",
  THEME_DEFS["modern.enterprise"].light,
  "light"
);
