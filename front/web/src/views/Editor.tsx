import { useMemo, useState } from 'react'
import { useApp } from '../context'
import { typeMeta } from '../data/products'
import { Icon } from '../lib/icons'
import { t, type Lang } from '../lib/i18n'
import DeckEditor from '../components/DeckEditor'
import GenProgress from '../components/GenProgress'
import { slidewindEnabled } from '../lib/slidewind'
import { useIsMobile } from '../lib/useMedia'
import type { DocItem } from '../types'

function downloadDoc(d: DocItem) {
  let text = '# ' + d.title + '\n\n'
  d.slides?.forEach((s, i) => { text += `## Slide ${i + 1}: ${s.title}\n`; s.bullets.forEach((b) => { text += `- ${b}\n` }); text += '\n' })
  d.sections?.forEach((s) => { text += `## ${s.heading}\n${s.body}\n\n` })
  const blob = new Blob([text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (d.title || 'document').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.md'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

interface Activity { id: number; kind: 'created' | 'updating' | 'edited' | 'saved' | 'exported'; label: string; text?: string; time: string; who: string }
const KIND_COLOR: Record<Activity['kind'], string> = { created: '#34c759', updating: '#1f2a44', edited: '#7aa6ff', saved: '#a07cff', exported: '#ff9f7a' }
const nowStr = () => new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function ActivityPanel({ activities, unitLabel, chat, setChat, onSubmit, busy, lang, isMobile, onClose }: { activities: Activity[]; unitLabel: string; chat: string; setChat: (s: string) => void; onSubmit: () => void; busy: boolean; lang: Lang; isMobile: boolean; onClose: () => void }) {
  return (
    <section style={{
      flex: isMobile ? undefined : '0 0 360px',
      borderRight: isMobile ? 'none' : '1px solid var(--c-border)',
      display: 'flex', flexDirection: 'column', minWidth: 0,
      position: isMobile ? 'fixed' : 'relative',
      inset: isMobile ? '0 auto 0 0' : 'auto',
      top: isMobile ? 0 : undefined,
      left: isMobile ? 0 : undefined,
      width: isMobile ? 'min(88vw, 340px)' : undefined,
      height: isMobile ? '100dvh' : undefined,
      background: isMobile ? 'var(--c-panel-strong)' : undefined,
      zIndex: isMobile ? 60 : undefined,
      boxShadow: isMobile ? '0 20px 60px -10px rgba(0,0,0,0.6)' : undefined,
    }}>
      {isMobile && (
        <button
          onClick={onClose}
          aria-label="Close activity panel"
          style={{ position: 'absolute', top: 12, right: 12, width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer', zIndex: 1 }}
        >
          <Icon name="x" opts={{ stroke: 'currentColor', sw: 2, size: 16 }} />
        </button>
      )}
      <div style={{ padding: '20px 22px 14px', fontSize: 17, fontWeight: 700, color: 'var(--c-text)', textAlign: 'center' }}>{t(lang, 'activityHistory')}</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 22px 16px' }}>
        {activities.map((a) => (
          <div key={a.id} style={{ display: 'flex', gap: 12, paddingBottom: 22 }}>
            <span style={{ width: 11, height: 11, borderRadius: 99, marginTop: 5, flexShrink: 0, background: KIND_COLOR[a.kind], boxShadow: `0 0 0 4px ${KIND_COLOR[a.kind]}22` }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: a.kind === 'created' ? '#0c2912' : '#fff', background: a.kind === 'created' ? 'rgba(52,199,89,0.22)' : a.kind === 'updating' ? '#1f2a44' : KIND_COLOR[a.kind] }}>{a.label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--c-text-3)', fontWeight: 500 }}>{a.time}</span>
              </div>
              {a.text ? <div style={{ fontSize: 13.5, color: 'var(--c-text)', fontWeight: 600, lineHeight: 1.4, margin: '7px 0 3px' }}>{a.text}</div> : null}
              <div style={{ fontSize: 12, color: 'var(--c-text-3)', marginTop: 4 }}>{a.who}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 18px 18px', borderTop: '1px solid var(--c-border)' }}>
        <div style={{ fontSize: 13, color: 'var(--c-text-2)', fontWeight: 600, marginBottom: 8 }}>{t(lang, 'workingOn')} <span style={{ color: '#34c759' }}>{unitLabel}</span></div>
        <div style={{ borderRadius: 16, border: '1px solid var(--c-border)', background: 'var(--c-input)', padding: 12 }}>
          <textarea value={chat} onChange={(e) => setChat(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onSubmit() }} placeholder={t(lang, 'chatPlaceholder')} rows={4}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', background: 'transparent', outline: 'none', resize: 'none', color: 'var(--c-text)', fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--c-text-3)', fontWeight: 600 }}>{t(lang, 'submitHint')}</span>
            <button onClick={onSubmit} disabled={busy || !chat.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 999, border: 'none', background: busy || !chat.trim() ? 'var(--c-chip)' : 'var(--c-btn-bg)', color: busy || !chat.trim() ? 'var(--c-text-3)' : 'var(--c-btn-fg)', fontSize: 13.5, fontWeight: 700, cursor: busy || !chat.trim() ? 'default' : 'pointer' }}>
              <Icon name="sparkle" opts={{ stroke: 'currentColor', sw: 2, size: 15 }} />{busy ? t(lang, 'editing') : t(lang, 'apply')}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

function EditorBody({ source }: { source: DocItem }) {
  const { backToDashboard, saveDoc, user, lang } = useApp()
  const isMobile = useIsMobile()
  const [activityOpen, setActivityOpen] = useState(false)
  const [doc, setDoc] = useState<DocItem>(() => structuredClone(source))
  const [idx, setIdx] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [chat, setChat] = useState('')
  const who = (user && user.email) || 'you@example.com'
  const tm = typeMeta(doc.type, lang)
  const isSlides = !!doc.slides
  const units = (doc.slides ?? doc.sections ?? []) as Array<{ title?: string; bullets?: string[]; heading?: string; body?: string }>
  const cur = Math.max(0, Math.min(idx, units.length - 1))
  const unitLabel = (isSlides ? t(lang, 'slidePfx') + ' ' : t(lang, 'sectionPfx') + ' ') + (cur + 1)

  const [activities, setActivities] = useState<Activity[]>(() => [
    { id: 1, kind: 'created', label: t(lang, 'documentOpened'), time: nowStr(), who },
  ])
  const addActivity = (a: Omit<Activity, 'id' | 'time' | 'who'>) => setActivities((list) => [{ id: Date.now(), time: nowStr(), who, ...a }, ...list])

  const mutate = (fn: (d: DocItem) => void) => { setDoc((prev) => { const next = structuredClone(prev); fn(next); return next }); setDirty(true) }
  const save = () => { saveDoc(doc); setDirty(false); addActivity({ kind: 'saved', label: t(lang, 'savedLabel') }) }
  const exportDoc = () => { downloadDoc(doc); addActivity({ kind: 'exported', label: t(lang, 'exportedLabel') }) }
  const addUnit = () => { mutate((d) => { if (d.slides) d.slides.push({ title: t(lang, 'newSlide'), bullets: [t(lang, 'newPoint')] }); else d.sections!.push({ heading: t(lang, 'newSection'), body: t(lang, 'writeHerePh') }) }); setIdx(units.length); addActivity({ kind: 'edited', label: t(lang, 'slideAdded') }) }
  const submitChat = () => {
    if (!chat.trim()) return
    const text = chat.trim()
    addActivity({ kind: 'updating', label: t(lang, 'updatingSlide'), text })
    setChat(''); setBusy(true)
    window.setTimeout(() => { setBusy(false); addActivity({ kind: 'edited', label: t(lang, 'slideUpdated') }) }, 1400)
  }

  return (
    <div style={{ position: 'relative', display: 'flex', background: 'var(--c-panel)', color: 'var(--c-text)', borderRadius: 18, border: '1px solid var(--c-border)', minHeight: 'calc(100vh - 120px)', overflow: 'hidden' }}>
      {isMobile && activityOpen && (
        <div onClick={() => setActivityOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,13,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 55 }} />
      )}
      {(!isMobile || activityOpen) && (
        <ActivityPanel activities={activities} unitLabel={unitLabel} chat={chat} setChat={setChat} onSubmit={submitChat} busy={busy} lang={lang} isMobile={isMobile} onClose={() => setActivityOpen(false)} />
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: isMobile ? '12px 14px' : '14px 22px', borderBottom: '1px solid var(--c-border)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 auto' }}>
            <button onClick={backToDashboard} aria-label={t(lang, 'back2')} style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer', flexShrink: 0 }}>
              <Icon name="arrowLeft" opts={{ stroke: 'currentColor', sw: 2, size: 16 }} />
            </button>
            {isMobile && (
              <button onClick={() => setActivityOpen(true)} aria-label="Activity" style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer', flexShrink: 0 }}>
                <Icon name="menu" opts={{ stroke: 'currentColor', sw: 2, size: 16 }} />
              </button>
            )}
            <input value={doc.title} onChange={(e) => mutate((d) => { d.title = e.target.value })} style={{ minWidth: 120, padding: '8px 10px', borderRadius: 10, border: '1px solid transparent', background: 'transparent', color: 'var(--c-text)', fontSize: 16, fontWeight: 700, outline: 'none' }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: dirty ? '#ff9f7a' : '#34c759' }}>
              {dirty ? t(lang, 'unsaved') : <><Icon name="check" opts={{ stroke: '#34c759', sw: 2.6, size: 14 }} />{t(lang, 'saved')}</>}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', fontSize: 12.5, fontWeight: 600, color: 'var(--c-text-2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: tm.accent }} />{t(lang, 'themeLabel')} {tm.label}
            </span>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Icon name="link" opts={{ stroke: 'currentColor', sw: 2, size: 15 }} />{t(lang, 'share')}
            </button>
            <button onClick={exportDoc} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 12, border: 'none', background: '#1f9d57', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 12px 22px -12px rgba(31,157,87,0.6)' }}>
              <Icon name="download" opts={{ stroke: 'currentColor', sw: 2, size: 16 }} />{t(lang, 'downloadFmt', { fmt: tm.fmt })}
            </button>
            <button onClick={save} style={{ padding: '9px 16px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>{t(lang, 'save')}</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(20px,3vw,40px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '100%', maxWidth: 880 }}>
            {isSlides ? (
              <div style={{ position: 'relative', borderRadius: 20, background: 'linear-gradient(150deg,#ffffff,#f3f1fb)', border: '1px solid var(--c-border)', boxShadow: '0 30px 60px -34px rgba(31,42,68,0.5)', aspectRatio: '16 / 9', padding: 'clamp(24px,4vw,44px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', top: 0, left: 0, width: 8, height: '100%', background: `linear-gradient(180deg, ${tm.accent}, #ff9f7a)` }} />
                <input key={'t' + cur} value={units[cur]?.title || ''} onChange={(e) => mutate((d) => { d.slides![cur].title = e.target.value })} placeholder={t(lang, 'slideTitlePh')} style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 'clamp(22px,3vw,30px)', fontWeight: 800, color: '#16203a', letterSpacing: '-0.02em', marginBottom: 16 }} />
                <textarea key={'b' + cur} value={(units[cur]?.bullets || []).join('\n')} onChange={(e) => mutate((d) => { d.slides![cur].bullets = e.target.value.split('\n') })} placeholder={t(lang, 'onePointPh')} style={{ flex: 1, resize: 'none', border: 'none', background: 'transparent', outline: 'none', fontSize: 16, lineHeight: 1.7, color: '#34406a', fontWeight: 500, fontFamily: 'inherit' }} />
              </div>
            ) : (
              <div style={{ borderRadius: 18, background: 'linear-gradient(150deg,#ffffff,#f6f4ff)', border: '1px solid var(--c-border)', boxShadow: '0 30px 60px -34px rgba(31,42,68,0.5)', padding: 'clamp(28px,5vw,52px)', color: '#16203a' }}>
                <input key={'h' + cur} value={units[cur]?.heading || ''} onChange={(e) => mutate((d) => { d.sections![cur].heading = e.target.value })} placeholder={t(lang, 'headingPh')} style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--c-border)', background: 'transparent', outline: 'none', fontSize: 22, fontWeight: 700, color: '#16203a', padding: '6px 0', marginBottom: 10, boxSizing: 'border-box' }} />
                <textarea key={'y' + cur} value={units[cur]?.body || ''} onChange={(e) => mutate((d) => { d.sections![cur].body = e.target.value })} rows={Math.max(6, (units[cur]?.body || '').split('\n').length + 2)} placeholder={t(lang, 'writeHerePh')} style={{ width: '100%', resize: 'vertical', border: 'none', background: 'transparent', outline: 'none', fontSize: 15, lineHeight: 1.8, color: '#34406a', fontWeight: 500, boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--c-text-3)', fontWeight: 500, marginTop: 18, textAlign: 'center' }}>{t(lang, 'editingHint', { fmt: tm.fmt })}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 22px', borderTop: '1px solid var(--c-border)', overflowX: 'auto' }}>
          {units.map((u, i) => {
            const on = i === cur
            return (
              <button key={i} onClick={() => setIdx(i)} style={{ position: 'relative', flex: '0 0 auto', width: 132, height: 74, borderRadius: 10, border: '2px solid ' + (on ? tm.accent : 'var(--c-border)'), background: 'linear-gradient(150deg,#ffffff,#f3f1fb)', color: '#16203a', cursor: 'pointer', padding: 9, textAlign: 'left', overflow: 'hidden' }}>
                <span style={{ position: 'absolute', left: 0, top: 0, width: 4, height: '100%', background: tm.accent }} />
                <div style={{ fontSize: 9, fontWeight: 700, color: '#8a95ab', marginLeft: 4 }}>{(isSlides ? t(lang, 'slidePfx') + ' ' : t(lang, 'sectionPfx') + ' ') + (i + 1)}</div>
                <div style={{ fontSize: 11, fontWeight: 700, marginLeft: 4, marginTop: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{(isSlides ? u.title : u.heading) || t(lang, 'untitled')}</div>
                <span style={{ position: 'absolute', bottom: 6, left: 13, width: 18, height: 18, borderRadius: 6, background: on ? tm.accent : 'rgba(31,42,68,0.15)', color: on ? '#fff' : '#8a95ab', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
              </button>
            )
          })}
          <button onClick={addUnit} aria-label={t(lang, 'addSlide')} style={{ flex: '0 0 auto', width: 132, height: 74, borderRadius: 10, border: '2px dashed var(--c-border)', background: 'transparent', color: 'var(--c-text-3)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <Icon name="plus" opts={{ stroke: 'currentColor', sw: 2.2, size: 20 }} />
          </button>
        </div>
      </main>
    </div>
  )
}

export default function Editor() {
  const { view, items, editId } = useApp()
  const source = useMemo(() => items.find((x) => x.id === editId) || null, [items, editId])
  if (view !== 'editor' || !source) return null
  if (source.deckId && slidewindEnabled()) return <DeckEditor key={source.id} source={source} />
  return <EditorBody key={source.id} source={source} />
}

/** Deck content for the profile `/profile/deck/:id` page (no second sidebar). */
export function ProfileDeckPage({ docId }: { docId: string }) {
  const { items, genJobs, backToDashboard, openCreate, openPricing, lang } = useApp()
  const job = useMemo(() => genJobs.find((j) => j.id === docId) || null, [genJobs, docId])
  const source = useMemo(
    () => items.find((x) => x.id === docId || x.deckId === docId) || null,
    [items, docId],
  )

  if (job && (job.status === 'queued' || job.status === 'generating')) {
    return (
      <div style={{ borderRadius: 18, border: '1px solid var(--c-border)', background: 'var(--c-panel)', padding: '28px 24px 36px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 6px', color: 'var(--c-text)' }}>{job.title}</h2>
            <p style={{ fontSize: 14, color: 'var(--c-text-2)', margin: 0, fontWeight: 500 }}>
              {t(lang, 'genRunningBg')}
            </p>
          </div>
          <button onClick={backToDashboard} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            {t(lang, 'backPresentations')}
          </button>
        </div>
        <GenProgress stage={job.stage} done={false} label={job.label} />
      </div>
    )
  }

  if (job && job.status === 'error') {
    return (
      <div style={{ borderRadius: 18, border: '1px solid var(--c-border)', background: 'var(--c-panel)', padding: 40, textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: 'var(--c-text)' }}>{job.title}</h2>
        <p style={{ fontSize: 14, color: '#f87171', fontWeight: 600, margin: '0 0 18px' }}>{job.error || t(lang, 'genFailed')}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={backToDashboard} style={{ padding: '11px 18px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t(lang, 'backPresentations')}</button>
          {/credit/i.test(job.error || '') && (
            <button onClick={openPricing} style={{ padding: '11px 18px', borderRadius: 12, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t(lang, 'viewPlans')}</button>
          )}
          <button onClick={openCreate} style={{ padding: '11px 18px', borderRadius: 12, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t(lang, 'tryAgain')}</button>
        </div>
      </div>
    )
  }

  if (!source) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--c-text-3)', fontWeight: 500 }}>
        {t(lang, 'notFound')}
      </div>
    )
  }
  if (source.deckId && slidewindEnabled()) return <DeckEditor key={source.id} source={source} />
  return <EditorBody key={source.id} source={source} />
}
