/**
 * Resolve the calling user. Identity is owned by the external auth backend: in
 * production we read it from the verified JWT payload. In dev (AUTH_REQUIRED
 * off) we fall back to optional `x-user-*` headers, then a stable dev user, so
 * the prototype keeps working without a real auth backend.
 */

import type { FastifyRequest } from "fastify";
import type { UserIdentity } from "../db/users.js";

/** Pull id/email/name out of a decoded JWT payload (claim names vary by issuer). */
export function identityFromJwt(payload: unknown): UserIdentity | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const id = (p.sub ?? p.id ?? p.uid ?? p.userId) as string | undefined;
  if (!id) return null;
  return {
    id: String(id),
    email: typeof p.email === "string" ? p.email : null,
    name: typeof p.name === "string" ? p.name : typeof p.username === "string" ? (p.username as string) : null,
    role: typeof p.role === "string" ? p.role : null,
  };
}

/** Dev/service-token fallback: read identity from explicit headers if present. */
export function identityFromHeaders(req: FastifyRequest): UserIdentity | null {
  const id = req.headers["x-user-id"];
  if (typeof id !== "string" || !id) return null;
  const email = req.headers["x-user-email"];
  const name = req.headers["x-user-name"];
  return {
    id,
    email: typeof email === "string" ? email : null,
    name: typeof name === "string" ? name : null,
  };
}
