import { useEffect, useState } from 'react'
import { fetchSupport, replySupport, fmtDateTime, fmtInt, type SupportMessage } from '../lib/api'
import { t, useLang, type Lang } from '../lib/i18n'

function ReplyBox({ msg, onSaved, lang }: { msg: SupportMessage; onSaved: (m: SupportMessage) => void; lang: Lang }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const send = async () => {
    const body = text.trim()
    if (!body) return
    setBusy(true); setErr(null)
    try {
      const saved = await replySupport(msg.id, body)
      onSaved(saved); setText('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : t(lang, 'sup_replyFailed'))
    } finally { setBusy(false) }
  }
  return (
    <div style={{ marginTop: 12 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t(lang, 'sup_replyPh')}
        rows={3}
      />
      {err && <div className="err" style={{ marginTop: 6, fontSize: 12 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="primary" onClick={send} disabled={busy || !text.trim()}>
          {busy ? t(lang, 'sup_sending') : t(lang, 'sup_send')}
        </button>
      </div>
    </div>
  )
}

function MessageCard({ m, onSaved, lang }: { m: SupportMessage; onSaved: (m: SupportMessage) => void; lang: Lang }) {
  const answered = !!m.reply
  return (
    <div className="card">
      <div className="spread">
        <div>
          <div style={{ fontWeight: 700 }}>{m.name || t(lang, 'sup_anon')}</div>
          <div className="muted mono" style={{ fontSize: 12 }}>{m.email || m.userId || t(lang, 'sup_noContact')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge ${answered ? 'answered' : 'pending'}`}>{answered ? t(lang, 'sup_answered') : t(lang, 'sup_pending')}</span>
          <span className="muted" style={{ fontSize: 12 }}>{fmtDateTime(m.createdAt)}</span>
        </div>
      </div>
      <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.body}</div>
      {m.reply && (
        <div style={{
          marginTop: 12, padding: 12, borderRadius: 12,
          background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)',
        }}>
          <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            {t(lang, 'sup_reply')} · {m.repliedAt ? fmtDateTime(m.repliedAt) : ''}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{m.reply}</div>
        </div>
      )}
      {!answered && <ReplyBox msg={m} onSaved={onSaved} lang={lang} />}
    </div>
  )
}

export default function Support() {
  const lang = useLang()
  const [items, setItems] = useState<SupportMessage[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'answered'>('pending')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    fetchSupport()
      .then((m) => { if (alive) setItems(m) })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : t(lang, 'failedLoad')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [lang])

  const shown = items.filter((m) => {
    if (filter === 'all') return true
    if (filter === 'pending') return !m.reply
    return !!m.reply
  })
  const pending = items.filter((m) => !m.reply).length

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{t(lang, 'sup_title')}</h1>
          <p>{t(lang, 'sup_subtitle', { total: fmtInt(items.length), pending: fmtInt(pending) })}</p>
        </div>
        <div className="tabbar">
          {(['pending', 'all', 'answered'] as const).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{t(lang, `sup_filter_${f}`)}</button>
          ))}
        </div>
      </div>

      {err && <div className="error-banner">{err}</div>}
      {loading && <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shown.length === 0 && (
            <div className="card muted" style={{ textAlign: 'center', padding: 40 }}>
              {filter === 'pending' ? t(lang, 'sup_empty_pending') : t(lang, 'sup_empty_other')}
            </div>
          )}
          {shown.map((m) => (
            <MessageCard
              key={m.id}
              m={m}
              lang={lang}
              onSaved={(x) => setItems((list) => list.map((y) => y.id === x.id ? x : y))}
            />
          ))}
        </div>
      )}
    </>
  )
}
