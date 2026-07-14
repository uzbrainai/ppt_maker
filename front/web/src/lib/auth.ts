import type { AuthMode, User } from '../types'
import { SLIDEWIND_BASE } from './slidewind'

// Real JWT auth. The slidewind service is the auth backend (POST /auth/register,
// /auth/login → { token, user }); VITE_API_BASE is an optional override if auth
// lives elsewhere. When neither is configured (no backend at all) we fall back to
// a local mock session so the prototype still works offline. On success the JWT
// is stored and authHeader() attaches it to every API call.
const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE ||
  (typeof window !== 'undefined' && (window as any).PPT_API_BASE) ||
  ''

/** Where the /auth/* endpoints live: the override if set, else the slidewind service. */
const AUTH_BASE: string = API_BASE || SLIDEWIND_BASE

const USER_KEY = 'pptmaker-user'
const TOKEN_KEY = 'pptmaker-token'

export interface Credentials { name?: string; email?: string; password?: string }

function persist(user: User, token: string | null) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    if (token) localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function getStoredUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null')
  } catch {
    return null
  }
}

/** Merge fields (e.g. canonical id/plan from /me) into the stored user. */
export function updateStoredUser(patch: Partial<User>): User | null {
  const cur = getStoredUser()
  if (!cur) return null
  const next = { ...cur, ...patch }
  try { localStorage.setItem(USER_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  return next
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** Spread into fetch headers once JWT is live: fetch(url, { headers: { ...authHeader() } }). */
export function authHeader(): Record<string, string> {
  const t = getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

/**
 * Identity headers for the dev/mock path: when there's no JWT, the slidewind
 * service identifies the user (for credit tracking) via x-user-* headers. In
 * production (AUTH_REQUIRED) the verified JWT is authoritative and these are
 * ignored, so it's safe to always send them.
 */
export function identityHeader(): Record<string, string> {
  const u = getStoredUser()
  if (!u) return {}
  const id = u.id || u.email
  if (!id) return {}
  const h: Record<string, string> = { 'x-user-id': id }
  if (u.email) h['x-user-email'] = u.email
  if (u.name) h['x-user-name'] = u.name
  return h
}

/** All auth-related headers to attach to a slidewind API call. */
export function apiHeaders(): Record<string, string> {
  return { ...authHeader(), ...identityHeader() }
}

/**
 * Result of an auth attempt. Registration (and login of an unverified account)
 * does NOT hand back a session — the caller must collect a 6-digit code and call
 * verifyEmail() before the user is signed in.
 */
export type AuthResult =
  | { status: 'authenticated'; user: User }
  | { status: 'verify'; email: string }

function base(): string {
  return AUTH_BASE.replace(/\/$/, '')
}

export async function authenticate(mode: AuthMode, creds: Credentials): Promise<AuthResult> {
  // No backend configured at all → local mock session so the prototype works offline.
  if (!AUTH_BASE) {
    const mockUser: User = {
      name: creds.name || (creds.email ? creds.email.split('@')[0] : 'User'),
      email: creds.email || 'you@example.com',
    }
    persist(mockUser, null)
    return { status: 'authenticated', user: mockUser }
  }
  // Real auth: register or log in against the service. Failures throw (with the
  // server's message) so the UI can show "invalid email or password" etc. — no
  // silent fallback, otherwise any credentials would appear to "work".
  const path = mode === 'signup' ? '/auth/register' : '/auth/login'
  const res = await fetch(base() + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: creds.email, password: creds.password, name: creds.name }),
  })
  const data = await res.json().catch(() => null)
  // Registration always requires verification; login of an unverified account
  // returns 403 email_unverified (the server sends a fresh code). Both funnel to
  // the code-entry step rather than throwing.
  if (mode === 'signup' && res.ok && data?.status === 'verification_sent') {
    return { status: 'verify', email: data.email || creds.email || '' }
  }
  if (!res.ok && data?.code === 'email_unverified') {
    return { status: 'verify', email: data.email || creds.email || '' }
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Authentication failed (HTTP ${res.status})`)
  }
  const user: User = data.user
  persist(user, data.token || data.accessToken || null)
  return { status: 'authenticated', user }
}

/** Exchange a Google Sign-In ID token for a slidewind session. */
export async function signInWithGoogle(idToken: string): Promise<AuthResult> {
  if (!AUTH_BASE) {
    throw new Error('Google sign-in requires the API (set VITE_SLIDEWIND_BASE).')
  }
  const res = await fetch(base() + '/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data && data.error) || `Google sign-in failed (HTTP ${res.status})`)
  }
  const user: User = data.user
  persist(user, data.token || data.accessToken || null)
  return { status: 'authenticated', user }
}

/** Client ID baked in at build time (empty → Google button hidden). */
export function googleClientId(): string {
  return String((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '').trim()
}

/** Submit the 6-digit code → activates the account and starts the session. */
export async function verifyEmail(email: string, code: string): Promise<User> {
  if (!AUTH_BASE) {
    // Offline mock: no real verification, just start a session.
    const mockUser: User = { name: email.split('@')[0], email }
    persist(mockUser, null)
    return mockUser
  }
  const res = await fetch(base() + '/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data && data.error) || `Verification failed (HTTP ${res.status})`)
  }
  const user: User = data.user
  persist(user, data.token || data.accessToken || null)
  return user
}

/** Ask the server to email a new code to an unverified account. */
export async function resendCode(email: string): Promise<void> {
  if (!AUTH_BASE) return
  await fetch(base() + '/auth/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export function signOut() {
  try {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}
