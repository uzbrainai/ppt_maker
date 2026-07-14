import { useEffect, useState } from 'react'
import { fetchSubscriptions, fetchPlans, fmtDate, fmtInt, fmtUzs, type Payment, type Plan } from '../lib/api'
import { t, useLang, type Lang } from '../lib/i18n'

function planClass(p: string): string {
  const k = p.toLowerCase()
  if (['pro', 'premium'].includes(k)) return 'pro'
  if (k === 'team') return 'team'
  return 'starter'
}

function TariffCard({ plan, lang }: { plan: Plan; lang: Lang }) {
  return (
    <div className="card" style={{
      border: plan.isPopular ? '1px solid rgba(124,92,255,0.55)' : undefined,
      boxShadow: plan.isPopular ? '0 22px 45px -22px rgba(124,92,255,0.35)' : undefined,
      opacity: plan.isActive ? 1 : 0.55,
    }}>
      <div className="spread" style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{plan.name}</div>
        {plan.isPopular && <span className="badge admin">{t(lang, 'subs_popular')}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 800 }}>{fmtUzs(plan.priceUzs)}</span>
        <span className="muted">{t(lang, 'subs_perMonth')}</span>
      </div>
      {plan.blurb && <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{plan.blurb}</div>}
      <div style={{ marginTop: 10, fontSize: 13 }}>
        <span className="muted">{t(lang, 'subs_creditsLbl')} </span><strong>{fmtInt(plan.credits)}</strong>
        {plan.monthlyAllowance !== null && (
          <> · <span className="muted">{t(lang, 'subs_monthlyLbl')} </span><strong>{fmtInt(plan.monthlyAllowance)}</strong></>
        )}
      </div>
      {plan.features.length > 0 && (
        <ul style={{ margin: '10px 0 0', padding: '0 0 0 18px', color: 'var(--text-2)', fontSize: 13 }}>
          {plan.features.slice(0, 4).map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}
    </div>
  )
}

export default function Subscriptions() {
  const lang = useLang()
  const [subs, setSubs] = useState<Payment[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    void Promise.all([fetchSubscriptions(), fetchPlans()])
      .then(([s, p]) => { if (alive) { setSubs(s); setPlans(p) } })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : t(lang, 'failedLoad')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [lang])

  const tariffs = plans.filter((p) => p.kind === 'subscription')
  const totalLifetime = subs.reduce((s, p) => s + p.amountUzs, 0)
  const uniqueUsers = new Set(subs.map((s) => s.userId)).size
  const perPlan = tariffs.map((t) => ({
    plan: t,
    count: subs.filter((s) => (s.plan || '').toLowerCase() === t.slug.toLowerCase()).length,
    revenue: subs.filter((s) => (s.plan || '').toLowerCase() === t.slug.toLowerCase()).reduce((x, y) => x + y.amountUzs, 0),
  }))

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{t(lang, 'subs_title')}</h1>
          <p>{t(lang, 'subs_subtitle')}</p>
        </div>
        <a href="#/plans"><button>⚙️ {t(lang, 'subs_editPlans')}</button></a>
      </div>

      {err && <div className="error-banner">{err}</div>}
      {loading && <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>}

      {!loading && (
        <>
          {/* Aggregates */}
          <div className="grid grid-4" style={{ marginBottom: 20 }}>
            <div className="card"><h2>{t(lang, 'subs_activeSubs')}</h2><div className="value">{fmtInt(uniqueUsers)}</div></div>
            <div className="card"><h2>{t(lang, 'subs_totalRev')}</h2><div className="value">{fmtUzs(totalLifetime)}</div></div>
            <div className="card"><h2>{t(lang, 'subs_configuredTariffs')}</h2><div className="value">{fmtInt(tariffs.length)}</div></div>
            <div className="card"><h2>{t(lang, 'pay_paidOrders')}</h2><div className="value">{fmtInt(subs.length)}</div></div>
          </div>

          {/* Tariff plans */}
          <h2 style={{ margin: '10px 0 12px', fontSize: 14, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t(lang, 'subs_tariffPlans')} ({tariffs.length})
          </h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', marginBottom: 24 }}>
            {tariffs.map((p) => <TariffCard key={p.id} plan={p} lang={lang} />)}
            {tariffs.length === 0 && (
              <div className="card muted" style={{ textAlign: 'center', padding: 30 }}>
                {t(lang, 'subs_noSubPlans')} <a href="#/plans" style={{ color: 'var(--accent)', fontWeight: 600 }}>{t(lang, 'subs_createOne')}</a>
              </div>
            )}
          </div>

          {/* Per-plan breakdown */}
          {tariffs.length > 0 && (
            <>
              <h2 style={{ margin: '10px 0 12px', fontSize: 14, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t(lang, 'subs_perPlan')}
              </h2>
              <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: 24 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t(lang, 'subs_th_plan')}</th>
                      <th>{t(lang, 'subs_th_subs')}</th>
                      <th>{t(lang, 'subs_th_revenue')}</th>
                      <th>{t(lang, 'subs_th_share')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perPlan.map(({ plan, count, revenue }) => {
                      const share = totalLifetime > 0 ? (revenue / totalLifetime) * 100 : 0
                      return (
                        <tr key={plan.id}>
                          <td><span className={`badge ${planClass(plan.slug)}`}>{plan.name}</span></td>
                          <td>{fmtInt(count)}</td>
                          <td style={{ fontWeight: 700 }}>{fmtUzs(revenue)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--chip)', borderRadius: 99, maxWidth: 160, overflow: 'hidden' }}>
                                <div style={{ width: `${share}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
                              </div>
                              <span className="muted" style={{ fontSize: 12 }}>{share.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Purchased subscriptions */}
          <h2 style={{ margin: '10px 0 12px', fontSize: 14, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t(lang, 'subs_purchased')} ({subs.length})
          </h2>
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t(lang, 'pay_th_user')}</th>
                  <th>{t(lang, 'subs_th_plan')}</th>
                  <th>{t(lang, 'subs_th_credits')}</th>
                  <th>{t(lang, 'subs_th_amount')}</th>
                  <th>{t(lang, 'subs_th_purchased')}</th>
                  <th>{t(lang, 'subs_th_order')}</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.userName || '—'}</div>
                      <div className="muted mono">{s.userEmail || s.userId}</div>
                    </td>
                    <td><span className={`badge ${planClass(s.plan)}`}>{s.plan}</span></td>
                    <td>{fmtInt(s.credits)}</td>
                    <td style={{ fontWeight: 700 }}>{fmtUzs(s.amountUzs)}</td>
                    <td className="muted">{fmtDate(s.updatedAt)}</td>
                    <td className="muted mono">#{s.merchantTransId}</td>
                  </tr>
                ))}
                {subs.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 30, textAlign: 'center' }} className="muted">{t(lang, 'subs_empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
