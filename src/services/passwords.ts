/**
 * Password hashing with Node's built-in scrypt (no external dependency). The
 * stored form is `scrypt$<N>$<saltHex>$<hashHex>`, carrying the cost parameter so
 * hashes stay verifiable if it changes later. Verification is constant-time.
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "crypto";
import { promisify } from "util";

// promisify only infers the no-options overload, so type the wrapper explicitly
// to keep the scrypt cost (N) parameter.
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions
) => Promise<Buffer>;

const COST = 16384; // scrypt N — work factor
const KEYLEN = 64;
const SALT_BYTES = 16;

/** Hash a plaintext password into a self-describing, storable string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scryptAsync(password, salt, KEYLEN, { N: COST })) as Buffer;
  return `scrypt$${COST}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Verify a plaintext password against a stored hash. False on any malformed input. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");
  if (!cost || salt.length === 0 || expected.length === 0) return false;
  const derived = (await scryptAsync(password, salt, expected.length, { N: cost })) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
