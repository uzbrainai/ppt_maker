import { useApp } from '../context'
import { productHref } from '../data/products'
import { pageHref } from '../lib/routes'
import { t } from '../lib/i18n'
import { BrandOnDark } from './ui'
import { BRAND } from '../lib/brand'

export default function Footer() {
  const { openPricing, openSupport, goProduct, lang } = useApp()
  const link = { fontSize: 14, fontWeight: 500, color: 'var(--c-on-bg-2)', textDecoration: 'none' } as React.CSSProperties
  return (
    <footer id="footer" style={{ position: 'relative', zIndex: 4, marginTop: 90, paddingTop: 36, borderTop: '1px solid var(--c-border)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'space-between' }}>
        <a href={productHref('ppt')} onClick={(e) => { e.preventDefault(); goProduct('ppt') }} style={{ textDecoration: 'none' }}>
          <BrandOnDark />
        </a>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 26 }}>
          <a href="#features" style={link}>{t(lang, 'productFoot')}</a>
          <a href="#templates" style={link}>{t(lang, 'templatesFoot')}</a>
          <a href={pageHref('pricing')} onClick={(e) => { e.preventDefault(); openPricing() }} style={{ ...link, cursor: 'pointer' }}>{t(lang, 'pricingFoot')}</a>
          <a href={pageHref('support')} onClick={(e) => { e.preventDefault(); openSupport() }} style={link}>{t(lang, 'supportFoot')}</a>
          <a href={`mailto:${BRAND.email}`} style={link}>{t(lang, 'contactFoot')}</a>
          <a href="/robots.txt" style={link}>{t(lang, 'privacyFoot')}</a>
        </div>
      </div>
      <div style={{ marginTop: 24, fontSize: 13, color: 'var(--c-on-bg-3)', fontWeight: 500 }}>
        © {new Date().getFullYear()} {BRAND.name} · {BRAND.domain}
      </div>
    </footer>
  )
}
