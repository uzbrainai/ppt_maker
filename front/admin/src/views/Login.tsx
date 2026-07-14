import { useState } from 'react'
import { login, type StoredAdmin } from '../lib/api'
import { LANGS, setStoredLang, t, useLang } from '../lib/i18n'

const MailIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
)
const LockIcon = () => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)
const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

const POINT_ICONS = ['📊', '💳', '👥', '💬']
const POINT_KEYS = ['loginPoint1', 'loginPoint2', 'loginPoint3', 'loginPoint4'] as const

export default function Login({ onAuth }: { onAuth: (user: StoredAdmin, token: string) => void }) {
  const lang = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setErr(null); setBusy(true)
    try {
      const r = await login(email.trim(), password)
      onAuth({ id: r.user.id, email: r.user.email, name: r.user.name, role: r.user.role }, r.token)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t(lang, 'loginFailed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="auth-wrap">
      <div className="grid-bg" />
      {/* Language switcher pinned to the top-right so users can pick their language before logging in */}
      <div style={{ position: 'absolute', top: 18, right: 20, display: 'flex', gap: 4, zIndex: 10 }}>
        {LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => setStoredLang(l.id)}
            title={l.label}
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              border: '1px solid ' + (lang === l.id ? 'var(--accent, #7c5cff)' : 'rgba(255,255,255,0.15)'),
              background: lang === l.id ? 'rgba(124,92,255,0.2)' : 'rgba(0,0,0,0.3)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            {l.id.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="auth-shell">
        {/* Left: hero */}
        <div className="auth-hero">
          <div className="logo">
            <span className="dot" />
            <span>Slidewind <span style={{ opacity: 0.55 }}>· {t(lang, 'brand_admin')}</span></span>
          </div>
          <h1 style={{ whiteSpace: 'pre-line' }}>{t(lang, 'loginHeroTitle')}</h1>
          <p>{t(lang, 'loginHeroBody')}</p>
          <div className="points">
            {POINT_KEYS.map((k, i) => (
              <div key={k} className="row">
                <span className="tick">{POINT_ICONS[i]}</span>
                <span>{t(lang, k)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: form card */}
        <form className="auth-card" onSubmit={submit}>
          <h1>{t(lang, 'signIn')}</h1>
          <p>{t(lang, 'signInSubtitle')}</p>

          {err && <div className="error-banner">{err}</div>}

          <div className="field">
            <label>{t(lang, 'email')}</label>
            <div className="with-icon">
              <MailIcon />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoFocus
                required
              />
            </div>
          </div>
          <div className="field">
            <label>{t(lang, 'password')}</label>
            <div className="with-icon">
              <LockIcon />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button type="submit" className="primary" disabled={busy}>
            {busy ? (
              <>
                <span className="spinner" style={{ borderTopColor: '#fff', marginRight: 8 }} />
                {t(lang, 'signingIn')}
              </>
            ) : t(lang, 'signInBtn')}
          </button>

          <div className="foot">
            <span className="lock"><ShieldIcon /> {t(lang, 'encryptedFoot')}</span>
            <span>{t(lang, 'roleAdminOnly')}</span>
          </div>
        </form>
      </div>
    </div>
  )
}
