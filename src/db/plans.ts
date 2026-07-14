/**
 * Plans catalog — subscription tiers and one-off token packs.
 * Displayed on the pricing page and editable from the admin panel.
 */

import { query } from "./pool.js";

export type PlanKind = "subscription" | "token";

export interface Plan {
  id: number;
  slug: string;
  name: string;
  kind: PlanKind;
  priceUzs: number;
  credits: number;
  monthlyAllowance: number | null;
  blurb: string | null;
  features: string[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  /** Percentage discount when the plan is billed annually. 0 = no yearly option. */
  yearlyDiscountPct: number;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: number;
  slug: string;
  name: string;
  kind: PlanKind;
  price_uzs: string;
  credits: number;
  monthly_allowance: number | null;
  blurb: string | null;
  features: string[] | null;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  yearly_discount_pct: number | null;
  created_at: Date;
  updated_at: Date;
};

function toPlan(r: Row): Plan {
  return {
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    priceUzs: Number(r.price_uzs),
    credits: r.credits,
    monthlyAllowance: r.monthly_allowance,
    blurb: r.blurb,
    features: Array.isArray(r.features) ? r.features : [],
    isActive: r.is_active,
    isPopular: r.is_popular,
    sortOrder: r.sort_order,
    yearlyDiscountPct: Math.max(0, Math.min(100, Math.floor(Number(r.yearly_discount_pct ?? 0)))),
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

/** All plans (admin view — includes inactive). */
export async function listAllPlans(): Promise<Plan[]> {
  const { rows } = await query<Row>(
    `SELECT * FROM plans ORDER BY kind, sort_order ASC, id ASC`
  );
  return rows.map(toPlan);
}

/** Only active plans (public pricing page). */
export async function listActivePlans(): Promise<Plan[]> {
  const { rows } = await query<Row>(
    `SELECT * FROM plans WHERE is_active = true ORDER BY kind, sort_order ASC, id ASC`
  );
  return rows.map(toPlan);
}

export async function getPlanBySlug(slug: string): Promise<Plan | null> {
  const { rows } = await query<Row>(`SELECT * FROM plans WHERE slug = $1 LIMIT 1`, [slug]);
  return rows[0] ? toPlan(rows[0]) : null;
}

export async function getPlanById(id: number): Promise<Plan | null> {
  const { rows } = await query<Row>(`SELECT * FROM plans WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ? toPlan(rows[0]) : null;
}

export interface UpsertPlanInput {
  slug: string;
  name: string;
  kind?: PlanKind;
  priceUzs?: number;
  credits?: number;
  monthlyAllowance?: number | null;
  blurb?: string | null;
  features?: string[];
  isActive?: boolean;
  isPopular?: boolean;
  sortOrder?: number;
  yearlyDiscountPct?: number;
}

export async function createPlan(input: UpsertPlanInput): Promise<Plan> {
  const { rows } = await query<Row>(
    `INSERT INTO plans (slug, name, kind, price_uzs, credits, monthly_allowance, blurb, features, is_active, is_popular, sort_order, yearly_discount_pct)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
     RETURNING *`,
    [
      input.slug,
      input.name,
      input.kind ?? "subscription",
      input.priceUzs ?? 0,
      input.credits ?? 0,
      input.monthlyAllowance ?? null,
      input.blurb ?? null,
      JSON.stringify(input.features ?? []),
      input.isActive ?? true,
      input.isPopular ?? false,
      input.sortOrder ?? 0,
      Math.max(0, Math.min(100, Math.floor(input.yearlyDiscountPct ?? 0))),
    ]
  );
  return toPlan(rows[0]!);
}

export async function updatePlan(id: number, patch: Partial<UpsertPlanInput>): Promise<Plan | null> {
  const sets: string[] = [];
  const values: unknown[] = [id];
  const push = (col: string, val: unknown) => {
    values.push(val);
    sets.push(`${col} = $${values.length}`);
  };
  if (patch.slug !== undefined) push("slug", patch.slug);
  if (patch.name !== undefined) push("name", patch.name);
  if (patch.kind !== undefined) push("kind", patch.kind);
  if (patch.priceUzs !== undefined) push("price_uzs", patch.priceUzs);
  if (patch.credits !== undefined) push("credits", patch.credits);
  if (patch.monthlyAllowance !== undefined) push("monthly_allowance", patch.monthlyAllowance);
  if (patch.blurb !== undefined) push("blurb", patch.blurb);
  if (patch.features !== undefined) {
    values.push(JSON.stringify(patch.features));
    sets.push(`features = $${values.length}::jsonb`);
  }
  if (patch.isActive !== undefined) push("is_active", patch.isActive);
  if (patch.isPopular !== undefined) push("is_popular", patch.isPopular);
  if (patch.sortOrder !== undefined) push("sort_order", patch.sortOrder);
  if (patch.yearlyDiscountPct !== undefined) {
    push("yearly_discount_pct", Math.max(0, Math.min(100, Math.floor(patch.yearlyDiscountPct))));
  }
  if (sets.length === 0) return getPlanById(id);
  sets.push(`updated_at = now()`);
  const { rows } = await query<Row>(
    `UPDATE plans SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
    values
  );
  return rows[0] ? toPlan(rows[0]) : null;
}

export async function deletePlan(id: number): Promise<void> {
  await query(`DELETE FROM plans WHERE id = $1`, [id]);
}
