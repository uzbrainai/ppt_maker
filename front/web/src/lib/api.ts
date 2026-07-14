import type { Credits, DocItem, User } from '../types'
import { apiHeaders } from './auth'
import { SLIDEWIND_BASE, slidewindEnabled, ApiError } from './slidewind'
import { getStoredLang, t } from './i18n'

// Account / credits / materials endpoints on the slidewind service. These share
// the base + auth with the generation client (lib/slidewind.ts).

function base(): string {
  return SLIDEWIND_BASE.replace(/\/$/, '')
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(base() + path, { headers: apiHeaders() })
  if (!res.ok) {
    const d = await res.json().catch(() => null)
    throw new ApiError((d && d.error) || `Request failed (HTTP ${res.status})`, res.status, d && d.code)
  }
  return res.json() as Promise<T>
}

export interface MeResponse {
  tracking: boolean
  user: { id: string; email: string | null; name: string | null; plan: string; role?: string; unlimited?: boolean; blocked?: boolean } | null
  credits: Credits | null
}

/** A user plus credit balance, as returned by GET /admin/users. */
export interface AdminUser {
  id: string
  email: string | null
  name: string | null
  plan: string
  role: string
  balance: number
  createdAt: string
}

export interface MaterialMeta {
  id: string
  userId: string
  kind: string
  title: string
  pages: number
  theme: string | null
  lang: string | null
  premium: boolean
  cover: string | null
  createdAt: string
  updatedAt: string
}

export interface LedgerEntry {
  delta: number
  reason: string
  deckId: string | null
  balanceAfter: number
  createdAt: string
}

/** Current user profile + credit balance. Null when the service isn't configured. */
export async function fetchMe(): Promise<MeResponse | null> {
  if (!slidewindEnabled()) return null
  return getJson<MeResponse>('/me')
}

/** The signed-in user's generated materials (decks). */
export async function fetchMaterials(): Promise<MaterialMeta[]> {
  if (!slidewindEnabled()) return []
  const r = await getJson<{ materials: MaterialMeta[] }>('/me/materials')
  return r.materials || []
}

/** Credit transaction history (newest first). */
export async function fetchLedger(): Promise<LedgerEntry[]> {
  if (!slidewindEnabled()) return []
  const r = await getJson<{ entries: LedgerEntry[] }>('/me/credits/ledger')
  return r.entries || []
}

export interface CheckoutResponse {
  ok: boolean
  status: string
  message?: string
  payUrl?: string
  pack?: string
  amountUzs?: number
  merchantTransId?: string
  available?: string[]
}

/** Start a Click.uz credit purchase. On success, redirect the browser to `payUrl`. */
export async function checkoutCredits(
  credits?: number,
  pack?: string,
  slug?: string,
  billing?: 'monthly' | 'yearly'
): Promise<CheckoutResponse> {
  const res = await fetch(base() + '/credits/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...apiHeaders() },
    body: JSON.stringify({ credits, pack, slug, billing }),
  })
  const data = (await res.json()) as CheckoutResponse
  if (!res.ok && !data.message) {
    data.message = data.message || `Checkout failed (${res.status})`
  }
  return data
}

/** Public plan catalog (subscription tiers + token packs). Editable from admin. */
export interface PublicPlan {
  id: number
  slug: string
  name: string
  kind: 'subscription' | 'token'
  priceUzs: number
  credits: number
  monthlyAllowance: number | null
  blurb: string | null
  features: string[]
  isActive: boolean
  isPopular: boolean
  sortOrder: number
  yearlyDiscountPct: number
}
export async function fetchPublicPlans(): Promise<PublicPlan[]> {
  if (!slidewindEnabled()) return []
  try {
    const r = await getJson<{ plans: PublicPlan[] }>('/plans')
    return r.plans || []
  } catch { return [] }
}

/** Human-friendly relative time from an ISO timestamp. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, (Date.now() - then) / 1000)
  const lang = getStoredLang()
  if (s < 60) return t(lang, 'justNow')
  const m = Math.floor(s / 60)
  const mAgo = lang === 'ru' ? `${m} мин назад` : lang === 'uz' ? `${m} daq oldin` : `${m}m ago`
  if (m < 60) return mAgo
  const h = Math.floor(m / 60)
  const hAgo = lang === 'ru' ? `${h} ч назад` : lang === 'uz' ? `${h} soat oldin` : `${h}h ago`
  if (h < 24) return hAgo
  const d = Math.floor(h / 24)
  const dAgo = lang === 'ru' ? `${d} д назад` : lang === 'uz' ? `${d} kun oldin` : `${d}d ago`
  if (d < 7) return dAgo
  return new Date(iso).toLocaleDateString()
}

/** Map a server material into the dashboard's DocItem shape. Uses the material's
 *  `kind` (`ppt` / `kurs` / `mustaqil`) so it lands on the right list page. */
