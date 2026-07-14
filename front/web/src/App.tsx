import { useCallback, useEffect, useRef, useState } from 'react'
import { AppContext, type AppContextValue } from './context'
import type { AuthMode, Credits, DocItem, ProductId, Theme, Tier, User, View } from './types'
import { authenticate, verifyEmail, getStoredUser, getToken, signOut as signOutStore, updateStoredUser, signInWithGoogle, type Credentials } from './lib/auth'
import { seedDocuments } from './data/documents'
import { PRODUCT_PATHS } from './data/products'
import { parseRoute, profilePath, pushPath, stripBase, type ProfilePage } from './lib/routes'
import { getStoredLang, setStoredLang, t, type Lang } from './lib/i18n'
import { createDocument } from './lib/generate'
import { fetchMe, fetchMaterials, materialToDoc, mergeMeUser } from './lib/api'
import { readLocalDocs, writeLocalDocs, isLocalDoc } from './lib/localDocs'
import { slidewindEnabled, ApiError, type DeckOptions } from './lib/slidewind'
import { newJobId, progressFromMessage, provisionalTitle, type GenJob } from './lib/genJobs'
import ShaderBackground from './components/ShaderBackground'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Generator from './components/Generator'
import Features from './components/Features'
import Templates from './components/Templates'
import WorkflowSection from './components/WorkflowSection'
import CTA from './components/CTA'
import BookDemo from './components/BookDemo'
import Footer from './components/Footer'
import PricingModal from './components/PricingModal'
import AdminPanel from './components/AdminPanel'
import AuthView from './views/AuthView'
import Profile from './views/Profile'
import Editor from './views/Editor'

function initialProduct(): ProductId {
  if (typeof window === 'undefined') return 'ppt'
  const r = parseRoute(window.location.pathname)
  return r.name === 'product' ? r.product : 'ppt'
}

function initialView(): View {
  if (typeof window === 'undefined') return 'landing'
  const r = parseRoute(window.location.pathname)
  if (r.name === 'login' || r.name === 'register') return 'auth'
  if (r.name === 'profile') return getStoredUser() || getToken() ? 'profile' : 'auth'
  return 'landing'
}

function initialProfilePage(): ProfilePage {
  if (typeof window === 'undefined') return 'home'
  const r = parseRoute(window.location.pathname)
  return r.name === 'profile' ? r.page : 'home'
}

function initialEditId(): string | null {
  if (typeof window === 'undefined') return null
  const r = parseRoute(window.location.pathname)
  return r.name === 'profile' && r.page === 'deck' ? r.deckId : null
}

function initialAuthMode(): AuthMode {
  if (typeof window === 'undefined') return 'signin'
  const r = parseRoute(window.location.pathname)
  if (r.name === 'register') return 'signup'
  if (r.name === 'profile' && !getStoredUser() && !getToken()) return 'signin'
  return 'signin'
}

function initialPricingOpen(): boolean {
  if (typeof window === 'undefined') return false
  return parseRoute(window.location.pathname).name === 'pricing'
}

