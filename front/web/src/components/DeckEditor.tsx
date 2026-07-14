import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../context'
import { Icon } from '../lib/icons'
import { t, type Lang } from '../lib/i18n'
import { apiHeaders } from '../lib/auth'
import {
  fetchEditor,
  buildDeck,
  buildDeckPdf,
  downloadPptx,
  downloadPdf,
  rewriteText,
  type EditorData,
  type EditableText,
} from '../lib/slidewind'
import { useIsMobile } from '../lib/useMedia'
import type { DocItem } from '../types'

const LIME = '#cdf03f'

const aiPresets = (lang: Lang): { id: string; label: string; instruction: string }[] => [
  { id: 'shorter', label: t(lang, 'aiMakeShorter'), instruction: 'Make this more concise. Keep the meaning.' },
  { id: 'longer', label: t(lang, 'aiExpand'), instruction: 'Expand slightly with one clearer supporting detail. Stay slide-friendly.' },
  { id: 'pro', label: t(lang, 'aiMoreProfessional'), instruction: 'Rewrite in a polished, professional presentation tone.' },
  { id: 'simple', label: t(lang, 'aiSimplify'), instruction: 'Simplify the language so a general audience understands it.' },
  { id: 'bullets', label: t(lang, 'aiAsBullets'), instruction: 'Rewrite as short bullet points, one idea per line (no bullet symbols).' },
  { id: 'title', label: t(lang, 'aiStrongerTitle'), instruction: 'Rewrite as a punchy slide title (max ~8 words).' },
]

function OverlayText({
  t, size, scale, text, selected, onSelect,
}: {
  t: EditableText
  size: { width: number; height: number }
  scale: number
  text: string
  selected: boolean
  onSelect: () => void
}) {
  const fontPx = (t.sizePt / 72) * scale
  const padPx = Math.max(1, 0.04 * scale)
  const justify = t.vAlign === 'middle' ? 'center' : t.vAlign === 'bottom' ? 'flex-end' : 'flex-start'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() } }}
      style={{
        position: 'absolute',
        left: `${(t.x / size.width) * 100}%`,
        top: `${(t.y / size.height) * 100}%`,
        width: `${(t.w / size.width) * 100}%`,
        height: `${(t.h / size.height) * 100}%`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: justify,
        textAlign: t.align,
        color: t.color,
        fontWeight: t.bold ? 700 : 400,
        fontStyle: t.italic ? 'italic' : 'normal',
        fontSize: `${fontPx}px`,
        lineHeight: t.lineSpacing,
        padding: `${padPx}px`,
        boxSizing: 'border-box',
        overflow: 'hidden',
        outline: 'none',
        cursor: 'pointer',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        fontFamily: 'Segoe UI, Arial, sans-serif',
        borderRadius: 4,
        boxShadow: selected ? `0 0 0 2px ${LIME}` : 'none',
        background: selected ? 'rgba(205,240,63,0.12)' : 'transparent',
        transition: 'box-shadow .15s, background .15s',
      }}
    >
      {text}
    </div>
  )
}

