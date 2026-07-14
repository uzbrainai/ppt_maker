import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context'
import { getProducts, PRODUCT_IDS, productHref } from '../data/products'
import { authHref, pageHref, profileHref } from '../lib/routes'
import { Icon } from '../lib/icons'
import { t } from '../lib/i18n'
import { Brand } from './ui'

function useMatch(query: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = () => setM(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [query])
  return m
}

function ThemeIcon({ theme }: { theme: string }) {
  if (theme === 'dark') {
    return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></svg>
  }
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
}

const navStyle: React.CSSProperties = { position: 'sticky', top: 16, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, margin: '16px auto 0', maxWidth: 1180, padding: '9px 12px 9px 18px', borderRadius: 999, background: 'var(--c-panel)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--c-border)', boxShadow: '0 18px 44px -24px rgba(31,42,68,0.4),inset 0 1px 0 rgba(255,255,255,0.12)' }

// Collapses the three product tabs into one "Products" droplet. It's a full pill
// (borderRadius 999) so its curvature matches the navbar's pill container — a
// separate blob floating inside the same rounded shape. Click opens the list.
function ProductsMenu() {
  const { product, goProduct, lang } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  const products = getProducts(lang)
  const current = products[product]
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '9px 15px', borderRadius: 999, border: '1px solid var(--c-border)', background: open ? 'var(--c-panel-2)' : 'var(--c-chip)', color: 'var(--c-text)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)', transition: 'background .18s' }}
      >
        <span style={{ width: 8, height: 8, borderRadius: 99, background: current.accent, flexShrink: 0 }} />
        {t(lang, 'products')}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', opacity: 0.8 }}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div
        role="menu"
        style={{ position: 'absolute', top: '100%', left: 0, marginTop: 10, minWidth: 216, padding: 6, borderRadius: 18, background: 'var(--c-panel-strong)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--c-border)', boxShadow: '0 26px 50px -24px rgba(31,42,68,0.5),inset 0 1px 0 rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', gap: 2, opacity: open ? 1 : 0, visibility: open ? 'visible' : 'hidden', transform: open ? 'none' : 'translateY(-8px)', transition: 'opacity .2s ease, transform .2s ease, visibility .2s', zIndex: 70 }}
      >
        {PRODUCT_IDS.map((id) => {
          const on = id === product
          const c = products[id]
          return (
            <a
              key={id}
              role="menuitem"
              href={productHref(id)}
              onClick={(e) => { e.preventDefault(); goProduct(id); setOpen(false) }}
              onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--c-chip)' }}
              onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 12, border: 'none', background: on ? 'var(--c-chip)' : 'transparent', color: on ? 'var(--c-text)' : 'var(--c-nav)', fontSize: 14.5, fontWeight: on ? 700 : 600, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', transition: 'background .15s', textDecoration: 'none' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 99, background: c.accent, flexShrink: 0, opacity: on ? 1 : 0.7 }} />
              {c.tab}
            </a>
          )
        })}
      </div>
    </div>
  )
}

