import { useApp } from '../context'
import { getProducts } from '../data/products'
import { t } from '../lib/i18n'
import type { TemplateCard as TCard } from '../types'

function Preview({ kind, c1, c2, c3 }: { kind: string; c1: string; c2: string; c3: string }) {
  const line = (w: string, o: number) => <div style={{ height: 7, width: w, borderRadius: 99, background: `rgba(31,42,68,${o})` }} />
  const panel: React.CSSProperties = { background: 'rgba(255,255,255,0.55)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.7)' }
  if (kind === 'chart') {
    return (
      <div style={{ display: 'flex', gap: 8, height: 92, alignItems: 'flex-end', padding: 10, ...panel }}>
        {[0.45, 0.7, 0.55, 0.95, 0.65].map((b, i) => <div key={i} style={{ width: '14%', height: `${b * 100}%`, borderRadius: '5px 5px 2px 2px', background: `linear-gradient(180deg, ${i % 2 ? c2 : c3}, ${c1})`, alignSelf: 'flex-end' }} />)}
      </div>
    )
  }
  if (kind === 'bullets') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, height: 92, justifyContent: 'center', padding: 12, ...panel }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 14, height: 14, borderRadius: 5, background: `linear-gradient(140deg, ${c2}, ${c3})`, flexShrink: 0 }} />
            <span style={{ height: 7, flex: 1, borderRadius: 99, background: 'rgba(31,42,68,0.12)' }} />
          </div>
        ))}
      </div>
    )
  }
  if (kind === 'split') {
    return (
      <div style={{ display: 'flex', gap: 8, height: 92 }}>
        <div style={{ flex: 1, borderRadius: 14, background: `linear-gradient(150deg, ${c2}, ${c3})` }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center', padding: 12, ...panel }}>
          {line('80%', 0.16)}{line('60%', 0.1)}{line('70%', 0.1)}
        </div>
      </div>
    )
  }
  return (
    <div style={{ height: 92, borderRadius: 14, background: `linear-gradient(135deg, ${c1}, ${c2} 55%, ${c3})`, display: 'flex', alignItems: 'flex-end', padding: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%' }}>
        <div style={{ height: 8, width: '55%', borderRadius: 99, background: 'rgba(255,255,255,0.85)' }} />
        <div style={{ height: 6, width: '38%', borderRadius: 99, background: 'rgba(255,255,255,0.55)' }} />
      </div>
    </div>
  )
}

export default function Templates() {
  const { product, lang } = useApp()
  const cfg = getProducts(lang)[product]
  return (
    <section id="templates" style={{ position: 'relative', zIndex: 4, marginTop: 120 }}>
      <div style={{ textAlign: 'center', marginBottom: 42 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: cfg.accent }}>{t(lang, 'templates')}</span>
        <h2 style={{ fontSize: 'clamp(28px,3.6vw,42px)', fontWeight: 700, letterSpacing: '-0.025em', margin: '10px 0 0', color: 'var(--c-on-bg)', textWrap: 'balance' } as React.CSSProperties}>{cfg.templatesHeading}</h2>
      </div>
      <div style={{ display: 'flex', gap: 20, overflowX: 'auto', padding: '6px 2px 18px', scrollSnapType: 'x mandatory' }}>
        {cfg.templates.map((tc: TCard) => (
          <div key={tc[0]} style={{ flex: '0 0 264px', scrollSnapAlign: 'start', borderRadius: 26, padding: 16, background: 'var(--c-panel)', backdropFilter: 'blur(20px)', border: '1px solid var(--c-border)', boxShadow: '0 26px 50px -32px rgba(31,42,68,0.42), inset 0 1px 0 rgba(255,255,255,0.12)', cursor: 'pointer' }}>
            <div style={{ borderRadius: 16, padding: 12, background: `linear-gradient(150deg, ${tc[2]}22, ${tc[4]}22)`, marginBottom: 14 }}>
              <Preview kind={tc[1]} c1={tc[2]} c2={tc[3]} c3={tc[4]} />
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--c-text)', padding: '0 4px' }}>{tc[0]}</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--c-text-3)', padding: '4px 4px 6px' }}>{cfg.templateMeta}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
