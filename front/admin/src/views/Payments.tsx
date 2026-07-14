import { useEffect, useMemo, useState } from 'react'
import {
  fetchPayments, fetchPaymentsTimeseries,
  fmtDateTime, fmtInt, fmtUzs, fmtBucket,
  type Payment, type Period, type TimePoint,
} from '../lib/api'
import { t, useLang } from '../lib/i18n'

const STATUSES = ['all', 'paid', 'prepared', 'created', 'failed', 'cancelled'] as const
type Status = typeof STATUSES[number]

const PERIODS: Period[] = ['day', 'week', 'month', 'quarter', 'year']

function Chart({ points, period }: { points: TimePoint[]; period: Period }) {
  const max = Math.max(1, ...points.map((p) => p.totalUzs))
  return (
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
  )
}

export default function Payments() {
  const lang = useLang()
  const [payments, setPayments] = useState<Payment[]>([])
  const [status, setStatus] = useState<Status>('all')
  const [period, setPeriod] = useState<Period>('month')
  const [points, setPoints] = useState<TimePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    void Promise.all([
      fetchPayments(status === 'all' ? undefined : status),
      fetchPaymentsTimeseries(period),
    ])
      .then(([ps, pts]) => { if (alive) { setPayments(ps); setPoints(pts) } })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : t(lang, 'failedLoad')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [status, period, lang])

  const stats = useMemo(() => {
    const paid = payments.filter((p) => p.status === 'paid')
    return {
      count: paid.length,
      total: paid.reduce((s, p) => s + p.amountUzs, 0),
      credits: paid.reduce((s, p) => s + p.credits, 0),
      any: payments.length,
    }
  }, [payments])

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{t(lang, 'pay_title')}</h1>
          <p>{t(lang, 'pay_subtitle')}</p>
        </div>
        <div className="tabbar">
          {PERIODS.map((p) => (
            <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{t(lang, `period_${p}`)}</button>
          ))}
        </div>
      </div>

      {err && <div className="error-banner">{err}</div>}

      <div className="grid grid-4">
        <div className="card"><h2>{t(lang, 'pay_paidOrders')}</h2><div className="value">{fmtInt(stats.count)}</div></div>
        <div className="card"><h2>{t(lang, 'pay_paidRevenue')}</h2><div className="value">{fmtUzs(stats.total)}</div></div>
        <div className="card"><h2>{t(lang, 'pay_creditsSold')}</h2><div className="value">{fmtInt(stats.credits)}</div></div>
        <div className="card"><h2>{t(lang, 'pay_allOrders')}</h2><div className="value">{fmtInt(stats.any)}</div></div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h2>{t(lang, 'pay_revBy', { period: t(lang, `period_${period}`) })}</h2>
        <Chart points={points} period={period} />
      </div>

      <div className="row spread" style={{ margin: '18px 0 10px' }}>
        <div className="tabbar">
          {STATUSES.map((s) => (
            <button key={s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s === 'all' ? t(lang, 'pay_status_all') : s}</button>
          ))}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>{fmtInt(payments.length)} {t(lang, 'rowsSuffix')}</div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>}

      {!loading && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>{t(lang, 'pay_th_order')}</th>
                <th>{t(lang, 'pay_th_user')}</th>
                <th>{t(lang, 'pay_th_packPlan')}</th>
                <th>{t(lang, 'pay_th_amount')}</th>
                <th>{t(lang, 'pay_th_credits')}</th>
                <th>{t(lang, 'pay_th_status')}</th>
                <th>{t(lang, 'pay_th_created')}</th>
                <th>{t(lang, 'pay_th_updated')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="mono">#{p.merchantTransId}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.userName || '—'}</div>
                    <div className="muted mono">{p.userEmail || p.userId}</div>
                  </td>
                  <td><strong>{p.pack}</strong> <span className="muted">/ {p.plan}</span></td>
                  <td style={{ fontWeight: 700 }}>{fmtUzs(p.amountUzs)}</td>
                  <td>{fmtInt(p.credits)}</td>
                  <td><span className={`badge ${p.status}`}>{p.status}</span></td>
                  <td className="muted">{fmtDateTime(p.createdAt)}</td>
                  <td className="muted">{fmtDateTime(p.updatedAt)}</td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center' }} className="muted">{t(lang, 'pay_empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
