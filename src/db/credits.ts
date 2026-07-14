/**
 * Credit accounting. 1 credit = 1 generated slide/page. Freemium accounts get a
 * monthly allowance (default 20) that refills at the start of each calendar
 * month. All mutations are recorded in credit_ledger.
 *
 * The pure helpers (currentPeriod / refilledBalance) carry the policy and are
 * unit-tested without a database.
 */

import { withTransaction, query } from "./pool.js";
import type pg from "pg";

export const DEFAULT_MONTHLY_ALLOWANCE = Number(process.env.FREE_MONTHLY_CREDITS ?? 20);

export interface CreditAccount {
  balance: number;
  monthlyAllowance: number;
  period: string;
}

export interface LedgerEntry {
  delta: number;
  reason: string;
  deckId: string | null;
  balanceAfter: number;
  createdAt: string;
}

/** Thrown when a charge exceeds the available balance. */
export class InsufficientCreditsError extends Error {
  readonly balance: number;
  readonly needed: number;
  constructor(balance: number, needed: number) {
    super(`insufficient credits: have ${balance}, need ${needed}`);
    this.name = "InsufficientCreditsError";
    this.balance = balance;
    this.needed = needed;
  }
}

// ── pure policy helpers (no DB) ─────────────────────────────────────────────

/** The billing period a date falls in, as "YYYY-MM". Defaults to now. */
export function currentPeriod(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Given a stored account and the current period, return the effective balance
 * and period: if the stored period is older, the balance refills to the monthly
 * allowance; otherwise it is unchanged.
 */
export function refilledBalance(
  account: { balance: number; monthlyAllowance: number; period: string },
  period: string = currentPeriod()
): { balance: number; period: string; refilled: boolean } {
  if (account.period !== period) {
    return { balance: account.monthlyAllowance, period, refilled: true };
  }
  return { balance: account.balance, period, refilled: false };
}

// ── DB-backed operations ────────────────────────────────────────────────────

type AccountRow = { balance: number; monthly_allowance: number; period: string };

/**
 * Read the account, applying a monthly refill if due (and persisting it +
 * ledger entry). Assumes the user row already exists (see ensureUser).
 */
export async function getAccount(userId: string): Promise<CreditAccount> {
  return withTransaction(async (client) => readAndRefill(client, userId));
}

/** Internal: lock the account row, refill if the period rolled over, return it. */
async function readAndRefill(client: pg.PoolClient, userId: string): Promise<CreditAccount> {
  const { rows } = await client.query<AccountRow>(
    `SELECT balance, monthly_allowance, period FROM credit_accounts WHERE user_id = $1 FOR UPDATE`,
    [userId]
  );
  if (rows.length === 0) {
    throw new Error(`no credit account for user ${userId} (call ensureUser first)`);
  }
  const row = rows[0];
  const account = { balance: row.balance, monthlyAllowance: row.monthly_allowance, period: row.period };
  const next = refilledBalance(account);
  if (next.refilled) {
    await client.query(
      `UPDATE credit_accounts SET balance = $2, period = $3, updated_at = now() WHERE user_id = $1`,
      [userId, next.balance, next.period]
    );
    await client.query(
      `INSERT INTO credit_ledger (user_id, delta, reason, balance_after) VALUES ($1, $2, 'monthly_refill', $3)`,
      [userId, next.balance - account.balance, next.balance]
    );
  }
  return { balance: next.balance, monthlyAllowance: account.monthlyAllowance, period: next.period };
}

/**
 * Deduct `amount` credits atomically (refilling first if due). Throws
 * InsufficientCreditsError if the balance can't cover it. Returns the new balance.
 */
export async function charge(
  userId: string,
  amount: number,
  reason: string,
  deckId?: string
): Promise<number> {
  if (amount <= 0) {
    const acc = await getAccount(userId);
    return acc.balance;
  }
  return withTransaction(async (client) => {
    const account = await readAndRefill(client, userId);
    if (account.balance < amount) {
      throw new InsufficientCreditsError(account.balance, amount);
    }
    const newBalance = account.balance - amount;
    await client.query(
      `UPDATE credit_accounts SET balance = $2, updated_at = now() WHERE user_id = $1`,
      [userId, newBalance]
    );
    await client.query(
      `INSERT INTO credit_ledger (user_id, delta, reason, deck_id, balance_after) VALUES ($1, $2, $3, $4, $5)`,
      [userId, -amount, reason, deckId ?? null, newBalance]
    );
    return newBalance;
  });
}

/** Add `amount` credits (admin top-up / purchase). Returns the new balance. */
export async function grant(
  userId: string,
  amount: number,
  reason: string,
  deckId?: string
): Promise<number> {
  if (amount <= 0) throw new Error("grant amount must be positive");
  return withTransaction(async (client) => {
    const account = await readAndRefill(client, userId);
    const newBalance = account.balance + amount;
    await client.query(
      `UPDATE credit_accounts SET balance = $2, updated_at = now() WHERE user_id = $1`,
      [userId, newBalance]
    );
    await client.query(
      `INSERT INTO credit_ledger (user_id, delta, reason, deck_id, balance_after) VALUES ($1, $2, $3, $4, $5)`,
      [userId, amount, reason, deckId ?? null, newBalance]
    );
    return newBalance;
  });
}

/** Raise the monthly allowance (subscription packs). Does not change current balance. */
export async function setMonthlyAllowance(userId: string, allowance: number): Promise<void> {
  if (allowance < 0) throw new Error("allowance must be >= 0");
  await query(
    `UPDATE credit_accounts SET monthly_allowance = $2, updated_at = now() WHERE user_id = $1`,
    [userId, allowance]
  );
}

/** Most recent ledger entries for a user (newest first). */
export async function ledger(userId: string, limit = 50): Promise<LedgerEntry[]> {
  const { rows } = await query<{
    delta: number;
    reason: string;
    deck_id: string | null;
    balance_after: number;
    created_at: Date;
  }>(
    `SELECT delta, reason, deck_id, balance_after, created_at
       FROM credit_ledger WHERE user_id = $1
      ORDER BY created_at DESC, id DESC LIMIT $2`,
    [userId, limit]
  );
  return rows.map((r) => ({
    delta: r.delta,
    reason: r.reason,
    deckId: r.deck_id,
    balanceAfter: r.balance_after,
    createdAt: r.created_at.toISOString(),
  }));
}