export function materialToDoc(m: MaterialMeta): DocItem {
  const kind = (m.kind === 'kurs' || m.kind === 'mustaqil') ? m.kind : 'ppt'
  return {
    id: m.id,
    type: kind,
    title: m.title,
    category: 'AI generated',
    tags: [m.premium ? 'premium' : 'general', t(getStoredLang(), 'slidesCount', { n: m.pages }), ...(m.theme ? [m.theme] : [])],
    updated: relativeTime(m.updatedAt),
    deckId: m.id,
    cover: m.cover || undefined,
    pageCount: m.pages,
    status: 'ready',
    slides: kind === 'ppt' ? [{ title: m.title, bullets: [t(getStoredLang(), 'slidesCount', { n: m.pages })] }] : undefined,
  }
}

/** Merge the /me response into a stored User (id + plan become canonical). */
export function mergeMeUser(prev: User | null, me: MeResponse): User | null {
  if (!me.user) return prev
  return {
    id: me.user.id,
    name: me.user.name || prev?.name || (me.user.email ? me.user.email.split('@')[0] : t(getStoredLang(), 'user')),
    email: me.user.email || prev?.email || '',
    plan: me.user.plan,
    role: me.user.role || prev?.role,
  }
}

// ── admin ───────────────────────────────────────────────────────────────────

/** All users with balances (admin only). Requires an admin JWT. */
export async function adminListUsers(): Promise<AdminUser[]> {
  const r = await getJson<{ users: AdminUser[] }>('/admin/users')
  return r.users || []
}

/** Grant `amount` credits to a user (admin only). Returns the new balance. */
export async function adminGrantCredits(userId: string, amount: number): Promise<number> {
  const res = await fetch(base() + '/admin/credits/grant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...apiHeaders() },
    body: JSON.stringify({ userId, amount }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => null)
    throw new ApiError((d && d.error) || `Grant failed (HTTP ${res.status})`, res.status, d && d.code)
  }
  const d = await res.json()
  return d.balance as number
}

// ── admin: external API usage ──────────────────────────────────────────────

export type UsagePeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'
export type ApiProvider = 'openai_chat' | 'openai_search' | 'openai_image' | 'tavily' | 'image_service'

export interface UsageProviderRow {
  provider: ApiProvider
  calls: number
  errors: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsdMicros: number
  avgLatencyMs: number
}

export interface UsageModelRow {
  provider: ApiProvider
  model: string
  calls: number
  errors: number
  totalTokens: number
  costUsdMicros: number
  avgLatencyMs: number
}

export interface UsageSummary {
  period: UsagePeriod
  totals: { calls: number; errors: number; totalTokens: number; costUsdMicros: number; avgLatencyMs: number }
  byProvider: UsageProviderRow[]
  byModel: UsageModelRow[]
}

export interface UsageTimePoint {
  bucket: string
  provider: ApiProvider
  calls: number
  totalTokens: number
  costUsdMicros: number
}

export interface UsageTopUser {
  userId: string
  email: string | null
  name: string | null
  calls: number
  totalTokens: number
  costUsdMicros: number
}

export async function adminApiUsageSummary(period: UsagePeriod): Promise<UsageSummary> {
  return getJson<UsageSummary>(`/admin/api-usage/summary?period=${period}`)
}

export async function adminApiUsageTimeseries(period: UsagePeriod): Promise<{ period: UsagePeriod; points: UsageTimePoint[] }> {
  return getJson<{ period: UsagePeriod; points: UsageTimePoint[] }>(`/admin/api-usage/timeseries?period=${period}`)
}

export async function adminApiUsageTopUsers(period: UsagePeriod, limit = 10): Promise<{ period: UsagePeriod; users: UsageTopUser[] }> {
  return getJson<{ period: UsagePeriod; users: UsageTopUser[] }>(`/admin/api-usage/top-users?period=${period}&limit=${limit}`)
}

/** Convert USD-micros (integer) to a display string with $ sign and 2-4 sig figs. */
export function formatUsd(micros: number): string {
  const usd = micros / 1_000_000
  if (usd >= 100) return `$${usd.toFixed(0)}`
  if (usd >= 1)   return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(4)}`
}