function MagicEditor({
  textId,
  value,
  onChange,
  onClose,
  lang,
}: {
  textId: string
  value: string
  onChange: (id: string, text: string) => void
  onClose: () => void
  lang: Lang
}) {
  const isMobile = useIsMobile()
  const [mode, setMode] = useState<'manual' | 'ai'>('ai')
  const [draft, setDraft] = useState(value)
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const AI_PRESETS = aiPresets(lang)

  useEffect(() => {
    setDraft(value)
    setErr(null)
  }, [textId, value])

  useEffect(() => {
    setPrompt('')
    setMode('ai')
  }, [textId])

  const apply = (next: string) => {
    setDraft(next)
    onChange(textId, next)
  }

  const runAi = async (instruction: string) => {
    if (!instruction.trim() || busy) return
    setBusy(true)
    setErr(null)
    try {
      const next = await rewriteText(draft, instruction.trim(), apiHeaders())
      apply(next)
      setMode('manual')
    } catch (e) {
      setErr(e instanceof Error ? e.message : t(lang, 'aiRewriteFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {isMobile && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,13,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 70 }} />
      )}
    <aside style={isMobile ? {
      position: 'fixed', left: 0, right: 0, bottom: 0,
      width: '100%', maxHeight: '82vh', borderTop: '1px solid var(--c-border)',
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      display: 'flex', flexDirection: 'column',
      background: 'var(--c-panel-strong)',
      boxShadow: '0 -20px 60px -10px rgba(0,0,0,0.6)',
      zIndex: 80,
      overflow: 'hidden',
    } : {
      flex: '0 0 320px', width: 320, maxWidth: '100%', borderLeft: '1px solid var(--c-border)',
      display: 'flex', flexDirection: 'column', background: 'var(--c-panel)', minHeight: 0,
    }}>
      {isMobile && (
        <div style={{ display: 'grid', placeItems: 'center', padding: '8px 0 4px' }}>
          <span style={{ width: 38, height: 4, borderRadius: 99, background: 'var(--c-border)' }} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--c-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>
          <Icon name="sparkle" opts={{ stroke: LIME, sw: 2, size: 16 }} />
          {t(lang, 'magicEditor')}
        </div>
        <button onClick={onClose} aria-label={t(lang, 'close')} style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer' }}>
          <Icon name="x" opts={{ stroke: 'currentColor', sw: 2, size: 15 }} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, padding: 12, borderBottom: '1px solid var(--c-border)' }}>
        {([
          ['ai', t(lang, 'ai')],
          ['manual', t(lang, 'manual')],
        ] as const).map(([id, label]) => {
          const on = mode === id
          return (
            <button key={id} onClick={() => setMode(id)} style={{
              flex: 1, padding: '9px 10px', borderRadius: 11, border: '1px solid ' + (on ? 'transparent' : 'var(--c-border)'),
              background: on ? 'var(--c-btn-bg)' : 'var(--c-chip)', color: on ? 'var(--c-btn-fg)' : 'var(--c-text-2)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>{label}</button>
          )
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode === 'manual' ? (
          <>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--c-text-3)' }}>{t(lang, 'text')}</label>
            <textarea
              value={draft}
              onChange={(e) => apply(e.target.value)}
              rows={10}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical', borderRadius: 14,
                border: '1px solid var(--c-border)', background: 'var(--c-panel-2)', color: 'var(--c-text)',
                padding: 12, fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <p style={{ margin: 0, fontSize: 12, color: 'var(--c-text-3)', fontWeight: 500 }}>{t(lang, 'editsApplyHint')}</p>
          </>
        ) : (
          <>
            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--c-text-3)' }}>{t(lang, 'quickActions')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {AI_PRESETS.map((p) => (
                <button
                  key={p.id}
                  disabled={busy}
                  onClick={() => void runAi(p.instruction)}
                  style={{
                    padding: '8px 12px', borderRadius: 999, border: '1px solid var(--c-border)',
                    background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 12.5, fontWeight: 600,
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
                  }}
                >{p.label}</button>
              ))}
            </div>

            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--c-text-3)', marginTop: 6 }}>{t(lang, 'customPrompt')}</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t(lang, 'customPromptPh')}
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical', borderRadius: 14,
                border: '1px solid var(--c-border)', background: 'var(--c-panel-2)', color: 'var(--c-text)',
                padding: 12, fontSize: 13.5, lineHeight: 1.45, fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              disabled={busy || !prompt.trim()}
              onClick={() => void runAi(prompt)}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 14px', borderRadius: 12, border: 'none',
                background: busy || !prompt.trim() ? 'var(--c-chip)' : 'var(--c-btn-bg)',
                color: busy || !prompt.trim() ? 'var(--c-text-3)' : 'var(--c-btn-fg)',
                fontSize: 13.5, fontWeight: 700, cursor: busy || !prompt.trim() ? 'default' : 'pointer',
              }}
            >
              <Icon name="sparkle" opts={{ stroke: 'currentColor', sw: 2, size: 15 }} />
              {busy ? t(lang, 'rewriting') : t(lang, 'applyWithAi')}
            </button>

            <div style={{ marginTop: 4, padding: 12, borderRadius: 12, background: 'var(--c-chip)', border: '1px solid var(--c-border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(lang, 'current')}</div>
              <div style={{ fontSize: 13, color: 'var(--c-text-2)', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{draft || '—'}</div>
            </div>
          </>
        )}
        {err && <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: '#f87171' }}>{err}</p>}
      </div>
    </aside>
    </>
  )
}

