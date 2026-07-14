/**
 * Derive a simple subscription view from the user's plan + credit period.
 * Real billing can replace this once Stripe/Payme is wired.
 */
import { t, type Lang } from './i18n'

export interface SubRecord {
  id: string
  name: string
  status: 'active' | 'expired'
  activatedAt: string
  expiresAt: string
  priceLabel: string
}

function periodBounds(period: string | undefined): { start: Date; end: Date } {
  const now = new Date()
  const m = /^(\d{4})-(\d{2})$/.exec(period || '')
  const y = m ? Number(m[1]) : now.getFullYear()
  const mo = m ? Number(m[2]) - 1 : now.getMonth()
  const start = new Date(y, mo, 1)
  const end = new Date(y, mo + 1, 0, 23, 59, 59)
  return { start, end }
}

function fmt(d: Date, lang: string): string {
  try {
    return d.toLocaleDateString(lang === 'uz' ? 'uz-UZ' : lang === 'ru' ? 'ru-RU' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

function planMeta(lang: Lang): Record<string, { name: string; priceLabel: string }> {
  const permo = lang === 'ru' ? '/мес' : lang === 'uz' ? '/oy' : '/mo'
  return {
    free: { name: t(lang, 'planStarter'), priceLabel: `0 so'm${permo}` },
    starter: { name: t(lang, 'planStarter'), priceLabel: `0 so'm${permo}` },
    pro: { name: t(lang, 'planPro'), priceLabel: `229 000 so'm${permo}` },
    team: { name: t(lang, 'planTeam'), priceLabel: `590 000 so'm${permo}` },
    premium: { name: t(lang, 'planPro'), priceLabel: `229 000 so'm${permo}` },
  }
}

export function buildSubscriptionView(
  plan: string | undefined,
  period: string | undefined,
  lang: Lang,
): { active: SubRecord; history: SubRecord[] } {
  const key = (plan || 'free').toLowerCase()
  const meta = planMeta(lang)
  const m = meta[key] || meta.free
  const { start, end } = periodBounds(period)
  const active: SubRecord = {
    id: 'current',
    name: m.name,
    status: 'active',
    activatedAt: fmt(start, lang),
    expiresAt: fmt(end, lang),
    priceLabel: m.priceLabel,
  }
  const permo = lang === 'ru' ? '/мес' : lang === 'uz' ? '/oy' : '/mo'
  const history: SubRecord[] = key !== 'free' && key !== 'starter'
    ? [{
        id: 'prev-free',
        name: t(lang, 'planStarter'),
        status: 'expired',
        activatedAt: fmt(new Date(start.getFullYear(), start.getMonth() - 1, 1), lang),
        expiresAt: fmt(new Date(start.getTime() - 1000), lang),
        priceLabel: `0 so'm${permo}`,
      }]
    : []
  return { active, history }
}

export interface PlanSpec {
  id: string
  name: string
  price: string
  priceSuffix: string
  blurb: string
  popular: boolean
  pack: string | null
  feats: string[]
}

export function availablePlans(lang: Lang): PlanSpec[] {
  return [
    {
      id: 'starter',
      name: t(lang, 'planStarter'),
      price: '0',
      priceSuffix: "so'm",
      blurb: t(lang, 'starterBlurb'),
      popular: false,
      pack: null,
      feats: [t(lang, 'starterFeat1'), t(lang, 'starterFeat2'), t(lang, 'starterFeat3')],
    },
    {
      id: 'pro',
      name: t(lang, 'planPro'),
      price: '229 000',
      priceSuffix: "so'm",
      blurb: t(lang, 'proBlurb'),
      popular: true,
      pack: 'pro',
      feats: [t(lang, 'proFeat1'), t(lang, 'proFeat2'), t(lang, 'proFeat3'), t(lang, 'proFeatShort4')],
    },
    {
      id: 'team',
      name: t(lang, 'planTeam'),
      price: '590 000',
      priceSuffix: "so'm",
      blurb: t(lang, 'teamBlurb'),
      popular: false,
      pack: 'team',
      feats: [t(lang, 'teamFeat1'), t(lang, 'teamFeat2'), t(lang, 'teamFeat3'), t(lang, 'teamFeatShort4')],
    },
  ]
}

/** Backwards-compatible English default. */
export const AVAILABLE_PLANS = availablePlans('en')