function scrollToSupport() {
  requestAnimationFrame(() => {
    document.getElementById('support')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('pptmaker-theme') as Theme) || 'dark' } catch { return 'dark' }
  })
  const [lang, setLangState] = useState<Lang>(() => getStoredLang())
  const [product, setProductState] = useState<ProductId>(initialProduct)
  // Lock the create panel to a specific product when opened from a per-product
  // page (Presentations / Course works / Independent works). Null = free choice.
  const [createLock, setCreateLock] = useState<ProductId | null>(null)
  const [tier, setTier] = useState<Tier>('general')
  const [view, setView] = useState<View>(initialView)
  const [profilePage, setProfilePage] = useState<ProfilePage>(initialProfilePage)
  const [authMode, setAuthModeState] = useState<AuthMode>(initialAuthMode)
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const [credits, setCredits] = useState<Credits | null>(null)
  // Logged-in users start with any locally-persisted client-side docs (course
  // works / independent works) so they survive page reloads. Server materials
  // are merged in when refreshAccount() runs. Guests keep seed demos on landing.
  const [items, setItems] = useState<DocItem[]>(() => {
    const stored = getStoredUser()
    return stored ? readLocalDocs(stored) : seedDocuments()
  })
  const [genJobs, setGenJobs] = useState<GenJob[]>([])
  const [editId, setEditId] = useState<string | null>(initialEditId)
  const editIdRef = useRef(editId)
  editIdRef.current = editId
  const [pricingOpen, setPricingOpen] = useState(initialPricingOpen)
  const [adminOpen, setAdminOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('pptmaker-theme', theme) } catch { /* ignore */ }
  }, [theme])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    setStoredLang(l)
  }, [])

  const goProfile = useCallback((page: ProfilePage = 'home', deckId?: string) => {
    setProfilePage(page)
    setView('profile')
    setPricingOpen(false)
    if (page === 'deck') {
      const id = deckId || ''
      if (id) setEditId(id)
      pushPath(profilePath('deck', id))
      return
    }
    pushPath(profilePath(page))
  }, [])

  const syncFromLocation = useCallback(() => {
    const r = parseRoute(window.location.pathname)
    switch (r.name) {
      case 'product':
        setProductState(r.product)
        setPricingOpen(false)
        setView((v) => (v === 'auth' || v === 'profile' ? 'landing' : v))
        break
      case 'pricing':
        setPricingOpen(true)
        setView((v) => (v === 'auth' ? 'landing' : v))
        break
      case 'support':
        setPricingOpen(false)
        setView((v) => (v === 'auth' || v === 'profile' ? 'landing' : v))
        scrollToSupport()
        break
      case 'login':
        setAuthModeState('signin')
        setView('auth')
        setPricingOpen(false)
        break
      case 'register':
        setAuthModeState('signup')
        setView('auth')
        setPricingOpen(false)
        break
      case 'profile':
        setProfilePage(r.page)
        if (r.page === 'deck') setEditId(r.deckId)
        setPricingOpen(false)
        if (getStoredUser() || getToken()) {
          setView('profile')
        } else {
          setAuthModeState('signin')
          setView('auth')
          pushPath('/login')
        }
        break
    }
  }, [])

  useEffect(() => {
    syncFromLocation()
    window.addEventListener('popstate', syncFromLocation)
    return () => window.removeEventListener('popstate', syncFromLocation)
  }, [syncFromLocation])

  const homePath = useCallback((id: ProductId = product) => PRODUCT_PATHS[id], [product])

  const navigateProduct = useCallback((id: ProductId, scroll = false) => {
    setProductState(id)
    setPricingOpen(false)
    setView('landing')
    pushPath(PRODUCT_PATHS[id])
    if (scroll) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { window.scrollTo(0, 0) }
    }
  }, [])

  const openPricing = useCallback(() => {
    setPricingOpen(true)
    if (view === 'auth') setView('landing')
    pushPath('/pricing')
  }, [view])

  const closePricing = useCallback(() => {
    setPricingOpen(false)
    if (stripBase(window.location.pathname) === '/pricing') {
      if (view === 'profile') goProfile(profilePage === 'deck' ? 'deck' : profilePage, editId || undefined)
      else pushPath(homePath())
    }
  }, [homePath, view, profilePage, editId, goProfile])

  const openSupport = useCallback(() => {
    setPricingOpen(false)
    setView('landing')
    pushPath('/support')
    scrollToSupport()
  }, [])

  const openAuth = useCallback((mode: AuthMode) => {
    if (user) {
      goProfile('home')
      return
    }
    setAuthModeState(mode)
    setView('auth')
    setPricingOpen(false)
    pushPath(mode === 'signup' ? '/register' : '/login')
  }, [user, goProfile])

  const setAuthMode = useCallback((mode: AuthMode) => {
    setAuthModeState(mode)
    if (stripBase(window.location.pathname) === '/login' || stripBase(window.location.pathname) === '/register') {
      pushPath(mode === 'signup' ? '/register' : '/login')
    }
  }, [])

  const gotoLanding = useCallback(() => {
    setView('landing')
    setPricingOpen(false)
    pushPath(homePath())
  }, [homePath])

  const refreshAccount = useCallback(async () => {
    if (!slidewindEnabled()) return
    try {
      const me = await fetchMe()
      if (me) {
        if (me.user) {
          setUser((prev) => mergeMeUser(prev, me))
          updateStoredUser({ id: me.user.id, plan: me.user.plan, role: me.user.role })
        }
        setCredits(me.credits)
      }
      const mats = await fetchMaterials()
      const fromServer = mats.map((m) => ({ ...materialToDoc(m), status: 'ready' as const }))
      setItems((prev) => {
        // Keep any locally-created item that isn't already represented on the
        // server. Course works & independent works are client-side mocks (no
        // deckId), so we key by id-or-deckId and always preserve them.
        const serverKeys = new Set(fromServer.flatMap((m) => [m.id, m.deckId].filter(Boolean) as string[]))
        const localOnly = prev.filter((p) => {
          if (p.isJob) return false
          const key = p.deckId || p.id
          return !serverKeys.has(key)
        })
        return [...localOnly, ...fromServer]
      })
    } catch { /* backend unreachable — keep current state */ }
  }, [])

  useEffect(() => { if (user) void refreshAccount() }, [user?.email, refreshAccount])

  // Persist client-side docs (course works / independent works) to localStorage
  // so they don't vanish on reload — the backend has no generation endpoint
  // for these yet, so they'd otherwise be ephemeral in-memory state.
  useEffect(() => {
    if (!user) return
    writeLocalDocs(user, items.filter(isLocalDoc))
  }, [items, user])

  const afterAuth = useCallback((u: User) => {
    setUser(u)
    // Restore any locally-persisted client-side docs for this user so their
    // course works / independent works come back after sign-in.
    setItems(readLocalDocs(u))
    setGenJobs([])
    goProfile('home')
  }, [goProfile])

  const patchJob = useCallback((id: string, patch: Partial<GenJob>) => {
    setGenJobs((jobs) => jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }, [])

  const enqueueGenerate = useCallback((product: ProductId, prompt: string, tier: Tier, options: DeckOptions) => {
    if (!user) { openAuth('signup'); return null }
    const id = newJobId()
    const title = provisionalTitle(prompt)
    const job: GenJob = {
      id,
      status: 'queued',
      product,
      prompt,
      tier,
      options,
      title,
      stage: 0,
      label: t(lang, 'queuedShort'),
      pageCount: product === 'ppt' ? options.pages : undefined,
      createdAt: Date.now(),
    }
    setGenJobs((jobs) => [job, ...jobs])
    // Send the user back to the list for the product they just queued.
    if (product === 'kurs') goProfile('courseworks')
    else if (product === 'mustaqil') goProfile('independents')
    else goProfile('home')

    void (async () => {
      patchJob(id, { status: 'generating', label: t(lang, 'startingShort') })
      try {
        const result = await createDocument(product, prompt, tier, options, (msg) => {
          setGenJobs((jobs) => jobs.map((j) => {
            if (j.id !== id) return j
            const next = progressFromMessage(j.stage, msg)
            return { ...j, status: 'generating', ...next }
          }))
        })
        const ready: DocItem = { ...result.doc, status: 'ready' }
        setItems((list) => [ready, ...list.filter((x) => {
          if (x.id === ready.id) return false
          // Only compare deckIds when both are defined; otherwise every local
          // mock (deckId=undefined) would be removed on the next insert.
          if (x.deckId && ready.deckId && x.deckId === ready.deckId) return false
          return true
        })])
        if (result.credits) {
          setCredits({
            balance: result.credits.balance,
            monthlyAllowance: result.credits.monthlyAllowance,
            period: result.credits.period,
            unlimited: result.credits.unlimited,
          })
        }
        setGenJobs((jobs) => jobs.filter((j) => j.id !== id))
        if (editIdRef.current === id) {
          goProfile('deck', ready.id)
        }
        void refreshAccount()
      } catch (e) {
        const message = e instanceof Error ? e.message : t(lang, 'generationFailed')
        patchJob(id, {
          status: 'error',
          error: message,
          label: e instanceof ApiError && e.code === 'insufficient_credits' ? t(lang, 'outOfCredits') : t(lang, 'failed'),
        })
      }
    })()

    return id
  }, [user, goProfile, patchJob, openAuth, refreshAccount, lang])

  const value: AppContextValue = {
    theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    lang,
    setLang,
    product,
    setProduct: (id) => navigateProduct(id, false),
    goProduct: (id) => navigateProduct(id, true),
    tier,
    setTier,
    view,
    profilePage,
    goProfile,
    authMode,
    setAuthMode,
    openAuth,
    gotoLanding,
    openSupport,
    signIn: async (mode: AuthMode, creds: Credentials) => {
      const result = await authenticate(mode, creds)
      if (result.status === 'authenticated') afterAuth(result.user)
      return result
    },
    signInGoogle: async (idToken: string) => {
      const result = await signInWithGoogle(idToken)
      if (result.status === 'authenticated') afterAuth(result.user)
    },
    verifyCode: async (email: string, code: string) => {
      const u = await verifyEmail(email, code)
      afterAuth(u)
    },
    user,
    isAdmin: user?.role === 'admin',
    signOut: () => {
      signOutStore()
      setUser(null)
      setCredits(null)
      setItems(seedDocuments())
      setGenJobs([])
      setAdminOpen(false)
      setView('landing')
      setPricingOpen(false)
      pushPath(homePath())
    },
    adminOpen,
    openAdmin: () => setAdminOpen(true),
    closeAdmin: () => setAdminOpen(false),
    credits,
    refreshAccount,
    items,
    genJobs,
    openDoc: (id) => { goProfile('deck', id) },
    backToDashboard: () => goProfile('home'),
    saveDoc: (doc) => setItems((list) => list.map((x) => (x.id === doc.id ? { ...doc, updated: 'just now' } : x))),
    editId,
    pricingOpen,
    openPricing,
    closePricing,
    createOpen: false,
    openCreate: () => { setCreateLock(null); goProfile('create') },
    openCreateFor: (p) => { setProductState(p); setCreateLock(p); goProfile('create') },
    createLock,
    closeCreate: () => goProfile('home'),
    enqueueGenerate,
    generateDoc: async (product, prompt, tier, options, onProgress) => {
      if (!user) { openAuth('signup'); return null }
      const result = await createDocument(product, prompt, tier, options, onProgress)
      setItems((list) => [{ ...result.doc, status: 'ready' }, ...list])
      if (result.credits) setCredits({ balance: result.credits.balance, monthlyAllowance: result.credits.monthlyAllowance, period: result.credits.period, unlimited: result.credits.unlimited })
      return result
    },
  }

  return (
    <AppContext.Provider value={value}>
      <ErrorBoundary>
        <ShaderBackground product={product} />
      </ErrorBoundary>
      <div className="wrap app-content" style={{ maxWidth: 1240, margin: '0 auto', padding: '0 24px 80px' }}>
        <Navbar />
        <div key={product} style={{ position: 'relative', zIndex: 1, animation: 'pageIn .42s cubic-bezier(.22,.61,.36,1) both' }}>
          <Hero />
          <Generator />
          <Features />
          <Templates />
          <WorkflowSection />
          <CTA />
          <BookDemo />
        </div>
        <Footer />
      </div>
      <PricingModal />
      <AuthView />
      <Profile />
      <Editor />
      <AdminPanel />
    </AppContext.Provider>
  )
}