export default function Navbar() {
  const { theme, toggleTheme, product, goProduct, openPricing, openSupport, openAuth, user, goProfile, lang, setLang } = useApp()
  const mobile = useMatch('(max-width: 860px)')
  const [open, setOpen] = useState(false)
  useEffect(() => { if (!mobile) setOpen(false) }, [mobile])
  const products = getProducts(lang)

  const authButtons = user ? (
    <a
      href={profileHref('home')}
      onClick={(e) => { e.preventDefault(); goProfile('home'); setOpen(false) }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px 8px 8px', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-panel)', color: 'var(--c-text)', fontSize: 14, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
    >
      <span style={{ width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 12, fontWeight: 700 }}>
        {(user.name || 'U').slice(0, 1).toUpperCase()}
      </span>
      {t(lang, 'profile')}
    </a>
  ) : (
    <>
      <a href={authHref('signin')} onClick={(e) => { e.preventDefault(); openAuth('signin'); setOpen(false) }} style={{ padding: '9px 16px', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-panel)', color: 'var(--c-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>{t(lang, 'login')}</a>
      <a href={authHref('signup')} onClick={(e) => { e.preventDefault(); openAuth('signup'); setOpen(false) }} style={{ padding: '10px 18px', borderRadius: 999, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 12px 22px -10px rgba(26,36,64,0.7),inset 0 1px 0 rgba(255,255,255,0.14)', textDecoration: 'none' }}>{t(lang, 'getStarted')}</a>
    </>
  )

  if (mobile) {
    return (
      <nav style={{ ...navStyle, position: 'sticky' }}>
        <Brand onClick={() => { goProduct('ppt'); setOpen(false) }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={toggleTheme} aria-label={t(lang, 'toggleTheme')} style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer' }}>
            <ThemeIcon theme={theme} />
          </button>
          <button onClick={() => setOpen((o) => !o)} aria-label={t(lang, 'menu')} style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer' }}>
            {open
              ? <Icon name="x" opts={{ stroke: 'currentColor', sw: 2.2, size: 18 }} />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></svg>}
          </button>
        </div>

        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 10, padding: 12, borderRadius: 22, background: 'var(--c-panel-strong)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', border: '1px solid var(--c-border)', boxShadow: '0 26px 50px -24px rgba(31,42,68,0.5),inset 0 1px 0 rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', gap: 4, opacity: open ? 1 : 0, visibility: open ? 'visible' : 'hidden', transform: open ? 'none' : 'translateY(-8px)', transition: 'opacity .2s ease, transform .2s ease, visibility .2s' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-3)', padding: '6px 10px 2px' }}>{t(lang, 'products')}</div>
          {PRODUCT_IDS.map((id) => {
            const on = id === product
            const c = products[id]
            return (
              <a key={id} href={productHref(id)} onClick={(e) => { e.preventDefault(); goProduct(id); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12, border: 'none', background: on ? 'var(--c-chip)' : 'transparent', color: on ? 'var(--c-text)' : 'var(--c-nav)', fontSize: 15, fontWeight: 600, cursor: 'pointer', textAlign: 'left', textDecoration: 'none' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: c.accent }} />{c.tab}
              </a>
            )
          })}
          <a href={pageHref('pricing')} onClick={(e) => { e.preventDefault(); openPricing(); setOpen(false) }} style={{ padding: '11px 12px', borderRadius: 12, color: 'var(--c-nav)', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>{t(lang, 'pricing')}</a>
          <a href={pageHref('support')} onClick={(e) => { e.preventDefault(); openSupport(); setOpen(false) }} style={{ padding: '11px 12px', borderRadius: 12, color: 'var(--c-nav)', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>{t(lang, 'supportNav')}</a>
          <div style={{ height: 1, background: 'var(--c-border)', margin: '6px 4px' }} />
          <div style={{ display: 'flex', gap: 8, padding: '2px 4px 4px', flexWrap: 'wrap' }}>
            {user ? (
              <a href={profileHref('home')} onClick={(e) => { e.preventDefault(); goProfile('home'); setOpen(false) }} style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>{t(lang, 'profile')}</a>
            ) : (
              <>
                <a href={authHref('signin')} onClick={(e) => { e.preventDefault(); openAuth('signin'); setOpen(false) }} style={{ flex: 1, padding: '11px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-panel)', color: 'var(--c-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>{t(lang, 'login')}</a>
                <a href={authHref('signup')} onClick={(e) => { e.preventDefault(); openAuth('signup'); setOpen(false) }} style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>{t(lang, 'getStarted')}</a>
              </>
            )}
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="topnav" style={navStyle}>
      <Brand onClick={() => goProduct('ppt')} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'nowrap', justifyContent: 'center' }}>
        <ProductsMenu />
        <a href={pageHref('pricing')} onClick={(e) => { e.preventDefault(); openPricing() }} style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--c-nav)', cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none' }}>{t(lang, 'pricing')}</a>
        <a href={pageHref('support')} onClick={(e) => { e.preventDefault(); openSupport() }} style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--c-nav)', whiteSpace: 'nowrap', textDecoration: 'none' }}>{t(lang, 'supportNav')}</a>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <button onClick={toggleTheme} aria-label={t(lang, 'toggleTheme')} style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer' }}>
          <ThemeIcon theme={theme} />
        </button>
        <button
          className="navlang"
          onClick={() => setLang(lang === 'en' ? 'uz' : lang === 'uz' ? 'ru' : 'en')}
          title={t(lang, 'languageLabel')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-panel)', color: 'var(--c-nav)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18" /></svg>
          {lang.toUpperCase()}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {authButtons}
      </div>
    </nav>
  )
}
