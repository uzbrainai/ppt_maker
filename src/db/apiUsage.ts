/**
 * External API usage log + aggregators for the admin dashboard.
 *
 * Every outbound call to OpenAI (chat / search / image), Tavily, or the premium
 * image microservice is written here fire-and-forget from the call sites. The
 * admin `/admin/api-usage/*` endpoints read summaries, per-provider timeseries,
 * and top spenders off this table.
 *
 * Costs are stored in USD-micros (integer) so we can SUM without float drift.
 */

import { query, dbEnabled } from "./pool.js";
import type { Period } from "./adminStats.js";

export type ApiProvider = "openai_chat" | "openai_search" | "openai_image" | "tavily" | "image_service";

export interface LogApiCall {
  provider: ApiProvider;
  endpoint: string;
  model?: string | null;
  userId?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsdMicros?: number;
  latencyMs: number;
  status: "ok" | "error";
  error?: string | null;
}

/**
 * Persist one call. Never throws — a logging failure must not break generation.
 * Callers can safely fire-and-forget (`void logApiCall(...)`).
 */
export async function logApiCall(entry: LogApiCall): Promise<void> {
  if (!dbEnabled()) return;
  try {
    await query(
      `INSERT INTO api_usage
         (provider, endpoint, model, user_id, prompt_tokens, completion_tokens,
          total_tokens, cost_usd_micros, latency_ms, status, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        entry.provider,
        entry.endpoint,
        entry.model ?? null,
        entry.userId ?? null,
        entry.promptTokens ?? 0,
        entry.completionTokens ?? 0,
        entry.totalTokens ?? 0,
        entry.costUsdMicros ?? 0,
        entry.latencyMs | 0,
        entry.status,
        entry.error ? entry.error.slice(0, 500) : null,
      ]
    );
  } catch (e) {
    console.error("[api_usage] log failed:", (e as Error).message);
  }
}

/** Approximate USD prices per 1M tokens for the models we call. */
const OPENAI_PRICING_PER_1M: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini":          { input: 0.15, output: 0.60 },
  "gpt-4o":               { input: 2.50, output: 10.00 },
  "gpt-4o-search-preview":{ input: 2.50, output: 10.00 },
  "gpt-4-turbo":          { input: 10.00, output: 30.00 },
  "gpt-4":                { input: 30.00, output: 60.00 },
  "gpt-3.5-turbo":        { input: 0.50, output: 1.50 },
  "o1":                   { input: 15.00, output: 60.00 },
  "o1-mini":              { input: 3.00, output: 12.00 },
};

/** Flat per-call USD price for non-chat endpoints. */
const FLAT_PRICING_USD: Record<string, number> = {
  tavily: 0.008,
  openai_image: 0.04,   // gpt-image-1 low-quality baseline; imageGen may pass overrides
  image_service: 0.04,
};

/**
 * Compute USD-micros for a call. Returns 0 if we don't have pricing info for
 * the model (better to under-report than to invent numbers).
 */
export function estimateCostMicros(input: {
  provider: ApiProvider;
  model?: string | null;
  promptTokens?: number;
  completionTokens?: number;
}): number {
  const { provider, model, promptTokens = 0, completionTokens = 0 } = input;
  if (provider === "openai_chat" || provider === "openai_search") {
    if (!model) return 0;
    const p = OPENAI_PRICING_PER_1M[model];
    if (!p) return 0;
    const usd = (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
    return Math.round(usd * 1_000_000);
  }
  const flat = FLAT_PRICING_USD[provider];
  if (!flat) return 0;
  return Math.round(flat * 1_000_000);
}

// ─── aggregators ────────────────────────────────────────────────────────────

export interface ProviderSummary {
  provider: ApiProvider;
  calls: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsdMicros: number;
  avgLatencyMs: number;
}

export interface ModelSummary {
  provider: ApiProvider;
  model: string;
  calls: number;
  errors: number;
  totalTokens: number;
  costUsdMicros: number;
  avgLatencyMs: number;
}

export interface UsageSummary {
  totals: {
    calls: number;
    errors: number;
    totalTokens: number;
    costUsdMicros: number;
    avgLatencyMs: number;
  };
  byProvider: ProviderSummary[];
  byModel: ModelSummary[];
}

const WINDOW_INTERVAL: Record<Period, string> = {
  day: "1 day",
  week: "7 days",
  month: "30 days",
  quarter: "90 days",
  year: "365 days",
};

const TRUNC: Record<Period, string> = {
  day: "day",
  week: "week",
  month: "month",
  quarter: "quarter",
  year: "year",
};

const BUCKET_INTERVAL: Record<Period, string> = {
  day: "30 days",
  week: "12 weeks",
  month: "12 months",
  quarter: "8 quarters",
  year: "5 years",
};

/**
 * Overall totals + per-provider + per-model rollup over the last N period-units.
 * `period="month"` = last 30 days.
 */
export async function usageSummary(period: Period): Promise<UsageSummary> {
  const win = WINDOW_INTERVAL[period];
  const [totals, byProvider, byModel] = await Promise.all([
    query<{
      calls: string;
      errors: string;
      total_tokens: string | null;
      cost: string | null;
      avg_lat: string | null;
    }>(
      `SELECT COUNT(*)::text AS calls,
              COUNT(*) FILTER (WHERE status = 'error')::text AS errors,
              COALESCE(SUM(total_tokens), 0)::text AS total_tokens,
              COALESCE(SUM(cost_usd_micros), 0)::text AS cost,
              COALESCE(AVG(latency_ms), 0)::text AS avg_lat
         FROM api_usage
        WHERE created_at >= now() - INTERVAL '${win}'`
    ),
    query<{
      provider: string;
      calls: string;
      errors: string;
      prompt_tokens: string | null;
      completion_tokens: string | null;
      total_tokens: string | null;
      cost: string | null;
      avg_lat: string | null;
    }>(
      `SELECT provider,
              COUNT(*)::text AS calls,
              COUNT(*) FILTER (WHERE status = 'error')::text AS errors,
              COALESCE(SUM(prompt_tokens), 0)::text AS prompt_tokens,
              COALESCE(SUM(completion_tokens), 0)::text AS completion_tokens,
              COALESCE(SUM(total_tokens), 0)::text AS total_tokens,
              COALESCE(SUM(cost_usd_micros), 0)::text AS cost,
              COALESCE(AVG(latency_ms), 0)::text AS avg_lat
         FROM api_usage
        WHERE created_at >= now() - INTERVAL '${win}'
        GROUP BY provider
        ORDER BY calls DESC`
    ),
    query<{
      provider: string;
      model: string | null;
      calls: string;
      errors: string;
      total_tokens: string | null;
      cost: string | null;
      avg_lat: string | null;
    }>(
      `SELECT provider, model,
              COUNT(*)::text AS calls,
              COUNT(*) FILTER (WHERE status = 'error')::text AS errors,
              COALESCE(SUM(total_tokens), 0)::text AS total_tokens,
              COALESCE(SUM(cost_usd_micros), 0)::text AS cost,
              COALESCE(AVG(latency_ms), 0)::text AS avg_lat
         FROM api_usage
        WHERE created_at >= now() - INTERVAL '${win}'
          AND model IS NOT NULL
        GROUP BY provider, model
        ORDER BY calls DESC
        LIMIT 40`
    ),
  ]);

  const t = totals.rows[0];
  return {
    totals: {
      calls: Number(t?.calls ?? 0),
      errors: Number(t?.errors ?? 0),
      totalTokens: Number(t?.total_tokens ?? 0),
      costUsdMicros: Number(t?.cost ?? 0),
      avgLatencyMs: Math.round(Number(t?.avg_lat ?? 0)),
    },
    byProvider: byProvider.rows.map((r) => ({
      provider: r.provider as ApiProvider,
      calls: Number(r.calls),
      errors: Number(r.errors),
      promptTokens: Number(r.prompt_tokens ?? 0),
      completionTokens: Number(r.completion_tokens ?? 0),
      totalTokens: Number(r.total_tokens ?? 0),
      costUsdMicros: Number(r.cost ?? 0),
      avgLatencyMs: Math.round(Number(r.avg_lat ?? 0)),
    })),
    byModel: byModel.rows.map((r) => ({
      provider: r.provider as ApiProvider,
      model: r.model ?? "(unknown)",
      calls: Number(r.calls),
      errors: Number(r.errors),
      totalTokens: Number(r.total_tokens ?? 0),
      costUsdMicros: Number(r.cost ?? 0),
      avgLatencyMs: Math.round(Number(r.avg_lat ?? 0)),
    })),
  };
}

export interface UsageTimePoint {
  bucket: string;
  provider: ApiProvider | "all";
  calls: number;
  totalTokens: number;
  costUsdMicros: number;
}

/**
 * Calls / tokens / cost bucketed by the requested period, per provider. Fills
 * zero buckets so the chart is continuous. Oldest first.
 */
export async function usageTimeseries(period: Period): Promise<UsageTimePoint[]> {
  const trunc = TRUNC[period];
  const interval = BUCKET_INTERVAL[period];
  const { rows } = await query<{
    bucket: Date;
    provider: string;
    calls: string;
    total_tokens: string;
    cost: string;
  }>(
    `WITH series AS (
       SELECT generate_series(
         date_trunc($1, now() - INTERVAL '${interval}'),
         date_trunc($1, now()),
         ('1 ' || $1)::interval
       ) AS bucket
     ),
     providers AS (
       SELECT DISTINCT provider FROM api_usage
        WHERE created_at >= now() - INTERVAL '${interval}'
     ),
     grid AS (
       SELECT s.bucket, p.provider FROM series s CROSS JOIN providers p
     ),
     agg AS (
       SELECT date_trunc($1, created_at) AS bucket,
              provider,
              COUNT(*)::text AS calls,
              COALESCE(SUM(total_tokens), 0)::text AS total_tokens,
              COALESCE(SUM(cost_usd_micros), 0)::text AS cost
         FROM api_usage
        WHERE created_at >= now() - INTERVAL '${interval}'
        GROUP BY 1, 2
     )
     SELECT g.bucket, g.provider,
            COALESCE(a.calls, '0') AS calls,
            COALESCE(a.total_tokens, '0') AS total_tokens,
            COALESCE(a.cost, '0') AS cost
       FROM grid g
       LEFT JOIN agg a ON a.bucket = g.bucket AND a.provider = g.provider
      ORDER BY g.bucket ASC, g.provider ASC`,
    [trunc]
  );
  return rows.map((r) => ({
    bucket: r.bucket.toISOString(),
    provider: r.provider as ApiProvider,
    calls: Number(r.calls),
    totalTokens: Number(r.total_tokens),
    costUsdMicros: Number(r.cost),
  }));
}

export interface TopUserRow {
  userId: string;
  email: string | null;
  name: string | null;
  calls: number;
  totalTokens: number;
  costUsdMicros: number;
}

/**
 * Top-N users by cost over the last `period` window. NULL user_id rows
 * (untracked / unauthenticated generation) are excluded.
 */
export async function topUsers(period: Period, limit = 10): Promise<TopUserRow[]> {
  const win = WINDOW_INTERVAL[period];
  const { rows } = await query<{
    user_id: string;
    email: string | null;
    name: string | null;
    calls: string;
    total_tokens: string;
    cost: string;
  }>(
    `SELECT u.id AS user_id, u.email, u.name,
            COUNT(*)::text AS calls,
            COALESCE(SUM(a.total_tokens), 0)::text AS total_tokens,
            COALESCE(SUM(a.cost_usd_micros), 0)::text AS cost
       FROM api_usage a
       JOIN users u ON u.id = a.user_id
      WHERE a.created_at >= now() - INTERVAL '${win}'
      GROUP BY u.id, u.email, u.name
      ORDER BY cost DESC
      LIMIT $1`,
    [Math.min(100, Math.max(1, limit))]
  );
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    name: r.name,
    calls: Number(r.calls),
    totalTokens: Number(r.total_tokens),
    costUsdMicros: Number(r.cost),
  }));
}
