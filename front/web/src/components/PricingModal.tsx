import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { Icon } from '../lib/icons'
import { t, type Lang } from '../lib/i18n'
import { checkoutCredits, fetchPublicPlans, type PublicPlan } from '../lib/api'

function formatUzs(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + " so'm"
}

/** Static fallback used only when the /plans endpoint is unavailable. */
function fallbackPlans(lang: Lang): PublicPlan[] {
  return [
    { id: -1, slug: 'starter', name: t(lang, 'planStarter'), kind: 'subscription',
      priceUzs: 0, credits: 20, monthlyAllowance: 20, blurb: t(lang, 'starterBlurb'),
      features: [t(lang, 'starterFeat1'), t(lang, 'starterFeat2'), t(lang, 'starterFeat3')],
      isActive: true, isPopular: false, sortOrder: 10, yearlyDiscountPct: 0 },
    { id: -2, slug: 'pro', name: t(lang, 'planPro'), kind: 'subscription',
      priceUzs: 229000, credits: 300, monthlyAllowance: 300, blurb: t(lang, 'proBlurb'),
      features: [t(lang, 'proFeat1'), t(lang, 'proFeat2'), t(lang, 'proFeat3'), t(lang, 'proFeat4')],
      isActive: true, isPopular: true, sortOrder: 20, yearlyDiscountPct: 0 },
    { id: -3, slug: 'team', name: t(lang, 'planTeam'), kind: 'subscription',
      priceUzs: 590000, credits: 1000, monthlyAllowance: 1000, blurb: t(lang, 'teamBlurb'),
      features: [t(lang, 'teamFeat1'), t(lang, 'teamFeat2'), t(lang, 'teamFeat3'), t(lang, 'teamFeat4')],
      isActive: true, isPopular: false, sortOrder: 30, yearlyDiscountPct: 0 },
  ]
}

function PlanCard({
  plan, onBuy, lang, billing, busy, authed,
}: {
  plan: PublicPlan
  onBuy: (plan: PublicPlan) => void
  lang: Lang
  billing: 'monthly' | 'yearly'
  busy: boolean
  authed: boolean
}) {
  const isFree = plan.priceUzs <= 0
  const isYearly = billing === 'yearly' && plan.kind === 'subscription' && plan.yearlyDiscountPct > 0 && !isFree
  const yearlyPrice = isYearly ? Math.round(plan.priceUzs * 12 * (1 - plan.yearlyDiscountPct / 100)) : 0
  const monthEquiv = isYearly ? Math.round(yearlyPrice / 12) : 0
  const priceDisplay = isFree ? t(lang, 'free') : isYearly ? formatUzs(yearlyPrice) : formatUzs(plan.priceUzs)
  const priceSuffix = isFree
    ? ''
    : plan.kind === 'token'
      ? ' · ' + t(lang, 'oneOff')
      : isYearly ? t(lang, 'perYear') : t(lang, 'perMonth')

  const gradient = plan.isPopular
    ? 'linear-gradient(140deg,#5b9bff,#a07cff 45%,#f07fc0 75%,#ff9f7a)'
    : undefined

  const card = (
    <div style={{
      borderRadius: 28, padding: 30,
      background: plan.isPopular ? 'var(--c-panel-strong)' : 'var(--c-panel)',
      backdropFilter: 'blur(20px)',
      border: plan.isPopular ? 'none' : '1px solid var(--c-border)',
      boxShadow: '0 26px 50px -32px rgba(31,42,68,0.4)',
      display: 'flex', flexDirection: 'column', position: 'relative', flex: 1,
    }}>
      {plan.isPopular && (
        <div style={{
          position: 'absolute', top: -13, left: 30,
          padding: '5px 13px', borderRadius: 999,
          background: '#1f2a44', color: '#fff',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
        }}>{t(lang, 'mostPopular')}</div>
      )}

      <div style={plan.isPopular
        ? { fontSize: 15, fontWeight: 700, background: 'linear-gradient(100deg,#5b9bff,#a07cff,#f07fc0)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
        : { fontSize: 15, fontWeight: 700, color: 'var(--c-text-2)' }}>
        {plan.name}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, margin: '14px 0 4px' }}>
        <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--c-text)' }}>{priceDisplay}</span>
        <span style={{ fontSize: 14, color: 'var(--c-text-3)', fontWeight: 600 }}>{priceSuffix}</span>
      </div>

      {isYearly && (
        <div style={{ fontSize: 12.5, color: 'var(--c-text-3)', fontWeight: 600, marginBottom: 6 }}>
          {t(lang, 'monthEquivalent', { amount: formatUzs(monthEquiv) })}
        </div>
      )}
      {plan.kind === 'subscription' && plan.yearlyDiscountPct > 0 && !isFree && (
        <div style={{
          alignSelf: 'flex-start', marginBottom: 10,
          padding: '3px 10px', borderRadius: 999,
          background: 'rgba(205,240,63,0.15)',
          border: '1px solid rgba(205,240,63,0.30)',
          color: '#9fbf2a', fontSize: 11, fontWeight: 700,
        }}>
          {t(lang, 'saveWithYearly', { pct: plan.yearlyDiscountPct })}
        </div>
      )}

      <p style={{ fontSize: 14, color: 'var(--c-text-2)', margin: '0 0 22px', fontWeight: 500 }}>{plan.blurb || ''}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 26 }}>
        {plan.features.map((f) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: 'var(--c-text-2)', fontWeight: 500 }}>
            <Icon name="check" opts={{ stroke: plan.isPopular ? '#f07fc0' : '#a07cff', sw: 2.4, size: 16 }} />{f}
          </div>
        ))}
      </div>

      <button
        onClick={() => onBuy(plan)}
        disabled={isFree || busy}
        style={{
          marginTop: 'auto', padding: 13, borderRadius: 14,
          border: plan.isPopular ? 'none' : '1px solid var(--c-border)',
          background: plan.isPopular && !isFree ? 'var(--c-btn-bg)' : 'var(--c-chip)',
          color: plan.isPopular && !isFree ? 'var(--c-btn-fg)' : 'var(--c-text)',
          fontSize: 14.5, fontWeight: 600,
          cursor: isFree || busy ? 'default' : 'pointer',
          opacity: isFree ? 0.7 : 1,
        }}
      >
        {busy ? '…' : isFree ? t(lang, 'currentPlan') : !authed ? t(lang, 'signInToGenerate') : t(lang, 'payWithClick')}
      </button>
    </div>
  )

  return gradient
    ? <div style={{ borderRadius: 30, padding: 2, background: gradient, boxShadow: '0 36px 64px -28px rgba(120,90,220,0.55)', display: 'flex' }}>{card}</div>
    : <div style={{ display: 'flex' }}>{card}</div>
}

