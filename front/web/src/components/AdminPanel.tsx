import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { Icon } from '../lib/icons'
import { t, type Lang } from '../lib/i18n'
import { adminListUsers, adminGrantCredits, relativeTime, type AdminUser } from '../lib/api'

// Admin-only panel: lists every user with their credit balance and lets an admin
// top up credits. Visibility is gated by isAdmin in the UI, and every call is
// re-checked server-side (role=admin in the JWT), so this is convenience, not the
// security boundary.

function RoleBadge({ role }: { role: string }) {
  const admin = role === 'admin'
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, letterSpacing: '0.03em', textTransform: 'uppercase', color: admin ? '#fff' : 'var(--c-text-2)', background: admin ? '#7c5cff' : 'var(--c-chip)', border: admin ? 'none' : '1px solid var(--c-border)' }}>{role}</span>
  )
}

function GrantControl({ user, onGranted, lang }: { user: AdminUser; onGranted: (balance: number) => void; lang: Lang }) {
  const [amount, setAmount] = useState('20')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const grant = async () => {
    const n = Math.floor(Number(amount))
    if (!n || n <= 0) { setErr(true); return }
    setBusy(true); setErr(false)
    try {
      const balance = await adminGrantCredits(user.id, n)
      onGranted(balance)
    } catch {
      setErr(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
        style={{ width: 56, padding: '6px 8px', borderRadius: 9, border: '1px solid ' + (err ? '#ef4444' : 'var(--c-border)'), background: 'var(--c-input)', color: 'var(--c-text)', fontSize: 13, textAlign: 'right', outline: 'none' }}
      />
      <button onClick={grant} disabled={busy} title={t(lang, 'grantCreditsTitle')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 11px', borderRadius: 9, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 13, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        <Icon name="plus" opts={{ stroke: 'currentColor', sw: 2.5, size: 13 }} />{t(lang, 'grant')}
      </button>
    </div>
  )
}

export default function AdminPanel() {
  const { adminOpen, closeAdmin, isAdmin, lang } = useApp()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!adminOpen || !isAdmin) return
    let alive = true
    setLoading(true); setError(null)
    adminListUsers()
      .then((u) => { if (alive) setUsers(u) })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : t(lang, 'failedLoadUsers')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [adminOpen, isAdmin])

  const setBalance = (id: string, balance: number) =>
    setUsers((list) => list.map((u) => (u.id === id ? { ...u, balance } : u)))

  const term = q.trim().toLowerCase()
  const shown = term
    ? users.filter((u) => (u.email || '').toLowerCase().includes(term) || (u.name || '').toLowerCase().includes(term))
    : users

  return (
    <div onClick={closeAdmin} style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(6,8,13,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', opacity: adminOpen ? 1 : 0, visibility: adminOpen ? 'visible' : 'hidden', transition: 'opacity .25s ease, visibility .25s ease' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 940, maxHeight: '88vh', display: 'flex', flexDirection: 'column', borderRadius: 26, background: 'var(--c-panel-strong)', border: '1px solid var(--c-border)', boxShadow: '0 50px 90px -40px rgba(0,0,0,0.6)', transform: adminOpen ? 'none' : 'translateY(12px) scale(0.98)', transition: 'transform .25s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 26px 16px', borderBottom: '1px solid var(--c-border)' }}>
          <div>
            <h2 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--c-text)' }}>{t(lang, 'adminUsers')}</h2>
            <p style={{ fontSize: 13, color: 'var(--c-text-2)', margin: '4px 0 0', fontWeight: 500 }}>{users.length} {users.length === 1 ? t(lang, 'accountSingular') : t(lang, 'accountPlural')} · {t(lang, 'accountsSuffix')}</p>
          </div>
          <button onClick={closeAdmin} aria-label={t(lang, 'close')} style={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer' }}>
            <Icon name="x" opts={{ stroke: 'currentColor', sw: 2, size: 18 }} />
          </button>
        </div>

        <div style={{ padding: '14px 26px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', borderRadius: 12, background: 'var(--c-chip)', border: '1px solid var(--c-border)' }}>
            <Icon name="search" opts={{ stroke: 'currentColor', sw: 2, size: 16 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang, 'searchUsers')} style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--c-text)', fontSize: 14, outline: 'none' }} />
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '12px 26px 24px' }}>
          {loading && <p style={{ color: 'var(--c-text-2)', fontSize: 14, padding: '20px 0', textAlign: 'center' }}>{t(lang, 'loadingUsers')}</p>}
          {error && <p style={{ color: '#f87171', fontSize: 14, fontWeight: 600, padding: '20px 0', textAlign: 'center' }}>{error}</p>}
          {!loading && !error && shown.length === 0 && <p style={{ color: 'var(--c-text-3)', fontSize: 14, padding: '20px 0', textAlign: 'center' }}>{t(lang, 'noMatchingUsers')}</p>}
          {!loading && !error && shown.map((u) => (
            <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '13px 4px', borderBottom: '1px solid var(--c-border)' }}>
              <div style={{ minWidth: 220, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--c-text)' }}>{u.name || '—'}</span>
                  <RoleBadge role={u.role} />
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--c-text-3)', marginTop: 2 }}>{u.email || u.id} · {t(lang, 'joined')} {relativeTime(u.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{ textAlign: 'right', minWidth: 70 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: u.balance <= 0 ? '#ef4444' : 'var(--c-text)' }}>{u.balance}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 600 }}>{t(lang, 'credits')}</div>
                </div>
                <GrantControl user={u} onGranted={(b) => setBalance(u.id, b)} lang={lang} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
