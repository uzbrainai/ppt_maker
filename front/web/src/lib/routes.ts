import type { AuthMode, ProductId } from '../types'
import { PRODUCT_PATHS } from '../data/products'

/** App page paths (products live in PRODUCT_PATHS). */
export const PAGE_PATHS = {
  pricing: '/pricing',
  support: '/support',
  login: '/login',
  register: '/register',
} as const

/** Logged-in profile area (static paths). */
export const PROFILE_PATHS = {
  home: '/profile',
  courseworks: '/profile/courseworks',
  independents: '/profile/independents',
  subscribed: '/profile/subscribed',
  plans: '/profile/plans',
  support: '/profile/support',
  create: '/profile/create',
} as const

export type PageName = keyof typeof PAGE_PATHS
export type ProfilePage = keyof typeof PROFILE_PATHS | 'deck'

export type ParsedRoute =
  | { name: 'product'; product: ProductId }
  | { name: 'pricing' }
  | { name: 'support' }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'profile'; page: Exclude<ProfilePage, 'deck'>; deckId?: undefined }
  | { name: 'profile'; page: 'deck'; deckId: string }

function viteBase(): string {
  return ((import.meta as any).env?.BASE_URL || '/').replace(/\/$/, '')
}

/** Strip Vite base prefix → app-relative path (`/`, `/kurs`, …). */
export function stripBase(pathname: string): string {
  const base = viteBase()
  let path = pathname
  if (base && path.startsWith(base)) path = path.slice(base.length) || '/'
  if (!path.startsWith('/')) path = `/${path}`
  return path.replace(/\/+$/, '') || '/'
}

/** Absolute href including Vite `base`. */
export function hrefFor(path: string): string {
  const base = viteBase()
  if (path === '/') return `${base}/` || '/'
  return `${base}${path}`
}

export function pageHref(page: PageName): string {
  return hrefFor(PAGE_PATHS[page])
}

export function profileHref(page: Exclude<ProfilePage, 'deck'> = 'home'): string {
  return hrefFor(PROFILE_PATHS[page])
}

export function deckHref(id: string): string {
  return hrefFor(`/profile/deck/${encodeURIComponent(id)}`)
}

export function parseRoute(pathname: string): ParsedRoute {
  const clean = stripBase(pathname)
  if (clean === PAGE_PATHS.pricing) return { name: 'pricing' }
  if (clean === PAGE_PATHS.support) return { name: 'support' }
  if (clean === PAGE_PATHS.login) return { name: 'login' }
  if (clean === PAGE_PATHS.register) return { name: 'register' }

  const deckMatch = /^\/profile\/deck\/([^/]+)$/.exec(clean)
  if (deckMatch) return { name: 'profile', page: 'deck', deckId: decodeURIComponent(deckMatch[1]) }

  if (clean === PROFILE_PATHS.create || clean.startsWith(PROFILE_PATHS.create + '/')) {
    return { name: 'profile', page: 'create' }
  }
  if (clean === PROFILE_PATHS.courseworks || clean.startsWith(PROFILE_PATHS.courseworks + '/')) {
    return { name: 'profile', page: 'courseworks' }
  }
  if (clean === PROFILE_PATHS.independents || clean.startsWith(PROFILE_PATHS.independents + '/')) {
    return { name: 'profile', page: 'independents' }
  }
  if (clean === PROFILE_PATHS.subscribed || clean.startsWith(PROFILE_PATHS.subscribed + '/')) {
    return { name: 'profile', page: 'subscribed' }
  }
  if (clean === PROFILE_PATHS.plans || clean.startsWith(PROFILE_PATHS.plans + '/')) {
    return { name: 'profile', page: 'plans' }
  }
  if (clean === PROFILE_PATHS.support || clean.startsWith(PROFILE_PATHS.support + '/')) {
    return { name: 'profile', page: 'support' }
  }
  if (clean === PROFILE_PATHS.home || clean.startsWith('/profile')) {
    return { name: 'profile', page: 'home' }
  }
  if (clean === PRODUCT_PATHS.kurs) return { name: 'product', product: 'kurs' }
  if (clean === PRODUCT_PATHS.mustaqil) return { name: 'product', product: 'mustaqil' }
  return { name: 'product', product: 'ppt' }
}

export function authHref(mode: AuthMode): string {
  return pageHref(mode === 'signup' ? 'register' : 'login')
}

export function pushPath(path: string): void {
  const href = hrefFor(path)
  if (stripBase(window.location.pathname) === stripBase(href)) return
  window.history.pushState(null, '', href)
}

export function profilePath(page: ProfilePage, deckId?: string): string {
  if (page === 'deck') return `/profile/deck/${encodeURIComponent(deckId || '')}`
  return PROFILE_PATHS[page]
}
