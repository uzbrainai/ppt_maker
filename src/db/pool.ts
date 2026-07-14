/**
 * PostgreSQL connection pool. Reads DATABASE_URL (e.g.
 * postgres://user:pass@host:5432/slidewind). The pool is created lazily on first
 * use so importing this module never throws when the DB is not configured (e.g.
 * the CLI / library paths that don't touch persistence).
 */

import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | undefined;

/** True when a DATABASE_URL is configured (i.e. persistence is available). */
export function dbEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

/** The shared pool. Throws a clear error if DATABASE_URL is missing. */
export function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set — user/credit/material tracking requires PostgreSQL. " +
        "Set DATABASE_URL in your .env (see deploy/.env.example)."
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      // Hosted Postgres often requires TLS; allow opting in without a CA file.
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
    pool.on("error", (err) => {
      // Don't crash the process on an idle-client error; log and let the pool recover.
      console.error("[db] idle client error:", err.message);
    });
  }
  return pool;
}

/** Run a parameterized query. */
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(text, params as never[]);
}

/**
 * Run `fn` inside a transaction on a dedicated client. Commits on success,
 * rolls back on any throw, and always releases the client.
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback errors */
    }
    throw e;
  } finally {
    client.release();
  }
}

/** Close the pool (for graceful shutdown / tests). */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
