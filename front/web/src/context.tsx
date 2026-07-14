import { createContext, useContext } from 'react'
import type { AuthMode, Credits, DocItem, ProductId, Theme, Tier, User, View } from './types'
import type { AuthResult, Credentials } from './lib/auth'
import type { DeckOptions } from './lib/slidewind'
import type { GenerationResult } from './lib/generate'
import type { Lang } from './lib/i18n'
import type { ProfilePage } from './lib/routes'
import type { GenJob } from './lib/genJobs'

export interface AppContextValue {
  theme: Theme
  toggleTheme: () => void
  lang: Lang
  setLang: (l: Lang) => void
  product: ProductId
  setProduct: (id: ProductId) => void
  goProduct: (id: ProductId) => void
  tier: Tier
  setTier: (t: Tier) => void
  view: View
  profilePage: ProfilePage
  goProfile: (page?: ProfilePage, deckId?: string) => void
  authMode: AuthMode
  setAuthMode: (m: AuthMode) => void
  openAuth: (mode: AuthMode) => void
  gotoLanding: () => void
  openSupport: () => void
  signIn: (mode: AuthMode, creds: Credentials) => Promise<AuthResult>
  signInGoogle: (idToken: string) => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  user: User | null
  isAdmin: boolean
  signOut: () => void
  adminOpen: boolean
  openAdmin: () => void
  closeAdmin: () => void
  credits: Credits | null
  refreshAccount: () => Promise<void>
  items: DocItem[]
  genJobs: GenJob[]
  openDoc: (id: string) => void
  backToDashboard: () => void
  saveDoc: (doc: DocItem) => void
  editId: string | null
  createOpen: boolean
  openCreate: () => void
  /** Open the create panel locked to a specific product (hides the product picker). */
  openCreateFor: (product: ProductId) => void
  /** When set, the create panel is locked to this product only. Null = unlocked. */
  createLock: ProductId | null
  closeCreate: () => void
  /** Queue generation — shows on Presentations immediately; runs in the background. */
  enqueueGenerate: (product: ProductId, prompt: string, tier: Tier, options: DeckOptions) => string | null
  generateDoc: (product: ProductId, prompt: string, tier: Tier, options: DeckOptions, onProgress?: (msg: string) => void) => Promise<GenerationResult | null>
  pricingOpen: boolean
  openPricing: () => void
  closePricing: () => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppContext')
  return ctx
}
