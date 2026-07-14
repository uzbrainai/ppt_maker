/**
 * Admin dashboard aggregates + payment timeseries by period.
 */

import { query } from "./pool.js";

export type Period = "day" | "week" | "month" | "quarter" | "year";

const TRUNC: Record<Period, string> = {
  day: "day",
  week: "week",
  month: "month",
  quarter: "quarter",
  year: "year",
};

const RANGE_INTERVAL: Record<Period, string> = {
  day: "30 days",
  week: "12 weeks",
  month: "12 months",
  quarter: "8 quarters",
  year: "5 years",
};

export interface DashboardStats {
  users: {
    total: number;
    blocked: number;
    unlimited: number;
    admins: number;
    newLast30d: number;
  };
  payments: {
    paidCount: number;
    paidTotalUzs: number;
    createdCount: number;
    last30dUzs: number;
  };
  credits: {
    granted: number;
    spent: number;
  };
  materials: {
    total: number;
  };
  support: {
    total: number;
    unanswered: number;
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [u, p, ledger, m, s] = await Promise.all([
    query<{
      total: string;
      blocked: string;
      unlimited: string;
      admins: string;
      newlast: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE blocked)::text AS blocked,
         COUNT(*) FILTER (WHERE unlimited)::text AS unlimited,
         COUNT(*) FILTER (WHERE role = 'admin')::text AS admins,
         COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '30 days')::text AS newlast
       FROM users`
    ),
    query<{
      paid_count: string;
      paid_total: string | null;
      created_count: string;
      last30d: string | null;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'paid')::text AS paid_count,
         COALESCE(SUM(amount_uzs) FILTER (WHERE status = 'paid'), 0)::text AS paid_total,
         COUNT(*)::text AS created_count,
         COALESCE(SUM(amount_uzs) FILTER (WHERE status = 'paid' AND updated_at >= now() - INTERVAL '30 days'), 0)::text AS last30d
       FROM payments`
    ),
    query<{ granted: string | null; spent: string | null }>(
      `SELECT
         COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0)::text AS granted,
         COALESCE(SUM(-delta) FILTER (WHERE delta < 0), 0)::text AS spent
       FROM credit_ledger`
    ),
    query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM materials`),
    query<{ total: string; unanswered: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE reply IS NULL)::text AS unanswered
         FROM support_messages`
    ),
  ]);

  return {
    users: {
      total: Number(u.rows[0]?.total ?? 0),
      blocked: Number(u.rows[0]?.blocked ?? 0),
      unlimited: Number(u.rows[0]?.unlimited ?? 0),
      admins: Number(u.rows[0]?.admins ?? 0),
      newLast30d: Number(u.rows[0]?.newlast ?? 0),
    },
    payments: {
      paidCount: Number(p.rows[0]?.paid_count ?? 0),
      paidTotalUzs: Number(p.rows[0]?.paid_total ?? 0),
      createdCount: Number(p.rows[0]?.created_count ?? 0),
      last30dUzs: Number(p.rows[0]?.last30d ?? 0),
    },
    credits: {
      granted: Number(ledger.rows[0]?.granted ?? 0),
      spent: Number(ledger.rows[0]?.spent ?? 0),
    },
    materials: { total: Number(m.rows[0]?.total ?? 0) },
    support: {
      total: Number(s.rows[0]?.total ?? 0),
      unanswered: Number(s.rows[0]?.unanswered ?? 0),
    },
  };
}

export interface TimePoint {
  bucket: string;
  count: number;
  totalUzs: number;
}

/**
 * Paid-payments totals bucketed by the requested period (day/week/month/quarter/year).
 * Returns the last N buckets, oldest first, filling zero buckets when there's no data.
 */
export async function paymentsTimeseries(period: Period): Promise<TimePoint[]> {
  const trunc = TRUNC[period];
  const interval = RANGE_INTERVAL[period];
  const { rows } = await query<{
    bucket: Date;
    count: string;
    total: string;
  }>(
    `WITH series AS (
       SELECT generate_series(
         date_trunc($1, now() - INTERVAL '${interval}'),
         date_trunc($1, now()),
         ('1 ' || $1)::interval
       ) AS bucket
     ),
     agg AS (
       SELECT date_trunc($1, updated_at) AS bucket,
              COUNT(*)::text AS count,
              COALESCE(SUM(amount_uzs), 0)::text AS total
         FROM payments
        WHERE status = 'paid'
          AND updated_at >= now() - INTERVAL '${interval}'
        GROUP BY 1
     )
     SELECT s.bucket, COALESCE(a.count, '0') AS count, COALESCE(a.total, '0') AS total
       FROM series s
       LEFT JOIN agg a ON a.bucket = s.bucket
      ORDER BY s.bucket ASC`,
    [trunc]
  );
  return rows.map((r) => ({
    bucket: r.bucket.toISOString(),
    count: Number(r.count),
    totalUzs: Number(r.total),
  }));
}

/** All payments joined with user info, most recent first. */
export interface AdminPaymentRow {
  id: number;
  merchantTransId: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  pack: string;
  amountUzs: number;
  credits: number;
  plan: string;
  status: string;
  clickTransId: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listPayments(input: {
  status?: string;
  limit?: number;
}): Promise<AdminPaymentRow[]> {
  const limit = Math.min(1000, Math.max(1, input.limit ?? 200));
  const params: unknown[] = [limit];
  let where = "";
  if (input.status) {
    params.push(input.status);
    where = `WHERE p.status = $2`;
  }
  const { rows } = await query<{
    id: number;
    merchant_trans_id: string;
    user_id: string;
    user_email: string | null;
    user_name: string | null;
    pack: string;
    amount_uzs: string;
    credits: number;
    plan: string;
    status: string;
    click_trans_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT p.id, p.merchant_trans_id, p.user_id, u.email AS user_email, u.name AS user_name,
            p.pack, p.amount_uzs, p.credits, p.plan, p.status, p.click_trans_id,
            p.created_at, p.updated_at
       FROM payments p LEFT JOIN users u ON u.id = p.user_id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $1`,
    params
  );
  return rows.map((r) => ({
    id: Number(r.id),
    merchantTransId: r.merchant_trans_id,
    userId: r.user_id,
    userEmail: r.user_email,
    userName: r.user_name,
    pack: r.pack,
    amountUzs: Number(r.amount_uzs),
    credits: r.credits,
    plan: r.plan,
    status: r.status,
    clickTransId: r.click_trans_id,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }));
}
