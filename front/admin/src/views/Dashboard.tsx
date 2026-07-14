import { useEffect, useState } from 'react'
import { fetchStats, fetchPaymentsTimeseries, fmtInt, fmtUzs, fmtBucket, type DashboardStats, type Period, type TimePoint } from '../lib/api'
import { t, useLang } from '../lib/i18n'

const PERIODS: Period[] = ['day', 'week', 'month', 'quarter', 'year']

function Chart({ points, period }: { points: TimePoint[]; period: Period }) {
  const lang = useLang()
  const max = Math.max(1, ...points.map((p) => p.totalUzs))
  return (
    <>
      <div className="chart">
        {points.map((p) => {
          const h = Math.max(2, Math.round((p.totalUzs / max) * 100))
          return (
            <div key={p.bucket} className="col" title={`${fmtBucket(p.bucket, period)} · ${fmtUzs(p.totalUzs)} · ${p.count} paid`}>
              <div className="track">
                <div className="bar" style={{ height: `${h}%` }} />
              </div>
              <div className="lbl">{fmtBucket(p.bucket, period)}</div>
            </div>
          )
        })}
      </div>
      <div className="row spread" style={{ marginTop: 10, color: 'var(--text-3)', fontSize: 12 }}>
        <span>{t(lang, 'dash_totalInView')} <strong style={{ color: 'var(--text)' }}>{fmtUzs(points.reduce((s, p) => s + p.totalUzs, 0))}</strong></span>
        <span>{t(lang, 'dash_paidOrders')} <strong style={{ color: 'var(--text)' }}>{fmtInt(points.reduce((s, p) => s + p.count, 0))}</strong></span>
      </div>
    </>
  )
}

export default function Dashboard() {
  const lang = useLang()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [period, setPeriod] = useState<Period>('month')
  const [points, setPoints] = useState<TimePoint[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    void Promise.all([fetchStats(), fetchPaymentsTimeseries(period)])
      .then(([s, p]) => { if (alive) { setStats(s); setPoints(p) } })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : t(lang, 'failedLoad')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [period, lang])

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{t(lang, 'dash_title')}</h1>
          <p>{t(lang, 'dash_subtitle')}</p>
        </div>
        <div className="tabbar">
          {PERIODS.map((p) => (
            <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{t(lang, `period_${p}`)}</button>
          ))}
        </div>
      </div>

      {err && <div className="error-banner">{err}</div>}
      {loading && !stats && <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>}

      {stats && (
        <>
          <div className="grid grid-4">
            <div className="card">
              <h2>{t(lang, 'dash_users')}</h2>
              <div className="value">{fmtInt(stats.users.total)}</div>
              <div className="sub">{t(lang, 'dash_usersSub', { n: fmtInt(stats.users.newLast30d) })}</div>
            </div>
            <div className="card">
              <h2>{t(lang, 'dash_revenue')}</h2>
              <div className="value">{fmtUzs(stats.payments.paidTotalUzs)}</div>
              <div className="sub">{t(lang, 'dash_revenueSub', { count: fmtInt(stats.payments.paidCount), last: fmtUzs(stats.payments.last30dUzs) })}</div>
            </div>
            <div className="card">
              <h2>{t(lang, 'dash_materials')}</h2>
              <div className="value">{fmtInt(stats.materials.total)}</div>
              <div className="sub">{t(lang, 'dash_materialsSub')}</div>
            </div>
            <div className="card">
              <h2>{t(lang, 'dash_credits')}</h2>
              <div className="value">{fmtInt(stats.credits.spent)}</div>
              <div className="sub">{t(lang, 'dash_creditsSub', { granted: fmtInt(stats.credits.granted), spent: fmtInt(stats.credits.spent) })}</div>
            </div>
          </div>

          <div className="grid grid-2" style={{ marginTop: 18 }}>
            <div className="card">
              <h2>{t(lang, 'dash_revTrend')}</h2>
              <Chart points={points} period={period} />
            </div>
            <div className="card">
              <h2>{t(lang, 'dash_attention')}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
                <div className="spread">
                  <span>{t(lang, 'dash_blocked')}</span>
                  <span className="badge blocked">{fmtInt(stats.users.blocked)}</span>
                </div>
                <div className="spread">
                  <span>{t(lang, 'dash_unlimited')}</span>
                  <span className="badge unlimited">{fmtInt(stats.users.unlimited)}</span>
                </div>
                <div className="spread">
                  <span>{t(lang, 'dash_admins')}</span>
                  <span className="badge admin">{fmtInt(stats.users.admins)}</span>
                </div>
                <div className="spread">
                  <span>{t(lang, 'dash_unanswered')}</span>
                  <span className="badge pending">{fmtInt(stats.support.unanswered)}</span>
                </div>
                <div className="spread">
                  <span>{t(lang, 'dash_ordersAny')}</span>
                  <span className="badge created">{fmtInt(stats.payments.createdCount)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
