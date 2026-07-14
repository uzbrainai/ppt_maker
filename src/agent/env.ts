/**
 * Minimal .env loader (no dependency). Reads KEY=VALUE lines and sets them on
 * process.env *without overriding* values already present. Never logs values.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/** Default places to look for a .env, in order. */
const DEFAULT_ENV_PATHS = [
  ".env",
  // The user's shared key store.
  "/Users/genagent/WORKSTATION/PROJECTS/pptmake/.env",
];

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // strip surrounding quotes (and keep their contents verbatim)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else {
      // unquoted: drop a trailing inline comment (` # ...`) and re-trim. The
      // shipped .env.example annotates values this way (e.g. `PORT=8091  # ...`).
      const hash = val.search(/\s+#/);
      if (hash !== -1) val = val.slice(0, hash).trim();
    }
    if (key) out[key] = val;
  }
  return out;
}

/**
 * Load a .env file into process.env (without overriding existing vars).
 * Returns the resolved path that was loaded, or undefined if none found.
 */
export function loadEnv(path?: string): string | undefined {
  const candidates = path ? [path] : DEFAULT_ENV_PATHS;
  for (const c of candidates) {
    const p = resolve(c);
    if (!existsSync(p)) continue;
    const vars = parseEnv(readFileSync(p, "utf8"));
    for (const [k, v] of Object.entries(vars)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
    return p;
  }
  return undefined;
}

/** Read a required env var or throw a helpful error (never prints the value). */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing ${name}. Provide it via --env <path-to-.env> or the environment.`
    );
  }
  return v;
}
