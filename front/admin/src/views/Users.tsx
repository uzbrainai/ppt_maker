import { useEffect, useMemo, useState } from 'react'
import {
  fetchUsers, blockUser, unblockUser, setPlan, setUnlimited, grantCredits,
  fmtInt, fmtDate, type AdminUser,
} from '../lib/api'
import { t, useLang, type Lang } from '../lib/i18n'

const PLANS = ['free', 'starter', 'pro', 'team', 'premium']

function planClass(p: string): string {
  const k = p.toLowerCase()
  if (['pro', 'premium'].includes(k)) return 'pro'
  if (k === 'team') return 'team'
  if (k === 'starter' || k === 'free') return 'free'
  return 'starter'
}

function EditModal({ user, onClose, onSaved, lang }: { user: AdminUser; onClose: () => void; onSaved: (u: AdminUser) => void; lang: Lang }) {
  const [plan, setPlanValue] = useState(user.plan)
  const [monthly, setMonthly] = useState<string>('')
  const [grant, setGrant] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const save = async () => {
    setBusy(true); setErr(null)
    try {
      if (plan !== user.plan || monthly.trim()) {
        const mo = monthly.trim() ? Math.max(0, Number(monthly)) : undefined
        await setPlan(user.id, plan, mo)
      }
      let newBalance = user.balance
      if (grant.trim()) {
        const n = Math.max(1, Math.floor(Number(grant)))
        const r = await grantCredits(user.id, n, 'admin_manual')
        newBalance = r.balance
      }
      onSaved({ ...user, plan, balance: newBalance })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t(lang, 'saveFailed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t(lang, 'users_edit_title')}</h2>
        <p style={{ color: 'var(--text-2)', margin: '0 0 14px' }}>{user.name || user.email || user.id}</p>
        {err && <div className="error-banner">{err}</div>}

        <div className="field">
          <label>{t(lang, 'users_edit_planLabel')}</label>
          <select value={plan} onChange={(e) => setPlanValue(e.target.value)}>
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{t(lang, 'users_edit_monthlyLabel')}</label>
          <input
            type="number" min="0"
            placeholder={t(lang, 'users_edit_monthlyPh', { n: fmtInt(user.balance) })}
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
          />
        </div>
        <div className="field">
          <label>{t(lang, 'users_edit_grantLabel')}</label>
          <input
            type="number" min="1"
            placeholder={t(lang, 'users_edit_grantPh')}
            value={grant}
            onChange={(e) => setGrant(e.target.value)}
          />
        </div>

        <div className="actions">
          <button onClick={onClose}>{t(lang, 'cancel')}</button>
          <button className="primary" onClick={save} disabled={busy}>{busy ? t(lang, 'saving') : t(lang, 'save')}</button>
        </div>
      </div>
    </div>
  )
}

export default function Users() {
  const lang = useLang()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminUser | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    fetchUsers()
      .then((u) => { if (alive) setUsers(u) })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : t(lang, 'failedLoad')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [lang])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return users
    return users.filter((u) =>
      (u.email || '').toLowerCase().includes(s) ||
      (u.name || '').toLowerCase().includes(s) ||
      u.id.toLowerCase().includes(s)
    )
  }, [users, q])

  const toggleBlock = async (u: AdminUser) => {
    try {
      if (u.blocked) await unblockUser(u.id); else await blockUser(u.id)
      setUsers((list) => list.map((x) => x.id === u.id ? { ...x, blocked: !u.blocked } : x))
    } catch (e) {
      alert(e instanceof Error ? e.message : t(lang, 'actionFailed'))
    }
  }

  const toggleUnlimited = async (u: AdminUser) => {
    try {
      await setUnlimited(u.id, !u.unlimited)
      setUsers((list) => list.map((x) => x.id === u.id ? { ...x, unlimited: !u.unlimited } : x))
    } catch (e) {
      alert(e instanceof Error ? e.message : t(lang, 'actionFailed'))
    }
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{t(lang, 'users_title')}</h1>
          <p>{t(lang, 'users_subtitle', { n: fmtInt(users.length) })}</p>
        </div>
        <input
          placeholder={t(lang, 'users_search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      {err && <div className="error-banner">{err}</div>}
      {loading && <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>}

      {!loading && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t(lang, 'users_th_user')}</th>
                <th>{t(lang, 'users_th_plan')}</th>
                <th>{t(lang, 'users_th_credits')}</th>
                <th>{t(lang, 'users_th_joined')}</th>
                <th>{t(lang, 'users_th_status')}</th>
                <th style={{ textAlign: 'right' }}>{t(lang, 'actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{u.name || '—'}</div>
                    <div className="muted mono">{u.email || u.id}</div>
                  </td>
                  <td><span className={`badge ${planClass(u.plan)}`}>{u.plan}</span></td>
                  <td style={{ fontWeight: 700 }}>{u.unlimited ? '∞' : fmtInt(u.balance)}</td>
                  <td className="muted">{fmtDate(u.createdAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {u.role === 'admin' && <span className="badge admin">{t(lang, 'users_status_admin')}</span>}
                      {u.blocked && <span className="badge blocked">{t(lang, 'users_status_blocked')}</span>}
                      {u.unlimited && <span className="badge unlimited">∞</span>}
                      {!u.blocked && !u.unlimited && u.role !== 'admin' && <span className="badge free">{t(lang, 'users_status_active')}</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button onClick={() => setEditing(u)}>{t(lang, 'edit')}</button>
                      <button onClick={() => toggleUnlimited(u)} className={u.unlimited ? '' : 'ok'}>
                        {u.unlimited ? t(lang, 'users_revokeUnl') : t(lang, 'users_grantUnl')}
                      </button>
                      <button onClick={() => toggleBlock(u)} className={u.blocked ? 'ok' : 'danger'}>
                        {u.blocked ? t(lang, 'users_unblock') : t(lang, 'users_block')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center' }} className="muted">{t(lang, 'users_noMatch')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditModal
          user={editing}
          lang={lang}
          onClose={() => setEditing(null)}
          onSaved={(u) => setUsers((list) => list.map((x) => x.id === u.id ? u : x))}
        />
      )}
    </>
  )
}
