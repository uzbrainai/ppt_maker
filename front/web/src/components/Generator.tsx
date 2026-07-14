import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context'
import { getProducts, PRODUCT_IDS, productHref } from '../data/products'
import { Icon, iconSvg } from '../lib/icons'
import { t } from '../lib/i18n'
import type { Tier } from '../types'

const chipHues = ['rgba(120,90,220,0.4)', 'rgba(90,150,230,0.4)', 'rgba(240,140,180,0.4)', 'rgba(255,160,110,0.4)']
const LIME = '#cdf03f'
const CHECK = iconSvg('check', { stroke: '#15200a', sw: 3.5, size: 10 })

type Phase = 'form' | 'gen' | 'result'

const SLIDE_IMAGES = ['slide-1.png', 'slide-2.png', 'slide-3.png', 'slide-4.png', 'slide-5.png'].map(f => `${(import.meta as any).env.BASE_URL}slides/${f}`)

export default function Generator() {
  const { product, goProduct, openAuth, lang } = useApp()
  const products = getProducts(lang)
  const cfg = products[product]
  const accent = cfg.accent

  const TIERS: { id: Tier; label: string; icon?: string }[] = [
    { id: 'general', label: t(lang, 'tierGeneral') },
    { id: 'premium', label: t(lang, 'tierPremium'), icon: 'sparkle' },
  ]
  const GEN_STEPS = [t(lang, 'genStep1'), t(lang, 'genStep2'), t(lang, 'genStep3'), t(lang, 'genStep4')]

  const ref = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(false)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { setRevealed(true); setInView(true) } else { setInView(false) }
    }), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const rv = (i: number): React.CSSProperties => revealed
    ? { animation: 'revealUp .5s ease both', animationDelay: `${0.05 + i * 0.08}s` }
    : { opacity: 0 }

  const [phase, setPhase] = useState<Phase>('form')
  const [typed, setTyped] = useState(0)
  const [fieldsDone, setFieldsDone] = useState(0)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [tierOn, setTierOn] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [progress, setProgress] = useState(0)
  const [genStep, setGenStep] = useState(0)
  const [slide, setSlide] = useState(0)
  const promptText = cfg.promptText
  const fieldCount = cfg.fields.length

  useEffect(() => {
    if (!inView) return
    let alive = true
    const timers: number[] = []
    const wait = (ms: number) => new Promise<void>((res) => { timers.push(window.setTimeout(res, ms)) })
    const loop = async () => {
      while (alive) {
        setPhase('form'); setTyped(0); setFieldsDone(0); setActiveIdx(-1); setTierOn(false); setPressed(false)
        await wait(450); if (!alive) return
        for (let i = 1; i <= promptText.length; i++) { if (!alive) return; setTyped(i); await wait(22) }
        await wait(400); if (!alive) return
        for (let f = 0; f < fieldCount; f++) { if (!alive) return; setActiveIdx(f); await wait(560); setFieldsDone(f + 1) }
        setActiveIdx(-1); await wait(220); if (!alive) return
        setTierOn(true); await wait(650); if (!alive) return
        setPressed(true); await wait(280); if (!alive) return; setPressed(false); await wait(150)
        setPhase('gen'); setGenStep(0); setProgress(0)
        let p = 0
        for (let s = 0; s < GEN_STEPS.length; s++) {
          if (!alive) return
          setGenStep(s)
          const target = Math.round(((s + 1) / GEN_STEPS.length) * 100)
          while (p < target) { if (!alive) return; p = Math.min(target, p + 2); setProgress(p); await wait(45) }
          await wait(520)
        }
        await wait(550); if (!alive) return
        setPhase('result'); setSlide(0)
        for (let i = 0; i < SLIDE_IMAGES.length; i++) { if (!alive) return; setSlide(i); await wait(1700) }
        await wait(500)
      }
    }
    void loop()
    return () => { alive = false; timers.forEach(clearTimeout) }
  }, [inView, product, promptText, fieldCount, lang])

  const demoTier: Tier = tierOn ? 'premium' : 'general'
  const fieldValue = (v: string | string[]) => (Array.isArray(v) ? v[0] : v)

  return (
    <section ref={ref} id="create" style={{ position: 'relative', zIndex: 4, marginTop: 150, scrollMarginTop: 90 }}>
      <div style={{ textAlign: 'center', marginBottom: 30, ...rv(0) }}>
        <h2 style={{ fontSize: 'clamp(26px,3.4vw,38px)', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 10px', color: 'var(--c-on-bg)' }}>{t(lang, 'generatorHeading')}</h2>
        <p style={{ fontSize: 16, color: 'var(--c-on-bg-2)', margin: 0, fontWeight: 500 }}>{t(lang, 'generatorSub')}</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginBottom: 24, ...rv(1) }}>
        {PRODUCT_IDS.map((id) => {
          const on = id === product
          const c = products[id]
          return (
            <a key={id} href={productHref(id)} onClick={(e) => { e.preventDefault(); goProduct(id) }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 18px', borderRadius: 999, border: '1px solid ' + (on ? 'transparent' : 'var(--c-border)'), background: on ? 'var(--c-btn-bg)' : 'var(--c-chip)', color: on ? 'var(--c-btn-fg)' : 'var(--c-text-2)', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: on ? '0 12px 22px -10px rgba(26,36,64,0.6)' : 'none', textDecoration: 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: c.accent }} />{c.tab}
            </a>
          )
        })}
      </div>

      <div style={{ maxWidth: 1056, margin: '0 auto', borderRadius: 30, padding: 28, background: 'var(--c-panel)', backdropFilter: 'blur(26px)', WebkitBackdropFilter: 'blur(26px)', border: '1px solid var(--c-border)', boxShadow: '0 36px 70px -34px rgba(31,42,68,0.42),inset 0 1px 0 rgba(255,255,255,0.12)' }}>
        <div style={{ minHeight: 542, display: 'flex', flexDirection: 'column' }}>
          {phase === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ borderRadius: 20, background: 'var(--c-input)', border: '1px solid var(--c-chip)', boxShadow: 'inset 0 2px 10px rgba(31,42,68,0.05)', padding: 20, minHeight: 118, ...rv(2) }}>
                <p style={{ margin: 0, fontSize: 16.5, lineHeight: 1.5, color: 'var(--c-text-3)', fontWeight: 500 }}>
                  {promptText.slice(0, typed)}
                  <span style={{ display: 'inline-block', width: 2, height: 18, background: accent, marginLeft: 2, verticalAlign: -3, animation: 'pulseDot 1.1s infinite' }} />
                </p>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16, ...rv(3) }}>
                {cfg.fields.map((f, i) => {
                  const shown = i < fieldsDone || i === activeIdx
                  const active = i === activeIdx
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 140px', minWidth: 120 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f[0]}</label>
                      <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid ' + (active ? accent : 'var(--c-chip)'), background: 'var(--c-input)', color: shown ? 'var(--c-text)' : 'var(--c-text-3)', fontSize: 13.5, fontWeight: 500, minHeight: '1.25em', boxShadow: active ? `0 0 0 3px ${accent}33` : 'none', transform: active ? 'translateY(-1px)' : 'none', transition: 'border-color .25s, box-shadow .25s, transform .25s' }}>
                        <span style={{ opacity: shown ? 1 : 0, transition: 'opacity .3s ease' }}>{fieldValue(f[1])}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 14, ...rv(4) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)' }}>{t(lang, 'generation')}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--c-text-3)' }}>{demoTier === 'premium' ? t(lang, 'tierPremiumHint') : t(lang, 'tierGeneralHint')}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 14, background: 'var(--c-chip)', border: '1px solid var(--c-border)' }}>
                  {TIERS.map((tr) => {
                    const on = tr.id === demoTier
                    return (
                      <div key={tr.id} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 14px', borderRadius: 11, border: '1px solid ' + (on ? 'transparent' : 'var(--c-border)'), background: on ? 'var(--c-btn-bg)' : 'transparent', color: on ? 'var(--c-btn-fg)' : 'var(--c-text-2)', fontSize: 13.5, fontWeight: 700, transition: 'background .35s ease, color .35s ease' }}>
                        {tr.icon ? <Icon name={tr.icon} opts={{ stroke: 'currentColor', sw: 2, size: 15 }} /> : null}{tr.label}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16, ...rv(5) }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-3)', letterSpacing: '0.01em' }}>{t(lang, 'uploadTitle')} <span style={{ fontWeight: 500, opacity: 0.75 }}>{t(lang, 'optional')}</span></span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {cfg.uploads.map((u, i) => (
                      <button key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 13, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
                        <Icon name={u[2]} opts={{ stroke: u[1], sw: 2, size: 15 }} />{u[0]}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => openAuth('signup')} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 22px', borderRadius: 14, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', transform: pressed ? 'scale(0.94)' : 'none', boxShadow: pressed ? `0 0 0 4px ${accent}55, 0 14px 24px -12px rgba(25,35,62,0.65)` : '0 14px 24px -12px rgba(25,35,62,0.65),inset 0 1px 0 rgba(255,255,255,0.14)', transition: 'transform .18s ease, box-shadow .18s ease' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>{cfg.generateLabel}
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--c-chip)', ...rv(6) }}>
                {cfg.categories.map((l, i) => (
                  <button key={l} style={{ padding: '9px 16px', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text-2)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', borderColor: chipHues[i % chipHues.length] }}>{l}</button>
                ))}
              </div>
            </div>
          )}

          {phase === 'gen' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeUp .4s ease both' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'center', gap: 40, height: 346, width: '100%' }}>
                <div style={{ flex: '0 0 346px', maxWidth: '100%', display: 'grid', placeItems: 'center' }}>
                  <ProgressRing progress={progress} size={346} genLabel={t(lang, 'generatingCap')} />
                </div>
                <div style={{ flex: '1 1 300px', minWidth: 260, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {GEN_STEPS.map((s, i) => {
                    const done = i < genStep
                    const active = i === genStep
                    const last = i === GEN_STEPS.length - 1
                    const connColor = done || active ? LIME : '#c3cde0'
                    return (
                      <div key={s} style={{ display: 'flex', gap: 14, alignItems: 'stretch', flex: last ? '0 0 auto' : 1 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ width: 26, height: 26, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center', background: done || active ? LIME : 'transparent', border: '2px solid ' + (done || active ? LIME : 'var(--c-border)'), boxShadow: active ? '0 0 0 5px rgba(205,240,63,0.22)' : 'none', animation: active ? 'pulseDot 1.3s infinite' : 'none', transition: 'background .3s, border-color .3s' }}>
                            {done ? <span style={{ display: 'grid', placeItems: 'center' }} dangerouslySetInnerHTML={{ __html: CHECK }} /> : null}
                          </span>
                          {!last && (
                            <span style={{ flex: 1, width: 3, minHeight: 22, margin: '5px 0', borderRadius: 2, backgroundImage: `repeating-linear-gradient(180deg, ${connColor} 0 7px, transparent 7px 14px)`, backgroundRepeat: 'repeat-y', opacity: done || active ? 1 : 0.55, animation: active ? 'flowDash .7s linear infinite' : 'none', transition: 'opacity .3s' }} />
                          )}
                        </div>
                        <div style={{ paddingTop: 2 }}>
                          <div style={{ fontSize: 14.5, fontWeight: 600, color: done || active ? 'var(--c-text)' : 'var(--c-text-3)', transition: 'color .3s' }}>{s}</div>
                          <div style={{ fontSize: 11.5, fontWeight: 500, color: active ? '#aacb2e' : 'var(--c-text-3)', marginTop: 2 }}>{done ? t(lang, 'stepDone') : active ? t(lang, 'stepInProgress') : t(lang, 'stepPending')}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {phase === 'result' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'fadeUp .4s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 13px 6px 7px', borderRadius: 999, background: 'rgba(205,240,63,0.18)', border: '1px solid rgba(165,200,40,0.4)', fontSize: 12.5, fontWeight: 700, color: '#aacb2e' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 99, background: LIME, display: 'grid', placeItems: 'center' }} dangerouslySetInnerHTML={{ __html: CHECK }} />
                  {t(lang, 'deckReady')}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--c-text-3)', fontWeight: 600 }}>{t(lang, 'slide')} {slide + 1} / {SLIDE_IMAGES.length}</span>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', borderRadius: 18, WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 7%, #000 93%, transparent 100%)', maskImage: 'linear-gradient(90deg, transparent 0, #000 7%, #000 93%, transparent 100%)' }}>
                <div style={{ display: 'flex', height: '100%', transform: `translateX(-${slide * 100}%)`, transition: 'transform .6s cubic-bezier(.22,.61,.36,1)' }}>
                  {SLIDE_IMAGES.map((src, i) => (
                    <div key={i} style={{ flex: '0 0 100%', height: '100%', display: 'grid', placeItems: 'center', padding: '0 6px', boxSizing: 'border-box' }}>
                      <img src={src} alt={`${t(lang, 'slide')} ${i + 1}`} loading="lazy" style={{ maxWidth: '100%', maxHeight: '100%', width: '100%', objectFit: 'contain', borderRadius: 14, boxShadow: '0 26px 54px -28px rgba(0,0,0,0.55)' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 14 }}>
                {SLIDE_IMAGES.map((_, i) => (
                  <span key={i} style={{ width: i === slide ? 22 : 7, height: 7, borderRadius: 99, background: i === slide ? accent : 'var(--c-border)', transition: 'all .35s ease' }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ProgressRing({ progress, size = 136, genLabel = 'GENERATING' }: { progress: number; size?: number; genLabel?: string }) {
  const sw = Math.round(size * 0.085)
  const c = size / 2, r = c - sw
  const C = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, maxWidth: '100%' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: '100%', height: 'auto' }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--c-chip)" strokeWidth={sw} />
        <circle cx={c} cy={c} r={r} fill="none" stroke={LIME} strokeWidth={sw} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress / 100)} transform={`rotate(-90 ${c} ${c})`} style={{ transition: 'stroke-dashoffset .12s linear', filter: 'drop-shadow(0 0 10px rgba(205,240,63,0.55))' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <span style={{ fontSize: Math.round(size * 0.21), fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>{progress}%</span>
        <span style={{ fontSize: Math.max(10, Math.round(size * 0.045)), fontWeight: 600, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{genLabel}</span>
      </div>
    </div>
  )
}
