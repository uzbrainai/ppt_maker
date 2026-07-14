import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useApp } from '../context'
import { getProducts, PRODUCT_IDS } from '../data/products'
import { Icon } from '../lib/icons'
import { t } from '../lib/i18n'
import type { ProductId, Tier } from '../types'
import {
  DEFAULT_DECK_OPTIONS,
  THEME_OPTIONS,
  APPEARANCE_OPTIONS,
  PAGE_OPTIONS,
  LANGUAGE_OPTIONS,
  RESEARCH_OPTIONS,
  IMAGE_PCT_OPTIONS,
  IMAGE_QUALITY_OPTIONS,
  slidewindEnabled,
  type DeckOptions,
} from '../lib/slidewind'

function Select({ label, value, onChange, children }: {
  label: string
  value: string | number
  onChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 150px', minWidth: 130 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-panel-2)', color: 'var(--c-text)', fontSize: 13.5, fontWeight: 500, outline: 'none', cursor: 'pointer', fontFamily: 'inherit', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' }}
        className="sw-select"
      >
        {children}
      </select>
    </label>
  )
}

export default function CreateDeckPanel({ embedded = false }: { embedded?: boolean }) {
  const {
    closeCreate, product: appProduct, tier: appTier, enqueueGenerate,
    user, credits, openAuth, openPricing, goProfile, createOpen, lang, createLock,
  } = useApp()
  const products = getProducts(lang)
  // If a lock is set (opened from a specific product page), start on that product.
  const [product, setProduct] = useState<ProductId>(createLock ?? appProduct)
  const [tier, setTier] = useState<Tier>(appTier)
  const [prompt, setPrompt] = useState('')
  const [opts, setOpts] = useState<DeckOptions>(DEFAULT_DECK_OPTIONS)
  const [error, setError] = useState<string | null>(null)
  const cfg = products[product]
  const cost = product === 'ppt' ? opts.pages : 0
  const shortfall = !!credits && !credits.unlimited && cost > 0 && credits.balance < cost
  const set = (patch: Partial<DeckOptions>) => setOpts((o) => ({ ...o, ...patch }))
  const showOptions = product === 'ppt'

  const TIERS: { id: Tier; label: string; icon?: string }[] = [
    { id: 'general', label: t(lang, 'tierGeneral') },
    { id: 'premium', label: t(lang, 'tierPremium'), icon: 'sparkle' },
  ]

  const [openKey, setOpenKey] = useState(0)
  useEffect(() => {
    setOpenKey((k) => k + 1)
    setError(null)
    setPrompt('')
  }, [])
  const rv = (i: number): CSSProperties => ({ animation: 'revealUp .45s ease both', animationDelay: `${i * 0.06}s` })

  const backToList = () => {
    if (embedded) {
      // Return to the list page for the locked product; otherwise the general home.
      if (createLock === 'kurs') goProfile('courseworks')
      else if (createLock === 'mustaqil') goProfile('independents')
      else goProfile('home')
    } else {
      closeCreate()
    }
  }

  const onGenerate = () => {
    if (!user) { openAuth('signup'); return }
    if (!prompt.trim()) { setError(t(lang, 'errDescribeFirst')); return }
    if (shortfall) { setError(t(lang, 'errNoCredits')); return }
    setError(null)
    enqueueGenerate(product, prompt, tier, opts)
  }

  const panel = (
    <div style={{ position: 'relative', width: '100%', maxWidth: embedded ? 720 : 680, margin: embedded ? '0' : 'auto', borderRadius: embedded ? 22 : 26, padding: 28, background: 'var(--c-panel-strong)', border: '1px solid var(--c-border)', boxShadow: embedded ? 'none' : '0 50px 90px -40px rgba(0,0,0,0.6)' }}>
      {!embedded && (
        <button onClick={backToList} aria-label={t(lang, 'close')} style={{ position: 'absolute', top: 16, right: 16, width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer', zIndex: 2 }}>
          <Icon name="x" opts={{ stroke: 'currentColor', sw: 2, size: 18 }} />
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: embedded ? 28 : 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px', color: 'var(--c-text)' }}>
            {createLock ? cfg.tab : t(lang, 'createPresentation')}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--c-text-2)', margin: 0, fontWeight: 500 }}>
            {t(lang, 'createDescription')}
          </p>
        </div>
        {embedded && (
          <button onClick={backToList} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            {t(lang, 'backPresentations')}
          </button>
        )}
      </div>

      <div key={openKey} style={{ display: 'contents' }}>
        {/* Hide the product picker when the panel is locked to one product
            (opened from a per-product page). Show it only for the free-choice case. */}
        {!createLock && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, ...rv(1) }}>
            {PRODUCT_IDS.map((id) => {
              const on = id === product
              const c = products[id]
              return (
                <button key={id} onClick={() => setProduct(id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 15px', borderRadius: 999, border: '1px solid ' + (on ? 'transparent' : 'var(--c-border)'), background: on ? 'var(--c-btn-bg)' : 'var(--c-chip)', color: on ? 'var(--c-btn-fg)' : 'var(--c-text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: c.accent }} />{c.tab}
                </button>
              )
            })}
          </div>
        )}

        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={cfg.promptText} rows={3}
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 16, background: 'var(--c-input)', border: '1px solid var(--c-chip)', padding: 16, color: 'var(--c-text)', fontSize: 15, lineHeight: 1.5, fontWeight: 500, outline: 'none', resize: 'vertical', fontFamily: 'inherit', ...rv(2) }} />

        <div style={{ marginTop: 14, display: 'flex', gap: 6, padding: 4, borderRadius: 14, background: 'var(--c-chip)', border: '1px solid var(--c-border)', ...rv(3) }}>
          {TIERS.map((tr) => {
            const on = tr.id === tier
            return (
              <button key={tr.id} onClick={() => setTier(tr.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 14px', borderRadius: 11, border: '1px solid ' + (on ? 'transparent' : 'var(--c-border)'), background: on ? 'var(--c-btn-bg)' : 'transparent', color: on ? 'var(--c-btn-fg)' : 'var(--c-text-2)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                {tr.icon ? <Icon name={tr.icon} opts={{ stroke: 'currentColor', sw: 2, size: 15 }} /> : null}{tr.label}
              </button>
            )
          })}
        </div>

        {showOptions && (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 16, background: 'var(--c-chip)', border: '1px solid var(--c-border)', ...rv(4) }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t(lang, 'deckOptions')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
              <Select label={t(lang, 'optTheme')} value={opts.theme} onChange={(v) => set({ theme: v })}>
                {THEME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
              <Select label={t(lang, 'optAppearance')} value={opts.appearance} onChange={(v) => set({ appearance: v as DeckOptions['appearance'] })}>
                {APPEARANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === 'dark' ? t(lang, 'optDark') : t(lang, 'optLight')}</option>)}
              </Select>
              <Select label={t(lang, 'optSlides')} value={opts.pages} onChange={(v) => set({ pages: Number(v) })}>
                {PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} {t(lang, 'slidesUnit')}</option>)}
              </Select>
              <Select label={t(lang, 'optLanguage')} value={opts.lang} onChange={(v) => set({ lang: v })}>
                {LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === 'en' ? t(lang, 'langEnglish') : o.value === 'uz' ? t(lang, 'langUzbek') : o.value === 'ru' ? t(lang, 'langRussian') : o.label}</option>)}
              </Select>
              <Select label={t(lang, 'optResearch')} value={opts.research ? 'on' : 'off'} onChange={(v) => set({ research: v === 'on' })}>
                {RESEARCH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === 'on' ? t(lang, 'researchOn') : t(lang, 'researchOff')}</option>)}
              </Select>
              {tier === 'premium' && (
                <>
                  <Select label={t(lang, 'optIllustrated')} value={opts.imagePct} onChange={(v) => set({ imagePct: Number(v) })}>
                    {IMAGE_PCT_OPTIONS.map((n) => <option key={n} value={n}>{n}{t(lang, 'ofSlides')}</option>)}
                  </Select>
                  <Select label={t(lang, 'optImageQuality')} value={opts.imageQuality} onChange={(v) => set({ imageQuality: v as DeckOptions['imageQuality'] })}>
                    {IMAGE_QUALITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === 'low' ? t(lang, 'qualityLow') : o.value === 'medium' ? t(lang, 'qualityMedium') : t(lang, 'qualityHigh')}</option>)}
                  </Select>
                </>
              )}
            </div>
            {!slidewindEnabled() && (
              <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--c-text-3)', fontWeight: 500 }}>
                {t(lang, 'serviceNotConfigured')}
              </p>
            )}
          </div>
        )}

        {user && credits && cost > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 16, padding: '11px 14px', borderRadius: 13, background: shortfall ? 'rgba(239,68,68,0.10)' : 'var(--c-chip)', border: '1px solid ' + (shortfall ? 'rgba(239,68,68,0.4)' : 'var(--c-border)') }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: shortfall ? '#ef4444' : 'var(--c-text-2)' }}>
              {credits.unlimited
                ? `${cost} ${t(lang, 'credits')} · ∞`
                : t(lang, 'costsCredits', { cost, balance: credits.balance, allowance: credits.monthlyAllowance })}
            </span>
            {shortfall && (
              <button onClick={openPricing} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t(lang, 'buyCredits')}</button>
            )}
          </div>
        )}

        {error && <p style={{ margin: '16px 0 0', fontSize: 13, fontWeight: 600, color: '#f87171' }}>{error}</p>}
        {!user && (
          <p style={{ margin: '12px 0 0', fontSize: 12.5, color: 'var(--c-text-3)', fontWeight: 500 }}>{t(lang, 'needSignIn')}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22, ...rv(6) }}>
          <button onClick={backToList} style={{ padding: '12px 18px', borderRadius: 13, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{embedded ? t(lang, 'back') : t(lang, 'cancel')}</button>
          <button onClick={onGenerate} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 13, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 14px 24px -12px rgba(25,35,62,0.6)' }}>
            <Icon name="sparkle" opts={{ stroke: 'currentColor', sw: 2.1, size: 16 }} />{user ? t(lang, 'addToQueue') : t(lang, 'signInToGenerate')}
          </button>
        </div>
      </div>
    </div>
  )

  if (embedded) return panel
  if (!createOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 210, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto', background: 'rgba(6,8,13,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', margin: 'auto' }}>{panel}</div>
    </div>
  )
}

export const CreateModal = CreateDeckPanel
