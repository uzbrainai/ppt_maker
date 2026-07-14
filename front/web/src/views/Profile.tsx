import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context'
import { typeMeta } from '../data/products'
import { Brand, IconButton, Overlay, PrimaryButton } from '../components/ui'
import { Icon } from '../lib/icons'
import { useIsMobile } from '../lib/useMedia'
import { profileHref, type ProfilePage } from '../lib/routes'
import { t, type Lang } from '../lib/i18n'
import { availablePlans, buildSubscriptionView } from '../lib/subscriptions'
import { checkoutCredits, fetchPublicPlans, type PublicPlan } from '../lib/api'
import CreateDeckPanel from '../components/CreateModal'
import { ProfileDeckPage } from './Editor'
import type { DocItem } from '../types'
import type { GenJob } from '../lib/genJobs'

const NAV: { page: Exclude<ProfilePage, 'deck' | 'create'>; icon: string; labelKey: string }[] = [
  { page: 'home',         icon: 'sparkle', labelKey: 'presentations' },
  { page: 'courseworks',  icon: 'grad',    labelKey: 'courseworks' },
  { page: 'independents', icon: 'book',    labelKey: 'independents' },
  { page: 'subscribed',   icon: 'check',   labelKey: 'subscribed' },
  { page: 'plans',        icon: 'list',    labelKey: 'plans' },
  { page: 'support',      icon: 'pen',     labelKey: 'support' },
]

