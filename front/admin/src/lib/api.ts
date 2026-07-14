// Slidewind admin API client.
// Talks to the same backend as front/web; nginx proxies /api/ → slidewind:8081.

export const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE ||
  (typeof window !== 'undefined' && (window as any).SLIDEWIND_BASE) ||
  '/api'

const KEY_TOKEN = 'pptadmin-token'
const KEY_USER = 'pptadmin-user'

export interface AdminUser {
  id: string
  email: string | null
  name: string | null
  plan: string
  role: string
  emailVerified?: boolean
  blocked: boolean
  unlimited: boolean
  balance: number
  createdAt: string
}

export interface Payment {
  id: number
  merchantTransId: string
  userId: string
  userEmail: string | null
  userName: string | null
  pack: string
  amountUzs: number
  credits: number
  plan: string
  status: 'created' | 'prepared' | 'paid' | 'failed' | 'cancelled'
  clickTransId: string | null
  createdAt: string
  updatedAt: string
}

export interface SupportMessage {
  id: number
  userId: string | null
  name: string | null
  email: string | null
  body: string
  reply: string | null
  repliedBy: string | null
  repliedAt: string | null
  createdAt: string
}

export interface DashboardStats {
  users: { total: number; blocked: number; unlimited: number; admins: number; newLast30d: number }
  payments: { paidCount: number; paidTotalUzs: number; createdCount: number; last30dUzs: number }
  credits: { granted: number; spent: number }
  materials: { total: number }
  support: { total: number; unanswered: number }
}

export interface TimePoint { bucket: string; count: number; totalUzs: number }
export type Period = 'day' | 'week' | 'month' | 'quarter' | 'year'

export type PlanKind = 'subscription' | 'token'
export interface Plan {
  id: number
  slug: string
  name: string
  kind: PlanKind
  priceUzs: number
  credits: number
  monthlyAllowance: number | null
  blurb: string | null
  features: string[]
  isActive: boolean
  isPopular: boolean
  sortOrder: number
  yearlyDiscountPct: number
  createdAt: string
  updatedAt: string
}
export interface PlanInput {
  slug: string
  name: string
  kind: PlanKind
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

export function getToken(): string | null {
  try { return localStorage.getItem(KEY_TOKEN) } catch { return null }
}
export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(KEY_TOKEN, t)
    else localStorage.removeItem(KEY_TOKEN)
  } catch {}
}

export interface StoredAdmin { id: string; email: string; name: string; role: string }
export function getStoredAdmin(): StoredAdmin | null {
  try {
    const raw = localStorage.getItem(KEY_USER)
    return raw ? JSON.parse(raw) as StoredAdmin : null
  } catch { return null }
}
export function setStoredAdmin(u: StoredAdmin | null) {
  try {
    if (u) localStorage.setItem(KEY_USER, JSON.stringify(u))
    else localStorage.removeItem(KEY_USER)
  } catch {}
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(msg: string, status: number, code?: string) {
    super(msg); this.name = 'ApiError'; this.status = status; this.code = code
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }
  const tok = getToken()
  if (tok) headers['Authorization'] = `Bearer ${tok}`
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    let msg = `Request failed (HTTP ${res.status})`
    let code: string | undefined
    try {
      const d = await res.json()
      if (d?.error) msg = d.error
      if (d?.code) code = d.code
    } catch {}
    throw new ApiError(msg, res.status, code)
  }
  if (res.status === 204) return undefined as unknown as T
  return res.json() as Promise<T>
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string
  user: { id: string; email: string; name: string; plan: string; role: string }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const r = await request<{ token?: string; user?: { id: string; email: string; name: string; plan: string; role: string }; status?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (r.status && r.status !== 'authenticated') {
    throw new ApiError('Verification required — sign in on the main site first.', 403, 'verify_required')
  }
  if (!r.token || !r.user) throw new ApiError('Login failed', 500)
  if (r.user.role !== 'admin') {
    throw new ApiError('This account is not an admin.', 403, 'forbidden')
  }
  return { token: r.token, user: r.user }
}

export function signOut() {
  setToken(null); setStoredAdmin(null)
}

// ── Admin endpoints ─────────────────────────────────────────────────────────

export async function fetchStats(): Promise<DashboardStats> {
  const r = await request<{ stats: DashboardStats }>('/admin/stats')
  return r.stats
}

export async function fetchPaymentsTimeseries(period: Period): Promise<TimePoint[]> {
  const r = await request<{ points: TimePoint[] }>(`/admin/stats/payments?period=${period}`)
  return r.points
}

