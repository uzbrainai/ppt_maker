import type { Page } from '../App'
import type { StoredAdmin } from '../lib/api'
import { LANGS, setStoredLang, t, useLang, type Lang } from '../lib/i18n'

const NAV: { id: Page; key: string; icon: string }[] = [
  { id: 'dashboard',     key: 'nav_dashboard',     icon: '📊' },
  { id: 'users',         key: 'nav_users',         icon: '👥' },
  { id: 'plans',         key: 'nav_plans',         icon: '⚙️' },
  { id: 'subscriptions', key: 'nav_subscriptions', icon: '💳' },
  { id: 'payments',      key: 'nav_payments',      icon: '💰' },
  { id: 'support',       key: 'nav_support',       icon: '💬' },
  { id: 'api-usage',     key: 'nav_apiUsage',      icon: '🔌' },
]

function LangSwitcher({ lang }: { lang: Lang }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          onClick={() => setStoredLang(l.id)}
          title={l.label}
          style={{
            flex: 1,
            padding: '5px 6px',
            borderRadius: 6,
            border: '1px solid ' + (lang === l.id ? 'var(--accent, #7c5cff)' : 'var(--border, #333)'),
            background: lang === l.id ? 'rgba(124,92,255,0.15)' : 'transparent',
            color: lang === l.id ? 'var(--text)' : 'var(--text-3, #888)',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {l.id.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export default function Sidebar({ page, user, onSignOut }: { page: Page; user: StoredAdmin | null; onSignOut: () => void }) {
  const lang = useLang()
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="dot" />
        <span>Slidewind <span style={{ opacity: 0.6 }}>{t(lang, 'brand_admin')}</span></span>
      </div>
      <nav>
        {NAV.map((n) => (
          <a
            key={n.id}
            href={`#/${n.id}`}
            className={page === n.id ? 'on' : ''}
          >
            <span style={{ width: 20, textAlign: 'center' }}>{n.icon}</span>
            {t(lang, n.key)}
          </a>
        ))}
      </nav>
      <div className="foot">
        <LangSwitcher lang={lang} />
        <div className="user">{user?.name || user?.email || 'Admin'}</div>
        <div>{user?.email}</div>
        <button onClick={onSignOut}>{t(lang, 'signOut')}</button>
      </div>
    </aside>
  )
}
