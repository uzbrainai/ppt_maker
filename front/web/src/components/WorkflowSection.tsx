import { useApp } from '../context'
import { getProducts } from '../data/products'
import { t } from '../lib/i18n'

export default function WorkflowSection() {
  const { product, lang } = useApp()
  const cfg = getProducts(lang)[product]
  return (
    <section id="workflow" style={{ position: 'relative', zIndex: 4, marginTop: 120 }}>
      <div style={{ textAlign: 'center', marginBottom: 46 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: cfg.accent }}>{t(lang, 'workflow')}</span>
        <h2 style={{ fontSize: 'clamp(28px,3.6vw,42px)', fontWeight: 700, letterSpacing: '-0.025em', margin: '10px 0 0', color: 'var(--c-on-bg)', textWrap: 'balance' } as React.CSSProperties}>{cfg.workflowHeading}</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 20 }}>
        {cfg.workflow.map((w) => (
          <div key={w[0]} style={{ borderRadius: 26, padding: 26, background: 'var(--c-panel)', backdropFilter: 'blur(20px)', border: '1px solid var(--c-border)', boxShadow: '0 24px 46px -30px rgba(31,42,68,0.4), inset 0 1px 0 rgba(255,255,255,0.12)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: cfg.accent, marginBottom: 16 }}>{w[0]}</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 7px' }}>{w[1]}</h3>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--c-text-2)', margin: 0, fontWeight: 500 }}>{w[2]}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
