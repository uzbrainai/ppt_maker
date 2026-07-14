/**
 * Make PPT — public brand constants (SEO, UI labels, absolute URLs).
 * Domain: https://make-ppt.com
 */
export const BRAND = {
  name: 'Make PPT',
  shortName: 'Make PPT',
  domain: 'make-ppt.com',
  origin: 'https://make-ppt.com',
  tagline: 'AI presentations that open in PowerPoint',
  description:
    'Make PPT turns prompts and documents into polished, editable PowerPoint decks in minutes. AI structure, modern design, real PPTX export.',
  twitter: '@makeppt',
  email: 'hello@make-ppt.com',
} as const

/** Public logo / icon assets under front/web/public (bump `v` to bust caches). */
export const BRAND_ASSETS = {
  v: '3',
  mark: 'logo_mark.svg',
  markColor: 'logo_white.svg',
  favicon: 'favicon.svg',
  icon: 'logo-icon.png',
  og: 'og-banner.png',
} as const

export function brandAssetUrl(file: string, absolute = false): string {
  const q = `?v=${BRAND_ASSETS.v}`
  if (absolute) return `${BRAND.origin}/${file}${q}`
  const base = (import.meta as ImportMeta & { env: { BASE_URL: string } }).env.BASE_URL || '/'
  return `${base}${file}${q}`
}

export const SEO = {
  titleDefault: 'Make PPT — AI PowerPoint Generator | Editable PPTX',
  titleTemplate: (page: string) => `${page} · Make PPT`,
  keywords:
    'AI PowerPoint, PPT generator, editable PPTX, presentation maker, Make PPT, AI slides, deck generator',
} as const
