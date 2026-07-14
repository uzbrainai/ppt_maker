import { useApp } from '../context'
import { getProducts } from '../data/products'
import { Icon } from '../lib/icons'
import { t } from '../lib/i18n'

export default function Features() {
  const { product, lang } = useApp()
  const cfg = getProducts(lang)[product]
  const accent = cfg.accent
  return (
    <section id="features" style={{ position: 'relative', zIndex: 4, marginTop: 120 }}>
      <div style={{ textAlign: 'center', marginBottom: 42 }}>
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent }}>{t(lang, 'capabilities')}</span>
        <h2 style={{ fontSize: 'clamp(28px,3.6vw,42px)', fontWeight: 700, letterSpacing: '-0.025em', margin: '10px 0 0', color: 'var(--c-on-bg)', textWrap: 'balance' } as React.CSSProperties}>{cfg.featuresHeading}</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(238px,1fr))', gap: 20 }}>
        {cfg.features.map((f, i) => (
          <div key={i} style={{ borderRadius: 28, padding: 26, background: 'var(--c-panel)', backdropFilter: 'blur(20px)', border: '1px solid var(--c-border)', boxShadow: '0 26px 50px -30px rgba(31,42,68,0.4), inset 0 1px 0 rgba(255,255,255,0.12)' }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', background: `linear-gradient(140deg, ${accent}, ${accent}b3)`, boxShadow: `0 12px 22px -10px ${accent}88`, marginBottom: 18 }}>
              <Icon name={f[1]} opts={{ stroke: '#fff', sw: 2, size: 24 }} />
            </span>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--c-text)' }}>{f[2]}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--c-text-2)', margin: 0, fontWeight: 500 }}>{f[3]}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
