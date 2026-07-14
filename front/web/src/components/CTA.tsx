import { useApp } from '../context'
import { getProducts } from '../data/products'

export default function CTA() {
  const { product, openAuth, lang } = useApp()
  const cfg = getProducts(lang)[product]
  return (
    <section style={{ position: 'relative', zIndex: 4, marginTop: 130 }}>
      <div style={{ position: 'relative', borderRadius: 38, padding: '72px 32px', overflow: 'hidden', background: 'var(--c-panel)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid var(--c-border)', boxShadow: '0 50px 90px -40px rgba(31,42,68,0.5),inset 0 1px 0 rgba(255,255,255,0.12)', textAlign: 'center' }}>
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 620, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(30px,4.4vw,52px)', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0 0 18px', color: 'var(--c-text)', textWrap: 'balance' } as React.CSSProperties}>{cfg.ctaHeading}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--c-text-2)', margin: '0 0 32px', fontWeight: 500 }}>{cfg.ctaSub}</p>
          <button onClick={() => openAuth('signup')} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '17px 32px', borderRadius: 999, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 16, fontWeight: 600, cursor: 'pointer', boxShadow: '0 22px 38px -14px rgba(25,35,62,0.7),0 2px 0 rgba(0,0,0,0.15),inset 0 1px 0 rgba(255,255,255,0.14)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>{cfg.ctaBtn}
          </button>
        </div>
      </div>
    </section>
  )
}