export default function DeckEditor({ source }: { source: DocItem }) {
  const { backToDashboard, openCreate, lang } = useApp()
  const isMobile = useIsMobile()
  const deckId = source.deckId as string

  const [data, setData] = useState<EditorData | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [title, setTitle] = useState(source.title)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const canvasRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const paneRef = useRef<HTMLDivElement>(null)
  const activeThumbRef = useRef<HTMLButtonElement>(null)
  const idxRef = useRef(idx)
  idxRef.current = idx
  const wheelLock = useRef(false)
  const [pane, setPane] = useState({ w: 0, h: 0 })

  useEffect(() => {
    let alive = true
    fetchEditor(deckId, apiHeaders())
      .then((d) => { if (alive) { setData(d); setTitle(d.title || source.title) } })
      .catch((e) => { if (alive) setLoadErr(e instanceof Error ? e.message : t(lang, 'failedLoadDeck')) })
    return () => { alive = false }
  }, [deckId, source.title])

  useEffect(() => {
    const el = paneRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setPane({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [data])

  // Whenever the active slide changes (click, arrow-key nav, wheel scroll),
  // bring its thumbnail into view in the side list so users can always see
  // which slide is selected.
  useEffect(() => {
    const el = activeThumbRef.current
    if (!el) return
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [idx, data])

  useEffect(() => {
    // Wheel handler is on the PANE (the open slide area) only — so scrolling
    // over the thumbnail list scrolls the list normally, and only wheeling
    // over the slide itself flips to the next/previous slide (PowerPoint-like).
    const el = paneRef.current
    if (!el || !data) return
    const go = (delta: number) => {
      const next = Math.max(0, Math.min(data.slides.length - 1, idxRef.current + delta))
      if (next === idxRef.current) return
      setIdx(next)
      setSelectedId(null)
    }
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('textarea, input')) return
      if (Math.abs(e.deltaY) < 18) return
      e.preventDefault()
      if (wheelLock.current) return
      wheelLock.current = true
      go(e.deltaY > 0 ? 1 : -1)
      window.setTimeout(() => { wheelLock.current = false }, 420)
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('textarea, input')) return
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
    }
  }, [data])

  const onEdit = (id: string, text: string) => { setEdits((e) => ({ ...e, [id]: text })); setDirty(true) }

  const save = async () => {
    setSaving(true); setSaveErr(null)
    try {
      const r = await buildDeck(deckId, edits, apiHeaders())
      downloadPptx(r.pptxBase64, title || 'presentation')
      setDirty(false)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : t(lang, 'saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const savePdf = async () => {
    setPdfBusy(true); setSaveErr(null)
    try {
      const r = await buildDeckPdf(deckId, edits, apiHeaders())
      downloadPdf(r.pdfBase64, title || 'presentation')
      setDirty(false)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : t(lang, 'pdfExportFailed'))
    } finally {
      setPdfBusy(false)
    }
  }

  const shell = (children: ReactNode) => (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column',
      flex: 1, height: isMobile ? '100dvh' : '100%',
      width: '100%', maxWidth: '100%', minWidth: 0,
      background: 'var(--c-panel)', color: 'var(--c-text)',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: isMobile ? '8px 10px' : '10px 16px', borderBottom: '1px solid var(--c-border)', flexWrap: 'wrap', flexShrink: 0, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 auto' }}>
          <button onClick={backToDashboard} aria-label={t(lang, 'back2')} style={{ width: 36, height: 36, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer', flexShrink: 0 }}>
            <Icon name="arrowLeft" opts={{ stroke: 'currentColor', sw: 2, size: 16 }} />
          </button>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ minWidth: 0, flex: '1 1 120px', maxWidth: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid transparent', background: 'transparent', color: 'var(--c-text)', fontSize: 16, fontWeight: 700, outline: 'none' }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: dirty ? '#ff9f7a' : '#34c759' }}>
            {dirty ? t(lang, 'unsavedEdits') : <><Icon name="check" opts={{ stroke: '#34c759', sw: 2.6, size: 14 }} />{t(lang, 'upToDate')}</>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', fontSize: 12.5, fontWeight: 600, color: 'var(--c-text-2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: LIME }} />{t(lang, 'editablePptx')}
          </span>
          <button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Icon name="sparkle" opts={{ stroke: 'currentColor', sw: 2, size: 15 }} />{t(lang, 'newBtn')}
          </button>
          <button onClick={savePdf} disabled={pdfBusy || saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 13.5, fontWeight: 700, cursor: pdfBusy ? 'default' : 'pointer', opacity: pdfBusy ? 0.8 : 1 }}>
            {pdfBusy
              ? <><span style={{ width: 14, height: 14, borderRadius: 99, border: '2px solid currentColor', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin .7s linear infinite' }} />{t(lang, 'exporting')}</>
              : <><Icon name="download" opts={{ stroke: 'currentColor', sw: 2, size: 16 }} />{t(lang, 'downloadPdf')}</>}
          </button>
          <button onClick={save} disabled={saving || pdfBusy} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 12, border: 'none', background: '#1f9d57', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.8 : 1, boxShadow: '0 12px 22px -12px rgba(31,157,87,0.6)' }}>
            {saving
              ? <><span style={{ width: 14, height: 14, borderRadius: 99, border: '2px solid #fff', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin .7s linear infinite' }} />{t(lang, 'saving')}</>
              : <><Icon name="download" opts={{ stroke: 'currentColor', sw: 2, size: 16 }} />{t(lang, 'saveAsPptx')}</>}
          </button>
        </div>
      </div>
      {children}
    </div>
  )

  if (loadErr) {
    return shell(
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#f87171', margin: '0 0 8px' }}>{loadErr}</p>
          <p style={{ fontSize: 13.5, color: 'var(--c-text-3)', margin: '0 0 18px' }}>{t(lang, 'decksInMemory')}</p>
          <button onClick={openCreate} style={{ padding: '11px 20px', borderRadius: 13, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t(lang, 'generateNewDeck')}</button>
        </div>
      </div>,
    )
  }

  if (!data) {
    return shell(
      <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        <span style={{ width: 34, height: 34, borderRadius: 99, border: '3px solid var(--c-border)', borderTopColor: LIME, display: 'inline-block', animation: 'spin .7s linear infinite' }} />
      </div>,
    )
  }

  const ar = data.size.width / data.size.height
  let slideW = pane.w
  let slideH = slideW / ar
  if (slideH > pane.h && pane.h > 0) {
    slideH = pane.h
    slideW = slideH * ar
  }
  if (slideW > pane.w && pane.w > 0) {
    slideW = pane.w
    slideH = slideW / ar
  }
  const scale = data.size.width > 0 && slideW > 0 ? slideW / data.size.width : 0
  const slide = data.slides[idx]
  const bg = data.backgrounds[idx]
  const selectedText = selectedId ? slide.texts.find((t) => t.id === selectedId) : null
  const selectedValue = selectedId ? (edits[selectedId] ?? selectedText?.text ?? '') : ''

  return shell(
    <>
      {saveErr && <div style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, color: '#f87171', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>{saveErr}</div>}

      <div ref={stageRef} style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
        <div style={{
          flex: isMobile ? '0 0 auto' : '0 0 148px',
          width: isMobile ? '100%' : 148,
          // Explicit height so overflowY:auto has something to scroll against.
          // In a flex row, `align-self:stretch` (default) plus an internal `height:100%`
          // relative to the stage guarantees the thumbnail column is bounded and scrolls
          // its content instead of pushing the parent taller.
          height: isMobile ? 'auto' : '91vh',
          maxHeight: isMobile ? 96 : '100%',
          alignSelf: isMobile ? 'stretch' : 'stretch',
          borderRight: isMobile ? 'none' : '1px solid var(--c-border)',
          borderBottom: isMobile ? '1px solid var(--c-border)' : 'none',
          overflowY: isMobile ? 'hidden' : 'auto',
          overflowX: isMobile ? 'auto' : 'hidden',
          padding: isMobile ? '8px 10px' : '10px 8px',
          display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 8,
          background: 'var(--c-panel)', flexShrink: 0,
          minHeight: 0,
          boxSizing: 'border-box',
        }}>
          {!isMobile && (
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-3)', padding: '0 4px 2px' }}>
              {idx + 1}/{data.backgrounds.length}
            </div>
          )}
          {data.backgrounds.map((b, i) => {
            const on = i === idx
            return (
              <button
                key={i}
                ref={on ? activeThumbRef : undefined}
                onClick={() => { setIdx(i); setSelectedId(null) }}
                style={{
                  position: 'relative',
                  width: isMobile ? 128 : '100%',
                  height: isMobile ? 72 : undefined,
                  aspectRatio: isMobile ? undefined : `${data.size.width} / ${data.size.height}`,
                  borderRadius: 8, border: '2px solid ' + (on ? LIME : 'var(--c-border)'),
                  background: '#fff', cursor: 'pointer', padding: 0, overflow: 'hidden', flexShrink: 0,
                  boxShadow: on ? '0 0 0 3px rgba(205,240,63,0.22)' : 'none',
                }}
              >
                <img src={`data:image/svg+xml,${encodeURIComponent(b)}`} alt={`${t(lang, 'slidePfx')} ${i + 1}`} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                <span style={{ position: 'absolute', bottom: 4, left: 5, padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: on ? LIME : 'rgba(10,12,18,0.6)', color: on ? '#15200a' : '#fff' }}>{i + 1}</span>
              </button>
            )
          })}
        </div>

        <div
          ref={paneRef}
          style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'grid', placeItems: 'center', background: '#0a0c10' }}
          onClick={() => setSelectedId(null)}
        >
          <div
            ref={canvasRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: slideW > 0 ? slideW : '100%',
              height: slideH > 0 ? slideH : 'auto',
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            <img src={`data:image/svg+xml,${encodeURIComponent(bg)}`} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', userSelect: 'none', pointerEvents: 'none' }} />
            {scale > 0 && slide.texts.map((t) => (
              <OverlayText
                key={`${idx}-${t.id}`}
                t={t}
                size={data.size}
                scale={scale}
                text={edits[t.id] ?? t.text}
                selected={selectedId === t.id}
                onSelect={() => setSelectedId(t.id)}
              />
            ))}
          </div>
        </div>

        {selectedId && selectedText && (
          <MagicEditor
            textId={selectedId}
            value={selectedValue}
            onChange={onEdit}
            onClose={() => setSelectedId(null)}
            lang={lang}
          />
        )}
      </div>
    </>,
  )
}
