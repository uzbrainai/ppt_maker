import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../lib/icons'
import { BRAND, BRAND_ASSETS, brandAssetUrl } from '../lib/brand'
import { productHref } from '../data/products'

/** Theme-colored logo via CSS mask (picks up --c-logo). Pass `color` to override. */
export function Logo({ file = BRAND_ASSETS.mark, w, h, color = 'var(--c-logo)' }: { file?: string; w: number; h: number; color?: string }) {
  return (
    <span
      role="img"
      aria-label={BRAND.name}
      style={{
        width: w, height: h, flexShrink: 0, display: 'inline-block', background: color,
        WebkitMask: `url('${brandAssetUrl(file)}') center/contain no-repeat`,
        mask: `url('${brandAssetUrl(file)}') center/contain no-repeat`,
      }}
    />
  )
}

/** Full-color mark (white slides + lime spark) — auth, footer, dark panels. */
export function LogoColor({ w, h }: { w: number; h: number }) {
  return (
    <img
      src={brandAssetUrl(BRAND_ASSETS.markColor)}
      alt={BRAND.name}
      width={w}
      height={h}
      style={{ width: w, height: h, flexShrink: 0, display: 'block', objectFit: 'contain' }}
    />
  )
}

export function Brand({ color, onClick, size = 36, colored }: { color?: string; onClick?: () => void; size?: number; colored?: boolean }) {
  return (
    <a
      href={productHref('ppt')}
      onClick={(e) => { if (onClick) { e.preventDefault(); onClick() } }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
    >
      {colored ? <LogoColor w={size} h={size} /> : <Logo w={size} h={size} color={color || 'var(--c-logo)'} />}
      <span style={{ fontWeight: 800, fontSize: size >= 40 ? 20 : 17, letterSpacing: '-0.03em', color: color || 'var(--c-text)', whiteSpace: 'nowrap' }}>
        Make <span style={{ color: '#9fbf2a' }}>PPT</span>
      </span>
    </a>
  )
}

/** Full wordmark for dark backdrop (hero/footer) with lime spark mark. */
export function BrandOnDark() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <LogoColor w={36} h={36} />
      <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.03em', color: 'var(--c-on-bg)' }}>
        {BRAND.name.split(' ')[0]} <span style={{ color: '#cdf03f' }}>PPT</span>
      </span>
    </span>
  )
}

/** Full-screen overlay. `solid` => opaque themed app surface (Profile/Editor),
 *  scrolls internally so no scrollbar appears on the overlay itself; `glassy`
 *  modal (auth/pricing) still scrolls when content exceeds viewport.
 *  Locks body scroll while open so the underlying landing page's scrollbar
 *  doesn't leak through on the right edge. */
export function Overlay({ open, solid, children }: { open: boolean; solid?: boolean; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        overflow: solid ? 'hidden' : 'auto',
        background: solid ? 'var(--c-overlay)' : 'var(--c-overlay-soft)',
        backdropFilter: solid ? 'none' : 'blur(8px)', WebkitBackdropFilter: solid ? 'none' : 'blur(8px)',
        opacity: open ? 1 : 0, visibility: open ? 'visible' : 'hidden', transition: 'opacity .25s ease, visibility .25s ease',
      }}
    >
      {open ? children : null}
    </div>
  )
}

export function PrimaryButton({ label, onClick, icon, style }: { label: string; onClick?: () => void; icon?: string; style?: CSSProperties }) {
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 13, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14, fontWeight: 600, cursor: 'pointer', boxShadow: '0 12px 22px -12px rgba(25,35,62,0.6)', ...style }}>
      {icon ? <Icon name={icon} opts={{ stroke: 'currentColor', sw: 2.2, size: 16 }} /> : null}
      {label}
    </button>
  )
}

export function IconButton({ name, onClick, label, ariaLabel }: { name: string; onClick?: () => void; label?: string; ariaLabel?: string }) {
  return (
    <button onClick={onClick} aria-label={ariaLabel || label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: label ? '9px 14px' : 0, width: label ? 'auto' : 38, height: 38, justifyContent: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
      <Icon name={name} opts={{ stroke: 'currentColor', sw: 2, size: 16 }} />
      {label || null}
    </button>
  )
}
