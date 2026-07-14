import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context'
import { iconSvg } from '../lib/icons'
import { t } from '../lib/i18n'

const LIME = '#cdf03f'
const CHECK = iconSvg('check', { stroke: '#15200a', sw: 3.5, size: 10 })

export const GEN_STEP_KEYS = ['stepPlanning', 'stepResearch', 'stepWriting', 'stepDesign', 'stepBuild']
const STEP_PCT = [10, 28, 52, 80, 94]

/** Map a backend progress message to a stage index (0..GEN_STEP_KEYS.length-1). */
export function mapStage(msg: string): number {
  const m = msg.toLowerCase()
  if (/expand|illustrat|image|build|export|compil/.test(m)) return 4
  if (/design agent|design:/.test(m)) return 3
  if (/content agent|writing|content:/.test(m)) return 2
  if (/research/.test(m)) return 1
  if (/storyboard|planning|starting/.test(m)) return 0
  return 0
}

export default function GenProgress({ stage, done, label }: { stage: number; done: boolean; label?: string }) {
  const { lang } = useApp()
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const pRef = useRef(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    const iv = window.setInterval(() => {
      if (startRef.current === null) startRef.current = performance.now()
      setElapsed(Math.floor((performance.now() - startRef.current) / 1000))
      const target = done ? 100 : STEP_PCT[Math.min(stage, STEP_PCT.length - 1)]
      pRef.current = Math.max(pRef.current, Math.min(target, pRef.current + Math.max(0.2, (target - pRef.current) * 0.06)))
      if (done) pRef.current = 100
      setProgress(Math.round(pRef.current))
    }, 200)
    return () => window.clearInterval(iv)
  }, [stage, done])

  const activeStep = done ? GEN_STEP_KEYS.length : stage

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'fadeUp .4s ease both', minHeight: 320 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', justifyContent: 'center', gap: 40, width: '100%' }}>
        <div style={{ flex: '0 0 240px', maxWidth: '100%', display: 'grid', placeItems: 'center' }}>
          <ProgressRing progress={progress} size={240} sub={t(lang, 'secElapsed', { n: elapsed })} />
        </div>
        <div style={{ flex: '1 1 280px', minWidth: 240, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
          {GEN_STEP_KEYS.map((key, i) => {
            const isDone = i < activeStep
            const active = i === activeStep
            const last = i === GEN_STEP_KEYS.length - 1
            const connColor = isDone || active ? LIME : '#c3cde0'
            return (
              <div key={key} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center', background: isDone || active ? LIME : 'transparent', border: '2px solid ' + (isDone || active ? LIME : 'var(--c-border)'), boxShadow: active ? '0 0 0 5px rgba(205,240,63,0.22)' : 'none', animation: active ? 'pulseDot 1.3s infinite' : 'none', transition: 'background .3s, border-color .3s' }}>
                    {isDone ? <span style={{ display: 'grid', placeItems: 'center' }} dangerouslySetInnerHTML={{ __html: CHECK }} /> : null}
                  </span>
                  {!last && (
                    <span style={{ flex: 1, width: 3, minHeight: 18, margin: '5px 0', borderRadius: 2, backgroundImage: `repeating-linear-gradient(180deg, ${connColor} 0 7px, transparent 7px 14px)`, backgroundRepeat: 'repeat-y', opacity: isDone || active ? 1 : 0.55, animation: active ? 'flowDash .7s linear infinite' : 'none', transition: 'opacity .3s' }} />
                  )}
                </div>
                <div style={{ paddingTop: 2, paddingBottom: 10 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: isDone || active ? 'var(--c-text)' : 'var(--c-text-3)', transition: 'color .3s' }}>{t(lang, key)}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: active ? '#aacb2e' : 'var(--c-text-3)', marginTop: 2 }}>{isDone ? t(lang, 'stepDone') : active ? t(lang, 'stepInProgress') : t(lang, 'stepPending')}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {label ? <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--c-text-3)', fontWeight: 500, textAlign: 'center', maxWidth: 520 }}>{label}</div> : null}
    </div>
  )
}

export function ProgressRing({ progress, size = 240, sub }: { progress: number; size?: number; sub?: string }) {
  const { lang } = useApp()
  const sw = Math.round(size * 0.085)
  const c = size / 2
  const r = c - sw
  const C = 2 * Math.PI * r
  const subText = sub ?? t(lang, 'generatingCap')
  return (
    <div style={{ position: 'relative', width: size, height: size, maxWidth: '100%' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: '100%', height: 'auto' }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--c-chip)" strokeWidth={sw} />
        <circle cx={c} cy={c} r={r} fill="none" stroke={LIME} strokeWidth={sw} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress / 100)} transform={`rotate(-90 ${c} ${c})`} style={{ transition: 'stroke-dashoffset .25s linear', filter: 'drop-shadow(0 0 10px rgba(205,240,63,0.55))' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
        <span style={{ fontSize: Math.round(size * 0.21), fontWeight: 800, color: 'var(--c-text)', letterSpacing: '-0.02em' }}>{progress}%</span>
        <span style={{ fontSize: Math.max(10, Math.round(size * 0.05)), fontWeight: 600, color: 'var(--c-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{subText}</span>
      </div>
    </div>
  )
}