export async function fetchUsers(q?: string): Promise<AdminUser[]> {
  const r = await request<{ users: AdminUser[] }>('/admin/users')
  if (!q) return r.users
  const t = q.toLowerCase()
  return r.users.filter((u) => (u.email || '').toLowerCase().includes(t) || (u.name || '').toLowerCase().includes(t))
}

export async function fetchUser(id: string): Promise<AdminUser> {
  const r = await request<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}`)
  return r.user
}

export async function blockUser(id: string): Promise<void> {
  await request(`/admin/users/${encodeURIComponent(id)}/block`, { method: 'POST' })
}
export async function unblockUser(id: string): Promise<void> {
  await request(`/admin/users/${encodeURIComponent(id)}/unblock`, { method: 'POST' })
}
export async function setPlan(id: string, plan: string, monthlyAllowance?: number): Promise<void> {
  await request(`/admin/users/${encodeURIComponent(id)}/plan`, {
    method: 'POST',
    body: JSON.stringify({ plan, monthlyAllowance }),
  })
}
export async function setUnlimited(id: string, unlimited: boolean): Promise<void> {
  await request(`/admin/users/${encodeURIComponent(id)}/unlimited`, {
    method: 'POST',
    body: JSON.stringify({ unlimited }),
  })
}
export async function grantCredits(id: string, amount: number, reason?: string): Promise<{ balance: number }> {
  return request<{ userId: string; granted: number; balance: number }>(`/admin/credits/grant`, {
    method: 'POST',
    body: JSON.stringify({ userId: id, amount, reason }),
  }).then((r) => ({ balance: r.balance }))
}

export async function fetchPayments(status?: string): Promise<Payment[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  const r = await request<{ payments: Payment[] }>(`/admin/payments${q}`)
  return r.payments
}

export async function fetchSubscriptions(): Promise<Payment[]> {
  const r = await request<{ subscriptions: Payment[] }>(`/admin/subscriptions`)
  return r.subscriptions
}

export async function fetchSupport(): Promise<SupportMessage[]> {
  const r = await request<{ messages: SupportMessage[] }>(`/admin/support/messages`)
  return r.messages
}

// ── Plans (admin catalog) ───────────────────────────────────────────────────

export async function fetchPlans(): Promise<Plan[]> {
  const r = await request<{ plans: Plan[] }>('/admin/plans')
  return r.plans
}
export async function createPlan(input: Partial<PlanInput> & { slug: string; name: string }): Promise<Plan> {
  const r = await request<{ plan: Plan }>('/admin/plans', { method: 'POST', body: JSON.stringify(input) })
  return r.plan
}
export async function updatePlan(id: number, patch: Partial<PlanInput>): Promise<Plan> {
  const r = await request<{ plan: Plan }>(`/admin/plans/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
  return r.plan
}
export async function deletePlan(id: number): Promise<void> {
  await request(`/admin/plans/${id}`, { method: 'DELETE' })
}

// ── External API usage ──────────────────────────────────────────────────────

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
  period: Period
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

export async function fetchApiUsageSummary(period: Period): Promise<UsageSummary> {
  return request<UsageSummary>(`/admin/api-usage/summary?period=${period}`)
}

export async function fetchApiUsageTimeseries(period: Period): Promise<{ period: Period; points: UsageTimePoint[] }> {
  return request<{ period: Period; points: UsageTimePoint[] }>(`/admin/api-usage/timeseries?period=${period}`)
}

export async function fetchApiUsageTopUsers(period: Period, limit = 10): Promise<{ period: Period; users: UsageTopUser[] }> {
  return request<{ period: Period; users: UsageTopUser[] }>(`/admin/api-usage/top-users?period=${period}&limit=${limit}`)
}

/** USD-micros → display string. */
export function fmtUsd(micros: number): string {
  const usd = micros / 1_000_000
  if (usd >= 1000) return `$${usd.toFixed(0)}`
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(4)}`
}

/** Compact int format: 12345 → 12.3k, 1500000 → 1.5M */
export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(Math.round(n))
}

export async function replySupport(id: number, reply: string): Promise<SupportMessage> {
  const r = await request<{ message: SupportMessage }>(`/admin/support/messages/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ reply }),
  })
  return r.message
}

// ── Formatters ──────────────────────────────────────────────────────────────

export function fmtUzs(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + " so'm"
}
export function fmtInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}
export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export function fmtBucket(iso: string, period: Period): string {
  const d = new Date(iso)
  if (period === 'day') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (period === 'week') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (period === 'month') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  if (period === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
  return String(d.getFullYear())
}
