/**
 * Payment orders for Click.uz (and future providers).
 */

import { query } from "./pool.js";

export type PaymentStatus = "created" | "prepared" | "paid" | "failed" | "cancelled";

export interface PaymentRow {
  id: number;
  merchantTransId: string;
  userId: string;
  pack: string;
  amountUzs: number;
  credits: number;
  plan: string;
  monthlyAllowance: number;
  status: PaymentStatus;
  clickTransId: string | null;
  clickPaydocId: string | null;
  errorCode: number | null;
  createdAt: string;
  updatedAt: string;
}

type Row = {
  id: number;
  merchant_trans_id: string;
  user_id: string;
  pack: string;
  amount_uzs: string;
  credits: number;
  plan: string;
  monthly_allowance: number;
  status: PaymentStatus;
  click_trans_id: string | null;
  click_paydoc_id: string | null;
  error_code: number | null;
  created_at: Date;
  updated_at: Date;
};

function toPayment(r: Row): PaymentRow {
  return {
    id: Number(r.id),
    merchantTransId: r.merchant_trans_id,
    userId: r.user_id,
    pack: r.pack,
    amountUzs: Number(r.amount_uzs),
    credits: r.credits,
    plan: r.plan,
    monthlyAllowance: r.monthly_allowance,
    status: r.status,
    clickTransId: r.click_trans_id,
    clickPaydocId: r.click_paydoc_id,
    errorCode: r.error_code,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function createPayment(input: {
  merchantTransId: string;
  userId: string;
  pack: string;
  amountUzs: number;
  credits: number;
  plan: string;
  monthlyAllowance: number;
}): Promise<PaymentRow> {
  const { rows } = await query<Row>(
    `INSERT INTO payments (
       merchant_trans_id, user_id, pack, amount_uzs, credits, plan, monthly_allowance, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,'created')
     RETURNING *`,
    [
      input.merchantTransId,
      input.userId,
      input.pack,
      input.amountUzs,
      input.credits,
      input.plan,
      input.monthlyAllowance,
    ]
  );
  return toPayment(rows[0]!);
}

export async function getPaymentByMerchantTransId(id: string): Promise<PaymentRow | null> {
  const { rows } = await query<Row>(`SELECT * FROM payments WHERE merchant_trans_id = $1`, [id]);
  return rows[0] ? toPayment(rows[0]) : null;
}

export async function getPaymentById(id: number): Promise<PaymentRow | null> {
  const { rows } = await query<Row>(`SELECT * FROM payments WHERE id = $1`, [id]);
  return rows[0] ? toPayment(rows[0]) : null;
}

export async function markPaymentPrepared(
  merchantTransId: string,
  clickTransId: string,
  clickPaydocId?: string
): Promise<PaymentRow | null> {
  const { rows } = await query<Row>(
    `UPDATE payments SET
       status = CASE WHEN status = 'paid' THEN status ELSE 'prepared' END,
       click_trans_id = $2,
       click_paydoc_id = COALESCE($3, click_paydoc_id),
       updated_at = now()
     WHERE merchant_trans_id = $1
     RETURNING *`,
    [merchantTransId, clickTransId, clickPaydocId ?? null]
  );
  return rows[0] ? toPayment(rows[0]) : null;
}

/** Mark paid only if not already paid. Returns null when already paid or missing. */
export async function markPaymentPaid(
  merchantTransId: string,
  clickTransId: string,
  clickPaydocId?: string
): Promise<PaymentRow | null> {
  const { rows } = await query<Row>(
    `UPDATE payments SET
       status = 'paid',
       click_trans_id = $2,
       click_paydoc_id = COALESCE($3, click_paydoc_id),
       error_code = 0,
       updated_at = now()
     WHERE merchant_trans_id = $1 AND status <> 'paid'
     RETURNING *`,
    [merchantTransId, clickTransId, clickPaydocId ?? null]
  );
  return rows[0] ? toPayment(rows[0]) : null;
}

export async function markPaymentFailed(
  merchantTransId: string,
  errorCode: number
): Promise<void> {
  await query(
    `UPDATE payments SET status = 'failed', error_code = $2, updated_at = now()
     WHERE merchant_trans_id = $1 AND status <> 'paid'`,
    [merchantTransId, errorCode]
  );
}

/** Undo a paid mark so Click can retry complete after a fulfillment error. */
export async function revertPaymentToPrepared(merchantTransId: string): Promise<void> {
  await query(
    `UPDATE payments SET status = 'prepared', error_code = NULL, updated_at = now()
     WHERE merchant_trans_id = $1 AND status = 'paid'`,
    [merchantTransId]
  );
}