export default function PricingModal() {
  const { pricingOpen, closePricing, lang, user, openAuth } = useApp()
  const [note, setNote] = useState<string | null>(null)
  const [plans, setPlans] = useState<PublicPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [busySlug, setBusySlug] = useState<string | null>(null)

  useEffect(() => {
    if (!pricingOpen) return
    let alive = true
    setLoading(true)
    fetchPublicPlans()
      .then((p) => { if (alive) setPlans(p.length ? p : fallbackPlans(lang)) })
      .catch(() => { if (alive) setPlans(fallbackPlans(lang)) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [pricingOpen, lang])

  const subs = plans.filter((p) => p.kind === 'subscription')
  const maxDiscount = Math.max(0, ...subs.map((p) => p.yearlyDiscountPct))

  const onBuy = async (plan: PublicPlan) => {
    if (plan.priceUzs <= 0) return
    // Guests must log in before starting a Click checkout.
    if (!user) {
      closePricing()
      openAuth('signin')
      return
    }
    setNote(t(lang, 'startingClick'))
    setBusySlug(plan.slug)
    try {
      const isYearly = billing === 'yearly' && plan.kind === 'subscription' && plan.yearlyDiscountPct > 0
      const r = await checkoutCredits(undefined, undefined, plan.slug, isYearly ? 'yearly' : 'monthly')
      if (r.ok && r.payUrl) {
        setNote(t(lang, 'redirectingClick'))
        window.location.href = r.payUrl
        return
      }
      setNote(r.message || t(lang, 'couldNotStartPayment'))
    } catch {
      setNote(t(lang, 'couldNotCheckout'))
    } finally {
      setBusySlug(null)
    }
  }

  return (
    <div onClick={closePricing} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'rgba(6,8,13,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      opacity: pricingOpen ? 1 : 0, visibility: pricingOpen ? 'visible' : 'hidden',
      transition: 'opacity .25s ease, visibility .25s ease',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'relative', width: '100%', maxWidth: 1000, maxHeight: '90vh', overflowY: 'auto',
        borderRadius: 30, padding: '38px 34px',
        background: 'var(--c-panel-strong)', border: '1px solid var(--c-border)',
        boxShadow: '0 50px 90px -40px rgba(0,0,0,0.6)',
        transform: pricingOpen ? 'none' : 'translateY(12px) scale(0.98)',
        transition: 'transform .25s ease',
      }}>
        <button onClick={closePricing} aria-label={t(lang, 'close')} style={{
          position: 'absolute', top: 18, right: 18,
          width: 36, height: 36, display: 'grid', placeItems: 'center',
          borderRadius: 999, border: '1px solid var(--c-border)',
          background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer',
        }}>
          <Icon name="x" opts={{ stroke: 'currentColor', sw: 2, size: 18 }} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a07cff' }}>
            {t(lang, 'pricingCap')}
          </span>
          <h2 style={{ fontSize: 'clamp(26px,3.4vw,38px)', fontWeight: 700, letterSpacing: '-0.025em', margin: '10px 0 0', color: 'var(--c-text)' }}>
            {t(lang, 'pricingHeading')}
          </h2>
          <p style={{ fontSize: 13.5, color: 'var(--c-text-2)', margin: '8px 0 0', fontWeight: 500 }}>
            {t(lang, 'pricingSub')}
          </p>
        </div>

        {maxDiscount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 26 }}>
            <div style={{
              display: 'inline-flex', gap: 4, padding: 4,
              borderRadius: 999, background: 'var(--c-chip)', border: '1px solid var(--c-border)',
            }}>
              {(['monthly', 'yearly'] as const).map((b) => {
                const on = billing === b
                return (
                  <button key={b} onClick={() => setBilling(b)} style={{
                    padding: '10px 22px', borderRadius: 999, border: 'none',
                    background: on ? 'var(--c-btn-bg)' : 'transparent',
                    color: on ? 'var(--c-btn-fg)' : 'var(--c-text-2)',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                  }}>
                    {t(lang, b === 'monthly' ? 'monthlyBilling' : 'yearlyBilling')}
                    {b === 'yearly' && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 800,
                        padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(205,240,63,0.25)',
                        color: '#aacb2e',
                      }}>−{maxDiscount}%</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-3)', fontWeight: 500 }}>…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 22, alignItems: 'stretch' }}>
            {subs.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                onBuy={onBuy}
                lang={lang}
                billing={billing}
                busy={busySlug === p.slug}
                authed={!!user}
              />
            ))}
          </div>
        )}

        {note && <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13.5, fontWeight: 600, color: 'var(--c-text-2)' }}>{note}</p>}
      </div>
    </div>
  )
}
