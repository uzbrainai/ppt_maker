import { useEffect, useMemo, useState } from 'react'
import {
  fetchApiUsageSummary, fetchApiUsageTimeseries, fetchApiUsageTopUsers,
  fmtUsd, fmtCompact, fmtInt,
  type ApiProvider, type Period, type UsageSummary, type UsageTimePoint, type UsageTopUser,
} from '../lib/api'
import { t, useLang } from '../lib/i18n'

const PERIODS: Period[] = ['day', 'week', 'month', 'quarter', 'year']

const PROVIDER_LABEL: Record<ApiProvider, string> = {
  openai_chat:   'OpenAI Chat',
  openai_search: 'OpenAI Search',
  openai_image:  'OpenAI Image',
  tavily:        'Tavily',
  image_service: 'Image Service',
}

const PROVIDER_COLOR: Record<ApiProvider, string> = {
  openai_chat:   '#7c5cff',
  openai_search: '#22d3ee',
  openai_image:  '#f472b6',
  tavily:        '#facc15',
  image_service: '#4ade80',
}

function StackedBarChart({ points, mode, emptyLabel }: {
  points: UsageTimePoint[]
  mode: 'cost' | 'calls' | 'tokens'
  emptyLabel: string
}) {
  const buckets = useMemo(() => {
    const map = new Map<string, UsageTimePoint[]>()
    for (const p of points) {
      const list = map.get(p.bucket) ?? []
      list.push(p)
      map.set(p.bucket, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [points])

  const valueOf = (p: UsageTimePoint) =>
    mode === 'cost' ? p.costUsdMicros : mode === 'calls' ? p.calls : p.totalTokens

  const max = Math.max(1, ...buckets.map(([, list]) => list.reduce((s, p) => s + valueOf(p), 0)))

  if (!buckets.length) {
    return <div className="muted" style={{ padding: '30px 0', textAlign: 'center', fontSize: 13 }}>{emptyLabel}</div>
  }

  const w = 720, h = 200, pad = 24
  const barW = (w - pad * 2) / buckets.length

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 200, display: 'block' }}>
      {buckets.map(([bucket, list], i) => {
        let acc = 0
        const total = list.reduce((s, p) => s + valueOf(p), 0)
        const barTop = h - pad - (total / max) * (h - pad * 2)
        return (
          <g key={bucket}>
            {list
              .filter((p) => valueOf(p) > 0)
              .map((p) => {
                const v = valueOf(p)
                const segH = (v / max) * (h - pad * 2)
                const y = h - pad - acc - segH
                acc += segH
                return (
                  <rect
                    key={p.provider}
                    x={pad + i * barW + 2}
                    y={y}
                    width={Math.max(1, barW - 4)}
                    height={segH}
                    fill={PROVIDER_COLOR[p.provider] ?? '#94a3b8'}
                    rx={2}
                  >
                    <title>{`${new Date(bucket).toLocaleString()} · ${PROVIDER_LABEL[p.provider] ?? p.provider} · ${mode === 'cost' ? fmtUsd(v) : fmtCompact(v)}`}</title>
                  </rect>
                )
              })}
            {(i === 0 || i === buckets.length - 1 || i === Math.floor(buckets.length / 2)) && (
              <text x={pad + i * barW + barW / 2} y={h - 6} fontSize={10} textAnchor="middle" fill="var(--text-3)">
                {new Date(bucket).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            )}
            {i === 0 && (
              <text x={pad + 4} y={barTop - 4} fontSize={10} fill="var(--text-3)">
                {mode === 'cost' ? fmtUsd(max) : fmtCompact(max)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function Legend({ providers }: { providers: ApiProvider[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
      {providers.map((p) => (
        <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: PROVIDER_COLOR[p] ?? '#94a3b8' }} />
          {PROVIDER_LABEL[p] ?? p}
        </div>
      ))}
    </div>
  )
}

export default function ApiUsage() {
  const lang = useLang()
  const [period, setPeriod] = useState<Period>('month')
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [points, setPoints] = useState<UsageTimePoint[]>([])
  const [top, setTop] = useState<UsageTopUser[]>([])
  const [mode, setMode] = useState<'cost' | 'calls' | 'tokens'>('cost')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    void Promise.all([
      fetchApiUsageSummary(period),
      fetchApiUsageTimeseries(period),
      fetchApiUsageTopUsers(period, 10),
    ])
      .then(([s, ts, tu]) => { if (!alive) return; setSummary(s); setPoints(ts.points); setTop(tu.users) })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : t(lang, 'failedLoad')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [period, lang])

  const providers = useMemo<ApiProvider[]>(() => {
    const set = new Set<ApiProvider>()
    for (const p of points) set.add(p.provider)
    return [...set]
  }, [points])

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{t(lang, 'au_title')}</h1>
          <p>{t(lang, 'au_subtitle')}</p>
        </div>
        <div className="tabbar">
          {PERIODS.map((p) => (
            <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{t(lang, `period_${p}`)}</button>
          ))}
        </div>
      </div>

      {err && <div className="error-banner">{err}</div>}
      {loading && !summary && <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>}

      {summary && (
        <>
          {/* totals KPIs */}
          <div className="grid grid-4">
            <div className="card">
              <h2>{t(lang, 'au_calls')}</h2>
              <div className="value">{fmtInt(summary.totals.calls)}</div>
              <div className="sub">{fmtInt(summary.totals.errors)} {t(lang, 'au_errors')}</div>
            </div>
            <div className="card">
              <h2>{t(lang, 'au_tokens')}</h2>
              <div className="value">{fmtCompact(summary.totals.totalTokens)}</div>
              <div className="sub">&nbsp;</div>
            </div>
            <div className="card">
              <h2>{t(lang, 'au_estCost')}</h2>
              <div className="value">{fmtUsd(summary.totals.costUsdMicros)}</div>
              <div className="sub">&nbsp;</div>
            </div>
            <div className="card">
              <h2>{t(lang, 'au_avgLatency')}</h2>
              <div className="value">{summary.totals.avgLatencyMs} ms</div>
              <div className="sub">&nbsp;</div>
            </div>
          </div>

          {/* per-provider cards */}
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', marginTop: 18 }}>
            {summary.byProvider.map((row) => {
              const errRate = row.calls ? (100 * row.errors) / row.calls : 0
              return (
                <div key={row.provider} className="card">
                  <div className="row spread" style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: PROVIDER_COLOR[row.provider] ?? '#94a3b8' }} />
                      <strong>{PROVIDER_LABEL[row.provider] ?? row.provider}</strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{fmtCompact(row.calls)}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{t(lang, 'au_calls_lc')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{fmtCompact(row.totalTokens)}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{t(lang, 'au_tokens_lc')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{fmtUsd(row.costUsdMicros)}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{t(lang, 'au_estCost')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: errRate > 5 ? '#ef4444' : undefined }}>{errRate.toFixed(1)}%</div>
                      <div className="muted" style={{ fontSize: 11 }}>{t(lang, 'au_errorsPct')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{row.avgLatencyMs} ms</div>
                      <div className="muted" style={{ fontSize: 11 }}>{t(lang, 'au_lat')}</div>
                    </div>
                  </div>
                </div>
              )
            })}
            {summary.byProvider.length === 0 && (
              <div className="card muted" style={{ textAlign: 'center', padding: 30 }}>{t(lang, 'au_noWindow')}</div>
            )}
          </div>

          {/* chart */}
          <div className="card" style={{ marginTop: 18 }}>
            <div className="row spread" style={{ marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>{t(lang, 'au_overTime')}</h2>
              <div className="tabbar">
                {(['cost', 'calls', 'tokens'] as const).map((m) => (
                  <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>{t(lang, `au_mode_${m}`)}</button>
                ))}
              </div>
            </div>
            <StackedBarChart points={points} mode={mode} emptyLabel={t(lang, 'au_empty')} />
            {providers.length > 0 && <Legend providers={providers} />}
          </div>

          {/* per-model table */}
          {summary.byModel.length > 0 && (
            <>
              <h2 style={{ margin: '20px 0 12px', fontSize: 14, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t(lang, 'au_topModels')}
              </h2>
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t(lang, 'au_th_provider')}</th>
                      <th>{t(lang, 'au_th_model')}</th>
                      <th style={{ textAlign: 'right' }}>{t(lang, 'au_calls')}</th>
                      <th style={{ textAlign: 'right' }}>{t(lang, 'au_tokens')}</th>
                      <th style={{ textAlign: 'right' }}>{t(lang, 'au_th_cost')}</th>
                      <th style={{ textAlign: 'right' }}>{t(lang, 'au_errors')}</th>
                      <th style={{ textAlign: 'right' }}>{t(lang, 'au_th_latency')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byModel.map((m) => (
                      <tr key={`${m.provider}:${m.model}`}>
                        <td className="muted">{PROVIDER_LABEL[m.provider] ?? m.provider}</td>
                        <td style={{ fontWeight: 600 }}>{m.model}</td>
                        <td style={{ textAlign: 'right' }}>{fmtCompact(m.calls)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtCompact(m.totalTokens)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtUsd(m.costUsdMicros)}</td>
                        <td style={{ textAlign: 'right', color: m.errors ? '#ef4444' : undefined }}>{fmtInt(m.errors)}</td>
                        <td style={{ textAlign: 'right' }} className="muted">{m.avgLatencyMs} ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* top users */}
          {top.length > 0 && (
            <>
              <h2 style={{ margin: '20px 0 12px', fontSize: 14, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t(lang, 'au_topUsers')}
              </h2>
              <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>{t(lang, 'au_th_user')}</th>
                      <th style={{ textAlign: 'right' }}>{t(lang, 'au_calls')}</th>
                      <th style={{ textAlign: 'right' }}>{t(lang, 'au_tokens')}</th>
                      <th style={{ textAlign: 'right' }}>{t(lang, 'au_th_cost')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((u) => (
                      <tr key={u.userId}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{u.name || u.email || u.userId}</div>
                          {u.email && u.name && <div className="muted mono" style={{ fontSize: 11 }}>{u.email}</div>}
                        </td>
                        <td style={{ textAlign: 'right' }}>{fmtCompact(u.calls)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtCompact(u.totalTokens)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtUsd(u.costUsdMicros)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  )
}
