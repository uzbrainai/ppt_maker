import { useEffect, useRef, type CSSProperties } from 'react'
import { useApp } from '../context'
import { getProducts } from '../data/products'
import { iconSvg } from '../lib/icons'

const TR = 'opacity .45s ease, transform .45s ease'
const CHECK = iconSvg('check', { stroke: '#cdf03f', sw: 3.5, size: 9 })

function anim(idx: number, hide: string, style: CSSProperties) {
  return { 'data-rv': idx, 'data-hide': hide, style: { ...style, opacity: 0, transform: hide, transition: TR } }
}
function Svg({ html }: { html: string }) {
  return <span style={{ display: 'grid', placeItems: 'center' }} dangerouslySetInnerHTML={{ __html: html }} />
}

export default function LiveWorkflow() {
  const { product, lang } = useApp()
  const cfg = getProducts(lang)[product]
  const ref = useRef<HTMLDivElement>(null)
  const stepRef = useRef(0)

  useEffect(() => {
    stepRef.current = 0
    const HOLD = 9, BEAT = 300
    const apply = () => {
      const host = ref.current
      if (!host) return
      const nodes = host.querySelectorAll<HTMLElement>('[data-rv]')
      let maxIdx = 0
      nodes.forEach((el) => { maxIdx = Math.max(maxIdx, Number(el.getAttribute('data-rv'))) })
      const total = maxIdx + 1
      if (stepRef.current > total + HOLD) stepRef.current = 0
      const reveal = Math.min(stepRef.current, total)
      nodes.forEach((el) => {
        const show = reveal > Number(el.getAttribute('data-rv'))
        el.style.opacity = show ? '1' : '0'
        el.style.transform = show ? 'none' : (el.getAttribute('data-hide') || 'translateY(8px)')
      })
    }
    apply()
    const timer = window.setInterval(() => { stepRef.current += 1; apply() }, BEAT)
    return () => clearInterval(timer)
  }, [product, lang])

  const steps = cfg.flow.map((f) => ({ icon: iconSvg(f[0]), title: f[1], desc: f[2], time: f[3], status: f[4], trigger: f[5] }))
  const rail: React.ReactNode[] = []
  const col: React.ReactNode[] = []

  steps.forEach((st, s) => {
    const base = s * 5
    const last = s === steps.length - 1
    rail.push(<span key={'dot' + s} {...anim(base + 0, 'scale(0.3)', { width: 13, height: 13, borderRadius: 99, flexShrink: 0, background: last ? '#b9c4dc' : '#cdf03f', border: '2px solid #fff', boxShadow: last ? 'none' : '0 0 0 2px rgba(165,200,40,0.4)' })} />)
    if (!last) rail.push(<span key={'line' + s} {...anim(base + 4, 'scaleY(0.15)', { flex: 1, width: 0, borderLeft: '2px dotted #c3cde0', margin: '6px 0', transformOrigin: 'top' })} />)

    col.push(
      <div key={'card' + s} {...anim(base + 1, 'translateY(10px) scale(0.98)', { display: 'flex', alignItems: 'center', gap: 13, padding: 13, borderRadius: 18, background: last ? 'linear-gradient(120deg,rgba(205,240,63,0.14),var(--c-panel-2))' : 'var(--c-panel-2)', border: last ? '1px solid rgba(165,200,40,0.3)' : '1px solid var(--c-border)', boxShadow: '0 10px 22px -16px rgba(31,42,68,0.4)' })}>
        <div {...anim(base + 2, 'scale(0.5)', { width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'grid', placeItems: 'center', background: '#1f2a44', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)' })}><Svg html={st.icon} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div {...anim(base + 3, 'translateX(-6px)', { fontSize: 14.5, fontWeight: 700, color: 'var(--c-text)' })}>{st.title}</div>
          <div {...anim(base + 4, 'translateX(-6px)', { fontSize: 12.5, color: 'var(--c-text-3)', lineHeight: 1.35 })}>{st.desc}</div>
        </div>
        <div {...anim(base + 4, 'translateY(4px)', { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7, flexShrink: 0 })}>
          <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>{st.time}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px 4px 5px', borderRadius: 999, background: '#cdf03f', color: '#15200a', fontSize: 11, fontWeight: 700 }}>
            <span style={{ width: 15, height: 15, borderRadius: 99, background: '#15200a', display: 'grid', placeItems: 'center' }}><Svg html={CHECK} /></span>{st.status}
          </span>
        </div>
      </div>,
    )
    if (st.trigger) col.push(
      <div key={'trig' + s} {...anim(base + 4, 'translateX(-6px)', { display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 8 })}>
        <span style={{ width: 5, height: 5, borderRadius: 99, background: '#c0cade' }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--c-text-3)', fontStyle: 'italic' }}>{st.trigger}</span>
      </div>,
    )
  })

  return (
    <div ref={ref} style={{ display: 'flex', gap: 14 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 18 }}>{rail}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>{col}</div>
    </div>
  )
}