function DocPreview({ item, lang }: { item: DocItem; lang: Lang }) {
  const tm = typeMeta(item.type, lang)
  if (item.cover) {
    return (
      <div style={{ height: 120, borderRadius: 14, overflow: 'hidden', background: '#fff', border: '1px solid var(--c-border)' }}>
        <img src={`data:image/svg+xml,${encodeURIComponent(item.cover)}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </div>
    )
  }
  return (
    <div style={{ height: 120, borderRadius: 14, background: `linear-gradient(135deg, ${tm.accent}, #ff9f7a)`, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 6 }}>
      <div style={{ height: 9, width: '60%', borderRadius: 99, background: 'rgba(255,255,255,0.9)' }} />
      <div style={{ height: 6, width: '40%', borderRadius: 99, background: 'rgba(255,255,255,0.6)' }} />
    </div>
  )
}

function jobToDoc(job: GenJob, lang: Lang): DocItem {
  const busy = job.status === 'queued' || job.status === 'generating'
  return {
    id: job.id,
    type: job.product === 'ppt' ? 'ppt' : job.product,
    title: job.title,
    category: t(lang, 'aiGenerated'),
    tags: [job.tier === 'premium' ? 'premium' : 'general'],
    updated: busy ? (job.label || '…') : job.status === 'error' ? t(lang, 'failed') : t(lang, 'justNow'),
    pageCount: job.pageCount,
    cover: job.cover,
    deckId: job.deckId,
    status: job.status === 'queued' ? 'queued' : job.status === 'generating' ? 'generating' : job.status === 'error' ? 'error' : 'ready',
    progressLabel: job.label,
    progressStage: job.stage,
    isJob: true,
  }
}

function statusStyle(status: DocItem['status']): { bg: string; fg: string; labelKey: string } {
  switch (status) {
    case 'queued': return { bg: 'rgba(59,130,246,0.14)', fg: '#3b82f6', labelKey: 'statusQueued' }
    case 'generating': return { bg: 'rgba(250,204,21,0.14)', fg: '#ca8a04', labelKey: 'statusGenerating' }
    case 'error': return { bg: 'rgba(239,68,68,0.14)', fg: '#ef4444', labelKey: 'statusError' }
    default: return { bg: 'rgba(34,197,94,0.14)', fg: '#22c55e', labelKey: 'statusReady' }
  }
}

/** Shared list page used by Presentations / Course works / Independent works. */
function DocListPage({ productType, titleKey, subKey, emptyTitleKey, emptySubKey, unitKey, newLabelKey, createLabelKey }: {
  productType: 'ppt' | 'kurs' | 'mustaqil'
  titleKey: string
  subKey: string
  emptyTitleKey: string
  emptySubKey: string
  /** i18n key for the per-item count unit ("slides", "pages"). */
  unitKey: string
  /** Label for the top "new" button ("New presentation", "New course work", ...). */
  newLabelKey: string
  /** Label for the empty-state CTA ("Create presentation", "Create course work", ...). */
  createLabelKey: string
}) {
  const { items, genJobs, openDoc, openCreateFor, lang } = useApp()
  // Include only jobs and materials matching this product's type.
  const jobDocs = genJobs.filter((j) => j.product === productType).map((j) => jobToDoc(j, lang))
  const ready = items.filter((it) => it.type === productType).map((it) => ({ ...it, status: it.status || 'ready' as const }))
  const decks = [...jobDocs, ...ready]
  const startCreate = () => openCreateFor(productType)

  return (
    <div>
      <h1 style={{ fontSize: 'clamp(24px,3.5vw,34px)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'var(--c-text)' }}>{t(lang, titleKey)}</h1>
      <p style={{ fontSize: 15, color: 'var(--c-text-2)', margin: '0 0 22px', fontWeight: 500 }}>{t(lang, subKey)}</p>
      <div style={{ marginBottom: 20 }}>
        <PrimaryButton label={t(lang, newLabelKey)} icon="plus" onClick={startCreate} />
      </div>
      {decks.length ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 18 }}>
          {decks.map((it) => {
            const n = it.pageCount ?? it.slides?.length ?? 0
            const st = statusStyle(it.status)
            const busy = it.status === 'queued' || it.status === 'generating'
            return (
              <div key={it.id} onClick={() => openDoc(it.id)} style={{ borderRadius: 22, padding: 14, background: 'var(--c-panel)', border: '1px solid var(--c-border)', boxShadow: '0 22px 44px -30px rgba(31,42,68,0.4)', cursor: 'pointer' }}>
                <DocPreview item={it} lang={lang} />
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--c-text)', margin: '12px 0 6px', lineHeight: 1.3 }}>{it.title}</div>
                {busy && it.progressLabel && (
                  <div style={{ fontSize: 12, color: 'var(--c-text-2)', fontWeight: 500, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {it.progressLabel}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--c-text-3)', fontWeight: 500 }}>
                    {busy ? t(lang, 'inQueue') : `${n} ${t(lang, unitKey)}`} · {it.updated}
                  </span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                    background: st.bg, color: st.fg,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: 99, background: 'currentColor',
                      animation: busy ? 'pulseDot 1.3s infinite' : 'none',
                    }} />
                    {t(lang, st.labelKey)}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--c-text-2)' }}>
                  {busy ? t(lang, 'viewProgress') : t(lang, 'open')} →
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ padding: '56px 24px', textAlign: 'center', borderRadius: 22, border: '1px dashed var(--c-border)', background: 'var(--c-chip)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)', marginBottom: 8 }}>{t(lang, emptyTitleKey)}</div>
          <p style={{ fontSize: 14.5, color: 'var(--c-text-2)', margin: '0 0 18px', fontWeight: 500, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}>{t(lang, emptySubKey)}</p>
          <PrimaryButton label={t(lang, createLabelKey)} icon="plus" onClick={startCreate} />
        </div>
      )}
    </div>
  )
}

function PresentationsPage() {
  return <DocListPage productType="ppt" titleKey="presentations" subKey="presentationsSub"
    emptyTitleKey="emptyTitle" emptySubKey="emptySub" unitKey="slides"
    newLabelKey="newDoc" createLabelKey="createNew" />
}

function CourseworksPage() {
  return <DocListPage productType="kurs" titleKey="courseworks" subKey="courseworksSub"
    emptyTitleKey="courseworksEmptyTitle" emptySubKey="courseworksEmptySub" unitKey="pages"
    newLabelKey="newCoursework" createLabelKey="createCoursework" />
}

function IndependentsPage() {
  return <DocListPage productType="mustaqil" titleKey="independents" subKey="independentsSub"
    emptyTitleKey="independentsEmptyTitle" emptySubKey="independentsEmptySub" unitKey="pages"
    newLabelKey="newIndependent" createLabelKey="createIndependent" />
}

function SubscribedPage() {
  const { user, credits, lang, refreshAccount } = useApp()
  const paid = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('paid') === '1'
  useEffect(() => {
    if (paid) void refreshAccount()
  }, [paid, refreshAccount])
  const { active, history } = buildSubscriptionView(user?.plan, credits?.period, lang)
  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--c-border)' }}>
      <span style={{ fontSize: 13.5, color: 'var(--c-text-3)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13.5, color: 'var(--c-text)', fontWeight: 700 }}>{value}</span>
    </div>
  )
  return (
    <div>
      <h1 style={{ fontSize: 'clamp(24px,3.5vw,34px)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'var(--c-text)' }}>{t(lang, 'subscribed')}</h1>
      <p style={{ fontSize: 15, color: 'var(--c-text-2)', margin: '0 0 22px', fontWeight: 500 }}>{t(lang, 'subscribedSub')}</p>
      {paid ? (
        <div style={{ borderRadius: 14, padding: '12px 16px', marginBottom: 18, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', color: '#16a34a', fontSize: 14, fontWeight: 600, maxWidth: 520 }}>
          {t(lang, 'paymentReceived')}
        </div>
      ) : null}

      <div style={{ borderRadius: 22, padding: 22, background: 'var(--c-panel)', border: '1px solid var(--c-border)', marginBottom: 22, maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--c-text-3)' }}>{t(lang, 'activePlan')}</div>
          <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: 12, fontWeight: 700 }}>{t(lang, 'statusActive')}</span>
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--c-text)', marginBottom: 4 }}>{active.name}</div>
        <div style={{ fontSize: 14, color: 'var(--c-text-2)', fontWeight: 600, marginBottom: 14 }}>{active.priceLabel}</div>
        {row(t(lang, 'activated'), active.activatedAt)}
        {row(t(lang, 'validUntil'), active.expiresAt)}
        {credits && row(t(lang, 'credits'), credits.unlimited ? '∞' : `${credits.balance} / ${credits.monthlyAllowance}`)}
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 12px' }}>{t(lang, 'history')}</h2>
      {history.length ? history.map((h) => (
        <div key={h.id} style={{ borderRadius: 16, padding: '14px 16px', background: 'var(--c-chip)', border: '1px solid var(--c-border)', marginBottom: 10, maxWidth: 520 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 700, color: 'var(--c-text)' }}>{h.name}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-3)' }}>{t(lang, 'statusExpired')}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-text-2)', fontWeight: 500 }}>
            {h.activatedAt} → {h.expiresAt} · {h.priceLabel}
          </div>
        </div>
      )) : (
        <p style={{ color: 'var(--c-text-3)', fontWeight: 500 }}>{t(lang, 'noHistory')}</p>
      )}
    </div>
  )
}

function formatUzs(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + " so'm"
}

function DynamicPlanCard({ plan, on, busy, onBuy, lang, billing }: {
  plan: PublicPlan; on: boolean; busy: boolean; onBuy: () => void; lang: Lang; billing: 'monthly' | 'yearly'
}) {
  const isFree = plan.priceUzs <= 0
  const isYearly = billing === 'yearly' && plan.kind === 'subscription' && plan.yearlyDiscountPct > 0 && !isFree
  const yearlyPrice = isYearly ? Math.round(plan.priceUzs * 12 * (1 - plan.yearlyDiscountPct / 100)) : 0
  const monthEquiv = isYearly ? Math.round(yearlyPrice / 12) : 0

  const priceDisplay = isFree
    ? t(lang, 'free')
    : isYearly
      ? formatUzs(yearlyPrice)
      : formatUzs(plan.priceUzs)
  const priceSuffix = isFree
    ? ''
    : plan.kind === 'token'
      ? ' · ' + t(lang, 'oneOff')
      : isYearly ? t(lang, 'perYear') : t(lang, 'perMonth')

  return (
    <div style={{
      borderRadius: 22, padding: 22,
      background: plan.isPopular ? 'var(--c-panel-strong)' : 'var(--c-panel)',
      border: on ? '2px solid #a07cff' : '1px solid var(--c-border)',
      display: 'flex', flexDirection: 'column',
      boxShadow: plan.isPopular ? '0 20px 44px -22px rgba(160,124,255,0.4)' : undefined,
      position: 'relative',
    }}>
      {plan.isPopular ? (
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: '#a07cff', marginBottom: 8 }}>
          {t(lang, 'popular')}
        </div>
      ) : null}
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-2)' }}>{plan.name}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--c-text)', margin: '10px 0 4px', letterSpacing: '-0.02em' }}>
        {priceDisplay}
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-3)' }}>{priceSuffix}</span>
      </div>
      {isYearly && (
        <div style={{ fontSize: 12, color: 'var(--c-text-3)', fontWeight: 600, marginBottom: 4 }}>
          {t(lang, 'monthEquivalent', { amount: formatUzs(monthEquiv) })}
        </div>
      )}
      {plan.kind === 'subscription' && plan.yearlyDiscountPct > 0 && !isFree && (
        <div style={{
          alignSelf: 'flex-start',
          display: 'inline-block',
          padding: '3px 9px', borderRadius: 999,
          background: 'rgba(205,240,63,0.15)',
          border: '1px solid rgba(205,240,63,0.3)',
          color: '#9fbf2a',
          fontSize: 11, fontWeight: 700,
          marginBottom: 8,
        }}>
          {t(lang, 'saveWithYearly', { pct: plan.yearlyDiscountPct })}
        </div>
      )}
      <div style={{ fontSize: 13, color: 'var(--c-text-3)', fontWeight: 600, marginBottom: 10 }}>
        {isYearly ? plan.credits * 12 : plan.credits} {t(lang, 'creditsSuffix')}
      </div>
      {plan.blurb ? (
        <p style={{ fontSize: 13.5, color: 'var(--c-text-2)', margin: '0 0 14px', fontWeight: 500 }}>{plan.blurb}</p>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18, flex: 1 }}>
        {plan.features.map((f) => (
          <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--c-text-2)', fontWeight: 500 }}>
            <Icon name="check" opts={{ stroke: '#a07cff', sw: 2.4, size: 15 }} />{f}
          </div>
        ))}
      </div>
      <button
        onClick={onBuy}
        disabled={isFree || on || busy}
        style={{
          padding: 12, borderRadius: 12,
          border: on || isFree ? '1px solid var(--c-border)' : 'none',
          background: !isFree && !on ? 'var(--c-btn-bg)' : 'var(--c-chip)',
          color: !isFree && !on ? 'var(--c-btn-fg)' : 'var(--c-text-3)',
          fontSize: 14, fontWeight: 700,
          cursor: !isFree && !on && !busy ? 'pointer' : 'default',
        }}
      >
        {on ? t(lang, 'statusActive') : busy ? '…' : plan.kind === 'token' ? t(lang, 'buyPack') : t(lang, 'payWithClick')}
      </button>
    </div>
  )
}

