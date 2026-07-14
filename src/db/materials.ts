/**
 * Per-user generated materials (decks). The full PPTScene is stored as JSONB so
 * the canvas editor and rebuilds work across server restarts and stay owned by
 * the user who generated them.
 */

import { query } from "./pool.js";
import type { PPTScene } from "../core/types.js";

export interface MaterialMeta {
  id: string;
  userId: string;
  kind: string;
  title: string;
  pages: number;
  theme: string | null;
  lang: string | null;
  premium: boolean;
  cover: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialRecord extends MaterialMeta {
  scene: PPTScene;
  yaml: string | null;
}

export interface SaveMaterialInput {
  id: string;
  userId: string;
  title: string;
  kind?: string;
  pages: number;
  theme?: string;
  lang?: string;
  premium?: boolean;
  cover?: string;
  yaml?: string;
  scene: PPTScene;
}

/** Insert (or upsert) a material owned by a user. */
export async function saveMaterial(input: SaveMaterialInput): Promise<void> {
  await query(
    `INSERT INTO materials (id, user_id, kind, title, pages, theme, lang, premium, cover_svg, yaml, scene)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title, pages = EXCLUDED.pages, theme = EXCLUDED.theme,
       lang = EXCLUDED.lang, premium = EXCLUDED.premium, cover_svg = EXCLUDED.cover_svg,
       yaml = EXCLUDED.yaml, scene = EXCLUDED.scene, updated_at = now()`,
    [
      input.id,
      input.userId,
      input.kind ?? "ppt",
      input.title,
      input.pages,
      input.theme ?? null,
      input.lang ?? null,
      input.premium ?? false,
      input.cover ?? null,
      input.yaml ?? null,
      JSON.stringify(input.scene),
    ]
  );
}

/** Replace the stored scene + title for a material (after an editor save). */
export async function updateMaterialScene(id: string, scene: PPTScene, title?: string): Promise<void> {
  await query(
    `UPDATE materials SET scene = $2, title = COALESCE($3, title),
       pages = $4, updated_at = now() WHERE id = $1`,
    [id, JSON.stringify(scene), title ?? null, scene.slides.length]
  );
}

const META_COLS =
  "id, user_id, kind, title, pages, theme, lang, premium, cover_svg, created_at, updated_at";

type MetaRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  pages: number;
  theme: string | null;
  lang: string | null;
  premium: boolean;
  cover_svg: string | null;
  created_at: Date;
  updated_at: Date;
};

function toMeta(r: MetaRow): MaterialMeta {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    title: r.title,
    pages: r.pages,
    theme: r.theme,
    lang: r.lang,
    premium: r.premium,
    cover: r.cover_svg,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

/** List a user's materials, newest first (metadata only — no scene/yaml). */
export async function listMaterials(userId: string, limit = 100): Promise<MaterialMeta[]> {
  const { rows } = await query<MetaRow>(
    `SELECT ${META_COLS} FROM materials WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2`,
    [userId, limit]
  );
  return rows.map(toMeta);
}

/** Fetch a single material with its scene. Returns null if it doesn't exist. */
export async function getMaterial(id: string): Promise<MaterialRecord | null> {
  const { rows } = await query<MetaRow & { scene: PPTScene; yaml: string | null }>(
    `SELECT ${META_COLS}, scene, yaml FROM materials WHERE id = $1`,
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { ...toMeta(r), scene: r.scene, yaml: r.yaml };
}
