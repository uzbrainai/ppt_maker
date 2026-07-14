/**
 * User records. The slidewind service can own identity directly (email +
 * scrypt password hash, see services/passwords.ts) or mirror an external auth
 * backend's JWT `sub`. Either way we own the credit account and the role that
 * gates admin routes.
 */

import { randomUUID } from "crypto";
import { withTransaction, query } from "./pool.js";
import { currentPeriod, DEFAULT_MONTHLY_ALLOWANCE } from "./credits.js";

export interface UserIdentity {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
}

export interface UserRecord {
  id: string;
  email: string | null;
  name: string | null;
  plan: string;
  role: string;
  emailVerified: boolean;
  blocked?: boolean;
  unlimited?: boolean;
}

/** A user plus credit balance, for the admin panel. */
export interface AdminUserRow extends UserRecord {
  balance: number;
  createdAt: string;
  blocked: boolean;
  unlimited: boolean;
}

/**
 * Upsert the user and ensure they have a credit account. On first sight the
 * account is seeded with the freemium monthly allowance for the current period.
 * Email/name are refreshed from the token when present. Returns the user record.
 */
export async function ensureUser(identity: UserIdentity): Promise<UserRecord> {
  const { id } = identity;
  if (!id) throw new Error("ensureUser: missing user id");
  return withTransaction(async (client) => {
    // Externally-issued identities (JWT sub) are already verified by their issuer.
    const { rows } = await client.query<UserRecord>(
      `INSERT INTO users (id, email, name, email_verified)
         VALUES ($1, $2, $3, true)
       ON CONFLICT (id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, users.email),
         name  = COALESCE(EXCLUDED.name,  users.name),
         updated_at = now()
       RETURNING id, email, name, plan, role, email_verified AS "emailVerified", blocked, unlimited`,
      [id, identity.email ?? null, identity.name ?? null]
    );
    await client.query(
      `INSERT INTO credit_accounts (user_id, balance, monthly_allowance, period)
         VALUES ($1, $2, $2, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [id, DEFAULT_MONTHLY_ALLOWANCE, currentPeriod()]
    );
    return rows[0];
  });
}

/**
 * Create a password-backed (or OAuth) account and seed its credit allowance.
 * Throws if the email is already registered (unique index). Returns the new user.
 * `passwordHash` may be null for Google-only accounts.
 */
export async function createUser(input: {
  email: string;
  name: string | null;
  passwordHash: string | null;
  role?: string;
  /** Password accounts default to unverified; OAuth / seed admin are verified. */
  emailVerified?: boolean;
}): Promise<UserRecord> {
  const id = randomUUID();
  return withTransaction(async (client) => {
    const { rows } = await client.query<UserRecord>(
      `INSERT INTO users (id, email, name, password_hash, role, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, name, plan, role, email_verified AS "emailVerified"`,
      [id, input.email, input.name, input.passwordHash, input.role ?? "user", input.emailVerified ?? false]
    );
    await client.query(
      `INSERT INTO credit_accounts (user_id, balance, monthly_allowance, period)
         VALUES ($1, $2, $2, $3)
       ON CONFLICT (user_id) DO NOTHING`,
      [id, DEFAULT_MONTHLY_ALLOWANCE, currentPeriod()]
    );
    return rows[0];
  });
}

/** Create or link a Google-authenticated account (email already verified by Google). */
export async function upsertGoogleUser(input: {
  email: string;
  name: string | null;
}): Promise<UserRecord> {
  const email = input.email.trim().toLowerCase();
  const existing = await getUserByEmail(email);
  if (existing) {
    if (!existing.emailVerified) await setEmailVerified(existing.id);
    if (input.name && input.name !== existing.name) {
      await query(`UPDATE users SET name = $2, updated_at = now() WHERE id = $1`, [existing.id, input.name]);
    }
    return {
      id: existing.id,
      email: existing.email,
      name: input.name ?? existing.name,
      plan: existing.plan,
      role: existing.role,
      emailVerified: true,
    };
  }
  return createUser({
    email,
    name: input.name,
    passwordHash: null,
    emailVerified: true,
  });
}

/** Look up a user by email (case-insensitive), including the password hash for login. */
export async function getUserByEmail(
  email: string
): Promise<(UserRecord & { passwordHash: string | null }) | null> {
  const { rows } = await query<
    UserRecord & { password_hash: string | null; email_verified: boolean }
  >(
    `SELECT id, email, name, plan, role, email_verified, password_hash
       FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    plan: r.plan,
    role: r.role,
    emailVerified: r.email_verified,
    passwordHash: r.password_hash,
  };
}

/** Set a user's role (e.g. promote to admin). */
export async function setRole(userId: string, role: string): Promise<void> {
  await query(`UPDATE users SET role = $2, updated_at = now() WHERE id = $1`, [userId, role]);
}

/** Mark a user's email as verified (called after a correct code is submitted). */
export async function setEmailVerified(userId: string): Promise<void> {
  await query(`UPDATE users SET email_verified = true, updated_at = now() WHERE id = $1`, [userId]);
}

/** All users with their current credit balance, newest first — for the admin panel. */
export async function listUsers(limit = 500, q?: string): Promise<AdminUserRow[]> {
  const like = q ? `%${q.replace(/[%_]/g, "").toLowerCase()}%` : null;
  const { rows } = await query<{
    id: string;
    email: string | null;
    name: string | null;
    plan: string;
    role: string;
    email_verified: boolean;
    blocked: boolean;
    unlimited: boolean;
    balance: number | null;
    created_at: Date;
  }>(
    `SELECT u.id, u.email, u.name, u.plan, u.role, u.email_verified, u.blocked, u.unlimited, c.balance, u.created_at
       FROM users u LEFT JOIN credit_accounts c ON c.user_id = u.id
       ${like ? `WHERE lower(u.email) LIKE $2 OR lower(u.name) LIKE $2` : ""}
      ORDER BY u.created_at DESC LIMIT $1`,
    like ? [limit, like] : [limit]
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    plan: r.plan,
    role: r.role,
    emailVerified: r.email_verified,
    blocked: !!r.blocked,
    unlimited: !!r.unlimited,
    balance: r.balance ?? 0,
    createdAt: r.created_at.toISOString(),
  }));
}

/** Update the user's subscription plan label (e.g. after Click payment). */
export async function setUserPlan(userId: string, plan: string): Promise<void> {
  await query(`UPDATE users SET plan = $2, updated_at = now() WHERE id = $1`, [userId, plan]);
}

/** Block or unblock a user (prevents generation). */
export async function setUserBlocked(userId: string, blocked: boolean): Promise<void> {
  await query(`UPDATE users SET blocked = $2, updated_at = now() WHERE id = $1`, [userId, blocked]);
}

/** Grant or revoke unlimited access for a user (skips credit metering). */
export async function setUserUnlimited(userId: string, unlimited: boolean): Promise<void> {
  await query(`UPDATE users SET unlimited = $2, updated_at = now() WHERE id = $1`, [userId, unlimited]);
}

/** Get a single user by id (for admin editing). */
export async function getUserById(userId: string): Promise<AdminUserRow | null> {
  const { rows } = await query<{
    id: string;
    email: string | null;
    name: string | null;
    plan: string;
    role: string;
    email_verified: boolean;
    blocked: boolean;
    unlimited: boolean;
    balance: number | null;
    created_at: Date;
  }>(
    `SELECT u.id, u.email, u.name, u.plan, u.role, u.email_verified, u.blocked, u.unlimited, c.balance, u.created_at
       FROM users u LEFT JOIN credit_accounts c ON c.user_id = u.id
      WHERE u.id = $1 LIMIT 1`,
    [userId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    plan: r.plan,
    role: r.role,
    emailVerified: r.email_verified,
    blocked: !!r.blocked,
    unlimited: !!r.unlimited,
    balance: r.balance ?? 0,
    createdAt: r.created_at.toISOString(),
  };
}
