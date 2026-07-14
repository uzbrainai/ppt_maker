import { useApp } from '../context'
import { getProducts } from '../data/products'
import { t } from '../lib/i18n'
import LiveWorkflow from './LiveWorkflow'

export default function Hero() {
  const { product, openAuth, lang } = useApp()
  const cfg = getProducts(lang)[product]
  return (
    <header style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', gap: 48, alignItems: 'center', marginTop: 64, minHeight: 560 }}>
      <div style={{ position: 'relative', zIndex: 3, flex: '1 1 480px', minWidth: 320, animation: 'fadeUp .8s ease both' }}>
        <h1 style={{ fontSize: 'clamp(42px,6.2vw,70px)', lineHeight: 1.0, letterSpacing: '-0.025em', fontWeight: 700, margin: '0 0 22px', color: 'var(--c-on-bg)', textWrap: 'balance' } as React.CSSProperties}>
          {cfg.titleLead}<span style={{ color: 'var(--c-on-bg)' }}>{cfg.titleEmph}</span>
        </h1>
        <p style={{ fontSize: 'clamp(16px,1.5vw,19px)', lineHeight: 1.55, color: 'var(--c-on-bg-2)', maxWidth: 480, margin: '0 0 32px', fontWeight: 500 }}>{cfg.subtitle}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          <button onClick={() => openAuth('signup')} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '15px 26px', borderRadius: 999, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 15.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 18px 30px -12px rgba(25,35,62,0.7),0 2px 0 rgba(0,0,0,0.15),inset 0 1px 0 rgba(255,255,255,0.14)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z" /></svg>
            {cfg.primaryBtn}
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '15px 24px', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', backdropFilter: 'blur(10px)', color: 'var(--c-text)', fontSize: 15.5, fontWeight: 600, cursor: 'pointer' }}>{t(lang, 'viewTemplates')}</button>
        </div>
        <p style={{ margin: '22px 0 0', fontSize: 13.5, fontWeight: 500, color: 'var(--c-on-bg-3)', letterSpacing: '0.01em' }}>{cfg.footline}</p>
      </div>

      <div style={{ position: 'relative', zIndex: 3, flex: '1 1 460px', minWidth: 320, animation: 'fadeUp 1s ease both' }}>
        <div style={{ position: 'relative', borderRadius: 30, padding: 22, background: 'var(--c-panel)', backdropFilter: 'blur(26px)', WebkitBackdropFilter: 'blur(26px)', border: '1px solid var(--c-border)', boxShadow: '0 40px 80px -36px rgba(31,42,68,0.5),inset 0 1px 0 rgba(255,255,255,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, padding: '0 4px' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--c-text-3)', marginBottom: 3 }}>{t(lang, 'live')}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text)' }}>{cfg.flowTitle}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, background: 'rgba(205,240,63,0.22)', border: '1px solid rgba(165,200,40,0.35)' }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: '#7fa015', animation: 'pulseDot 1.6s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#cce95f' }}>{t(lang, 'generating')}</span>
            </div>
          </div>
          <LiveWorkflow />
        </div>
      </div>
    </header>
  )
}