function PlansPage() {
  const { lang, user, refreshAccount } = useApp()
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [tab, setTab] = useState<'subscription' | 'token'>('subscription')
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [loading, setLoading] = useState(true)
  const current = (user?.plan || 'free').toLowerCase()

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchPublicPlans()
      .then((p) => { if (alive) setPlans(p) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const pay = async (slug: string, isYearly: boolean) => {
    setBusy(slug); setNote(null)
    try {
      const r = await checkoutCredits(undefined, undefined, slug, isYearly ? 'yearly' : 'monthly')
      if (r.ok && r.payUrl) {
        setNote(t(lang, 'redirectingClick'))
        window.location.href = r.payUrl
        return
      }
      setNote(r.message || t(lang, 'couldNotStartPayment'))
    } catch {
      setNote(t(lang, 'couldNotStartPaymentRetry'))
    } finally {
      setBusy(null)
      void refreshAccount()
    }
  }

  const subs = plans.filter((p) => p.kind === 'subscription')
  const tokens = plans.filter((p) => p.kind === 'token')

  // Fallback: if backend returned nothing, use the static bundled plans.
  const useFallback = !loading && plans.length === 0

  const tabBtnStyle = (on: boolean): React.CSSProperties => ({
    padding: '10px 18px', borderRadius: 12, border: 'none',
    background: on ? 'var(--c-btn-bg)' : 'transparent',
    color: on ? 'var(--c-btn-fg)' : 'var(--c-text-2)',
    fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
  })

  return (
    <div>
      <h1 style={{ fontSize: 'clamp(24px,3.5vw,34px)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'var(--c-text)' }}>{t(lang, 'plans')}</h1>
      <p style={{ fontSize: 15, color: 'var(--c-text-2)', margin: '0 0 22px', fontWeight: 500 }}>{t(lang, 'plansSub')}</p>

      {!useFallback && (
        <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 14, background: 'var(--c-chip)', border: '1px solid var(--c-border)', marginBottom: 18 }}>
          <button style={tabBtnStyle(tab === 'subscription')} onClick={() => setTab('subscription')}>{t(lang, 'subscriptionsTab')}</button>
          <button style={tabBtnStyle(tab === 'token')} onClick={() => setTab('token')}>{t(lang, 'tokensTab')}</button>
        </div>
      )}

      {useFallback ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {availablePlans(lang).map((p) => {
            const on = current === p.id || (p.id === 'starter' && (current === 'free' || !user?.plan))
            const canPay = !!p.pack && !on
            return (
              <div key={p.id} style={{ borderRadius: 22, padding: 22, background: p.popular ? 'var(--c-panel-strong)' : 'var(--c-panel)', border: on ? '2px solid #a07cff' : '1px solid var(--c-border)', display: 'flex', flexDirection: 'column' }}>
                {p.popular ? <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', color: '#a07cff', marginBottom: 8 }}>{t(lang, 'popular')}</div> : null}
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-2)' }}>{p.name}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--c-text)', margin: '10px 0 4px' }}>
                  {p.price}
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-3)' }}> {p.priceSuffix}/mo</span>
                </div>
                <p style={{ fontSize: 13.5, color: 'var(--c-text-2)', margin: '0 0 16px', fontWeight: 500 }}>{p.blurb}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18, flex: 1 }}>
                  {p.feats.map((f) => (
                    <div key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--c-text-2)', fontWeight: 500 }}>
                      <Icon name="check" opts={{ stroke: '#a07cff', sw: 2.4, size: 15 }} />{f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { if (p.pack) void pay(p.pack, false) }}
                  disabled={!canPay || busy === p.pack}
                  style={{ padding: 12, borderRadius: 12, border: on || !canPay ? '1px solid var(--c-border)' : 'none', background: canPay ? 'var(--c-btn-bg)' : 'var(--c-chip)', color: canPay ? 'var(--c-btn-fg)' : 'var(--c-text-3)', fontSize: 14, fontWeight: 700, cursor: canPay ? 'pointer' : 'default' }}
                >
                  {on ? t(lang, 'statusActive') : busy === p.pack ? '…' : p.pack ? t(lang, 'payWithClick') : t(lang, 'statusActive')}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {tab === 'subscription' && (
            <>
              {subs.some((p) => p.yearlyDiscountPct > 0) && (
                <div style={{ display: 'inline-flex', gap: 4, padding: 4, borderRadius: 999, background: 'var(--c-chip)', border: '1px solid var(--c-border)', marginBottom: 18 }}>
                  {(['monthly', 'yearly'] as const).map((b) => {
                    const on = billing === b
                    const maxDiscount = Math.max(0, ...subs.map((p) => p.yearlyDiscountPct))
                    return (
                      <button key={b} onClick={() => setBilling(b)} style={{
                        padding: '9px 18px', borderRadius: 999, border: 'none',
                        background: on ? 'var(--c-btn-bg)' : 'transparent',
                        color: on ? 'var(--c-btn-fg)' : 'var(--c-text-2)',
                        fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}>
                        {t(lang, b === 'monthly' ? 'monthlyBilling' : 'yearlyBilling')}
                        {b === 'yearly' && maxDiscount > 0 && (
                          <span style={{
                            fontSize: 10, fontWeight: 800, letterSpacing: '0.02em',
                            padding: '2px 6px', borderRadius: 999,
                            background: on ? 'rgba(205,240,63,0.25)' : 'rgba(205,240,63,0.15)',
                            color: '#aacb2e',
                          }}>−{maxDiscount}%</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
                {subs.map((p) => {
                  const on = current === p.slug || (p.slug === 'starter' && (current === 'free' || !user?.plan))
                  return (
                    <DynamicPlanCard
                      key={p.id}
                      plan={p}
                      on={on}
                      busy={busy === p.slug}
                      onBuy={() => void pay(p.slug, billing === 'yearly')}
                      lang={lang}
                      billing={billing}
                    />
                  )
                })}
              </div>
            </>
          )}

          {tab === 'token' && (
            <>
              <p style={{ fontSize: 14, color: 'var(--c-text-3)', margin: '0 0 16px', fontWeight: 500 }}>{t(lang, 'tokenPacksSub')}</p>
              {tokens.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
                  {tokens.map((p) => (
                    <DynamicPlanCard
                      key={p.id}
                      plan={p}
                      on={false}
                      busy={busy === p.slug}
                      onBuy={() => void pay(p.slug, false)}
                      lang={lang}
                      billing="monthly"
                    />
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--c-text-3)', fontWeight: 500 }}>{t(lang, 'noPacksAvailable')}</p>
              )}
            </>
          )}
        </>
      )}

      {note ? <p style={{ marginTop: 16, fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-2)' }}>{note}</p> : null}
    </div>
  )
}

function SupportChatPage() {
  const { lang, user } = useApp()
  const [text, setText] = useState('')
  const [msgs, setMsgs] = useState<{ from: 'me' | 'bot'; body: string }[]>([
    { from: 'bot', body: t(lang, 'supportHint') },
  ])
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  const send = () => {
    const body = text.trim()
    if (!body) return
    setText('')
    setMsgs((m) => [
      ...m,
      { from: 'me', body },
      { from: 'bot', body: t(lang, 'thanksMessage', { name: user?.name ? `, ${user.name}` : '', email: user?.email || t(lang, 'emailAddress') }) },
    ])
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'min(640px, calc(100vh - 160px))' }}>
      <h1 style={{ fontSize: 'clamp(24px,3.5vw,34px)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px', color: 'var(--c-text)' }}>{t(lang, 'support')}</h1>
      <p style={{ fontSize: 15, color: 'var(--c-text-2)', margin: '0 0 18px', fontWeight: 500 }}>{t(lang, 'supportSub')}</p>
      <div style={{ flex: 1, overflowY: 'auto', borderRadius: 18, border: '1px solid var(--c-border)', background: 'var(--c-panel)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: '10px 14px', borderRadius: 14, background: m.from === 'me' ? 'var(--c-btn-bg)' : 'var(--c-chip)', color: m.from === 'me' ? 'var(--c-btn-fg)' : 'var(--c-text)', fontSize: 14, fontWeight: 500, lineHeight: 1.45 }}>
            {m.body}
          </div>
        ))}
        <div ref={end} />
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          placeholder={t(lang, 'supportHint')}
          style={{ flex: 1, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-input)', color: 'var(--c-text)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }}
        />
        <button onClick={send} style={{ padding: '12px 18px', borderRadius: 12, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t(lang, 'send')}</button>
      </div>
    </div>
  )
}

export default function Profile() {
  const {
    view, profilePage, goProfile, user, credits, isAdmin, openAdmin,
    signOut, theme, toggleTheme, lang, setLang, gotoLanding, editId,
  } = useApp()
  const initial = ((user && user.name) || 'U').slice(0, 1).toUpperCase()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Close the sidebar automatically after picking a nav item on mobile.
  const goProfileMobile = (p: Exclude<ProfilePage, 'deck' | 'create'>) => {
    goProfile(p)
    if (isMobile) setSidebarOpen(false)
  }

  const body = (() => {
    switch (profilePage) {
      case 'create': return <CreateDeckPanel embedded />
      case 'deck': return editId ? <ProfileDeckPage docId={editId} /> : <PresentationsPage />
      case 'courseworks': return <CourseworksPage />
      case 'independents': return <IndependentsPage />
      case 'subscribed': return <SubscribedPage />
      case 'plans': return <PlansPage />
      case 'support': return <SupportChatPage />
      default: return <PresentationsPage />
    }
  })()

  return (
    <Overlay open={view === 'profile'} solid>
      <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>
        {/* Mobile backdrop when the off-canvas sidebar is open */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,13,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 40 }}
          />
        )}
        {/* Sidebar — pinned to the left on desktop, off-canvas drawer on mobile */}
        <aside style={{
          position: isMobile ? 'fixed' : 'sticky',
          top: 0, left: 0, alignSelf: 'flex-start',
          width: isMobile ? 'min(84vw, 300px)' : 260,
          flexShrink: 0, height: '100vh',
          padding: '20px 14px', borderRight: '1px solid var(--c-border)',
          display: 'flex', flexDirection: 'column', gap: 4,
          background: 'var(--c-panel)', boxSizing: 'border-box',
          overflowY: 'auto',
          zIndex: isMobile ? 50 : 'auto',
          transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-105%)') : 'none',
          transition: 'transform .28s ease',
          boxShadow: isMobile && sidebarOpen ? '0 20px 60px -10px rgba(0,0,0,0.6)' : 'none',
        }}>
          <div style={{ padding: '6px 8px 18px' }}>
            <Brand onClick={gotoLanding} />
          </div>
          {NAV.map((n) => {
            const on = profilePage === n.page || (n.page === 'home' && (profilePage === 'create' || profilePage === 'deck'))
            return (
              <a
                key={n.page}
                href={profileHref(n.page)}
                onClick={(e) => { e.preventDefault(); goProfileMobile(n.page) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 12,
                  background: on ? 'var(--c-chip)' : 'transparent', color: on ? 'var(--c-text)' : 'var(--c-text-2)',
                  fontSize: 14, fontWeight: on ? 700 : 600, textDecoration: 'none',
                }}
              >
                <Icon name={n.icon} opts={{ stroke: 'currentColor', sw: 2, size: 17 }} />
                {t(lang, n.labelKey)}
              </a>
            )
          })}

          <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-3)', padding: '0 8px' }}>{t(lang, 'theme')}</div>
            <div style={{ display: 'flex', gap: 6, padding: '0 4px' }}>
              {(['dark', 'light'] as const).map((th) => (
                <button
                  key={th}
                  onClick={() => { if (theme !== th) toggleTheme() }}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid var(--c-border)', background: theme === th ? 'var(--c-btn-bg)' : 'var(--c-chip)', color: theme === th ? 'var(--c-btn-fg)' : 'var(--c-text-2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  {t(lang, th)}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-3)', padding: '0 8px' }}>{t(lang, 'language')}</div>
            <div style={{ display: 'flex', gap: 6, padding: '0 4px' }}>
              {(['en', 'uz', 'ru'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid var(--c-border)', background: lang === l ? 'var(--c-btn-bg)' : 'var(--c-chip)', color: lang === l ? 'var(--c-btn-fg)' : 'var(--c-text-2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}
                >
                  {l}
                </button>
              ))}
            </div>
            <button onClick={signOut} style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 12, border: 'none', background: 'transparent', color: 'var(--c-text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
              <Icon name="logout" opts={{ stroke: 'currentColor', sw: 2, size: 16 }} />{t(lang, 'signOut')}
            </button>
          </div>
        </aside>

        {/* Main — fills the rest of the screen; scrolls internally so no scrollbar
            appears on the overlay itself. Deck editor is edge-to-edge and fixed-height. */}
        <main style={{
          flex: 1, minWidth: 0, width: '100%',
          height: isMobile ? '100dvh' : '100vh',
          maxHeight: isMobile ? '100dvh' : '100vh',
          overflowY: profilePage === 'deck' ? 'hidden' : 'auto',
          boxSizing: 'border-box',
          padding: profilePage === 'deck' ? 0 : (isMobile ? '16px 14px 60px' : '20px 32px 60px'),
          display: profilePage === 'deck' ? 'flex' : 'block',
          flexDirection: 'column',
        }}>
          {profilePage !== 'deck' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            {/* Mobile-only menu button (opens the off-canvas sidebar) */}
            {isMobile ? (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Menu"
                style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer' }}
              >
                <Icon name="menu" opts={{ stroke: 'currentColor', sw: 2, size: 18 }} />
              </button>
            ) : <span />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginLeft: 'auto' }}>
            {credits && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 13px', borderRadius: 999, background: 'var(--c-chip)', border: '1px solid var(--c-border)', fontSize: 13, fontWeight: 700, color: 'var(--c-text-2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: credits.unlimited ? '#a855f7' : (credits.balance <= 0 ? '#ef4444' : '#22c55e') }} />
                {credits.unlimited ? `∞ ${t(lang, 'credits')}` : `${credits.balance} / ${credits.monthlyAllowance} ${t(lang, 'credits')}`}
              </span>
            )}
            {isAdmin && (
              <button onClick={openAdmin} style={{ padding: '7px 14px', borderRadius: 999, background: 'var(--c-chip)', border: '1px solid #7c5cff', color: '#7c5cff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t(lang, 'admin')}</button>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 6px', borderRadius: 999, background: 'var(--c-chip)', border: '1px solid var(--c-border)' }}>
              <span style={{ width: 28, height: 28, borderRadius: 999, display: 'grid', placeItems: 'center', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 12, fontWeight: 700 }}>{initial}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text)' }}>{(user && user.name) || t(lang, 'user')}</span>
            </span>
            <IconButton name="x" label={t(lang, 'home')} onClick={gotoLanding} />
            </div>
          </div>
          )}
          <div style={profilePage === 'deck'
            ? { flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', height: isMobile ? 'calc(100dvh)' : 'calc(100vh)' }
            : undefined}>
            {body}
          </div>
        </main>
      </div>
    </Overlay>
  )
}
