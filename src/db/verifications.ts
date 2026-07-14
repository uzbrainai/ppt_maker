/**
 * Pending email-verification codes. A short numeric code is hashed (scrypt, via
 * services/passwords.ts) and stored with an expiry and an attempt counter, so a
 * leaked database never exposes the code and guessing is bounded by both TTL and
 * a max-attempts cap. One row per user; re-registering or resending overwrites it.
 */

import { query } from "./pool.js";

/** Minutes a verification code stays valid after it is issued. */
export const CODE_TTL_MINUTES = Number(process.env.EMAIL_CODE_TTL_MINUTES ?? 15);
/** Wrong-code submissions allowed before the code is invalidated. */
export const MAX_VERIFY_ATTEMPTS = Number(process.env.EMAIL_MAX_ATTEMPTS ?? 5);

export interface VerificationRow {
  userId: string;
  codeHash: string;
  attempts: number;
  /** true once the code's expiry has passed. */
  expired: boolean;
}

/** Store (or replace) the pending code for a user, resetting attempts and expiry. */
export async function upsertVerificationCode(userId: string, codeHash: string): Promise<void> {
  await query(
    `INSERT INTO email_verifications (user_id, code_hash, attempts, expires_at, created_at)
       VALUES ($1, $2, 0, now() + ($3 || ' minutes')::interval, now())
     ON CONFLICT (user_id) DO UPDATE SET
       code_hash  = EXCLUDED.code_hash,
       attempts   = 0,
       expires_at = EXCLUDED.expires_at,
       created_at = now()`,
    [userId, codeHash, String(CODE_TTL_MINUTES)]
  );
}

/** Fetch the pending code for a user, or null if none exists. */
export async function getVerification(userId: string): Promise<VerificationRow | null> {
  const { rows } = await query<{ code_hash: string; attempts: number; expired: boolean }>(
    `SELECT code_hash, attempts, (expires_at < now()) AS expired
       FROM email_verifications WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { userId, codeHash: r.code_hash, attempts: r.attempts, expired: r.expired };
}

/** Record a failed attempt; returns the new attempt count. */
export async function bumpAttempts(userId: string): Promise<number> {
  const { rows } = await query<{ attempts: number }>(
    `UPDATE email_verifications SET attempts = attempts + 1 WHERE user_id = $1 RETURNING attempts`,
    [userId]
  );
  return rows[0]?.attempts ?? 0;
}

/** Remove a user's pending code (after success or when it is exhausted). */
export async function clearVerification(userId: string): Promise<void> {
  await query(`DELETE FROM email_verifications WHERE user_id = $1`, [userId]);
}
