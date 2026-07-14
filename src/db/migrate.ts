/**
 * Idempotent schema migration. Run once on server boot. Everything uses
 * `IF NOT EXISTS`, so re-running is safe and additive. This is the single source
 * of truth for the persistence schema.
 */

import { query, dbEnabled } from "./pool.js";

const SCHEMA = `
-- Users. The id is a stable identifier (a generated uuid for accounts created
-- here, or the auth backend's JWT sub claim when an external issuer is used).
-- The slidewind service can act as the auth backend itself: password_hash holds
-- a scrypt hash (see services/passwords.ts) and role gates admin-only routes.
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT,
  name          TEXT,
  plan          TEXT NOT NULL DEFAULT 'free',
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Additive columns for databases created before auth was owned here.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
-- Password accounts must confirm ownership of their email (6-digit code) before
-- a login token is issued. Externally-issued identities (JWT sub) are already
-- verified by their issuer, so createUser/ensureUser mark those true directly.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
-- Admin toggles: block a user from generating, or grant unlimited product access.
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unlimited BOOLEAN NOT NULL DEFAULT false;
-- Email is the login key, so it must be unique (case-insensitive) when present.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users (lower(email)) WHERE email IS NOT NULL;

-- Plans (subscription tiers + one-time token packs) shown on the pricing page
-- and configurable from the admin panel. kind=subscription changes the user's
-- monthly allowance; kind=token is a one-off credit top-up.
CREATE TABLE IF NOT EXISTS plans (
  id                BIGSERIAL PRIMARY KEY,
  slug              TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'subscription',
  price_uzs         NUMERIC(14,2) NOT NULL DEFAULT 0,
  credits           INTEGER NOT NULL DEFAULT 0,
  monthly_allowance INTEGER,
  blurb             TEXT,
  features          JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_popular        BOOLEAN NOT NULL DEFAULT false,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plans_active_idx ON plans (is_active, kind, sort_order);
-- Additive column for annual billing discount (percentage, 0-100).
ALTER TABLE plans ADD COLUMN IF NOT EXISTS yearly_discount_pct INTEGER NOT NULL DEFAULT 0;

-- Seed the default catalog once. All rows use ON CONFLICT DO NOTHING so admins
-- can edit them freely without seed overwrites.
INSERT INTO plans (slug, name, kind, price_uzs, credits, monthly_allowance, blurb, features, is_popular, sort_order) VALUES
  ('starter', 'Starter', 'subscription', 0,        20,   20,   'For quick personal projects',      '["20 credits / month","Core templates","Editable PPTX export"]', false, 10),
  ('pro',     'Pro',     'subscription', 229000,   300,  300,  'For founders, students, creators', '["300 credits / month","All premium templates","Document + URL ingestion","Brand kit"]', true, 20),
  ('team',    'Team',    'subscription', 590000,   1000, 1000, 'For teams and faculties at scale', '["1000 credits / month","Everything in Pro","Shared workspaces","SSO + admin controls"]', false, 30),
  ('tokens-50',  'Small pack',  'token', 49000,  50,  NULL, 'One-off top-up',      '["50 credits","Never expire"]',  false, 40),
  ('tokens-200', 'Medium pack', 'token', 179000, 200, NULL, 'Best-value top-up',   '["200 credits","Never expire","Priority queue"]', true,  50),
  ('tokens-500', 'Large pack',  'token', 399000, 500, NULL, 'For power users',     '["500 credits","Never expire","Priority queue","Premium images"]', false, 60)
ON CONFLICT (slug) DO NOTHING;

-- Support messages (contact / help chat). Reply is written by an admin.
CREATE TABLE IF NOT EXISTS support_messages (
  id          BIGSERIAL PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT,
  email       TEXT,
  body        TEXT NOT NULL,
  reply       TEXT,
  replied_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  replied_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_created_idx ON support_messages (created_at DESC);

-- Pending email-verification codes (one per user; re-registering/resending
-- overwrites it). The code is stored as a scrypt hash, never in plaintext.
CREATE TABLE IF NOT EXISTS email_verifications (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One credit account per user. period is the YYYY-MM the current balance
-- belongs to; a request in a later period refills balance to monthly_allowance
-- (the freemium grant, default 20 = 20 pages/month).
CREATE TABLE IF NOT EXISTS credit_accounts (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance           INTEGER NOT NULL DEFAULT 20,
  monthly_allowance INTEGER NOT NULL DEFAULT 20,
  period            TEXT NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only audit of every balance change (refill / generate / grant / purchase).
CREATE TABLE IF NOT EXISTS credit_ledger (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta         INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  deck_id       TEXT,
  balance_after INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON credit_ledger (user_id, created_at DESC);

-- A user's generated materials (decks). scene holds the full PPTScene JSON so
-- the canvas editor and rebuilds survive restarts; cover_svg is the first-slide
-- thumbnail shown on the dashboard.
CREATE TABLE IF NOT EXISTS materials (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'ppt',
  title       TEXT NOT NULL,
  pages       INTEGER NOT NULL DEFAULT 0,
  theme       TEXT,
  lang        TEXT,
  premium     BOOLEAN NOT NULL DEFAULT false,
  cover_svg   TEXT,
  yaml        TEXT,
  scene       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS materials_user_idx ON materials (user_id, updated_at DESC);

-- Click / payment orders. merchant_trans_id is sent to Click as transaction_param;
-- id is returned as merchant_prepare_id during Prepare.
CREATE TABLE IF NOT EXISTS payments (
  id                 BIGSERIAL PRIMARY KEY,
  merchant_trans_id  TEXT NOT NULL UNIQUE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack               TEXT NOT NULL,
  amount_uzs         NUMERIC(14,2) NOT NULL,
  credits            INTEGER NOT NULL,
  plan               TEXT NOT NULL,
  monthly_allowance  INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'created',
  click_trans_id     TEXT,
  click_paydoc_id    TEXT,
  error_code         INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON payments (user_id, created_at DESC);

-- Log of every outbound call to an external API (OpenAI chat / search / image,
-- Tavily, image microservice). Used by the admin dashboard to monitor usage,
-- spend, and error rates. Writes are fire-and-forget from the call sites — a
-- logging failure must never break generation.
CREATE TABLE IF NOT EXISTS api_usage (
  id                BIGSERIAL PRIMARY KEY,
  provider          TEXT NOT NULL,
  endpoint          TEXT NOT NULL,
  model             TEXT,
  user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  cost_usd_micros   BIGINT NOT NULL DEFAULT 0,
  latency_ms        INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'ok',
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_usage_created_idx ON api_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS api_usage_provider_created_idx ON api_usage (provider, created_at DESC);
CREATE INDEX IF NOT EXISTS api_usage_user_created_idx ON api_usage (user_id, created_at DESC);
`;

/**
 * Apply the schema. No-op (returns false) when DATABASE_URL is unset, so the
 * server can still boot in DB-less dev mode (tracking simply disabled).
 */
export async function migrate(): Promise<boolean> {
  if (!dbEnabled()) return false;
  await query(SCHEMA);
  return true;
}
