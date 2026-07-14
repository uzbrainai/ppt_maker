import { useEffect, useState } from 'react'
import { getStoredAdmin, getToken, setStoredAdmin, setToken, signOut, type StoredAdmin } from './lib/api'
import Login from './views/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './views/Dashboard'
import Users from './views/Users'
import Subscriptions from './views/Subscriptions'
import Payments from './views/Payments'
import Support from './views/Support'
import Plans from './views/Plans'
import ApiUsage from './views/ApiUsage'

export type Page = 'dashboard' | 'users' | 'plans' | 'subscriptions' | 'payments' | 'support' | 'api-usage'

function pageFromHash(): Page {
  const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '')
  const first = h.split('/')[0] as Page
  if (['users', 'plans', 'subscriptions', 'payments', 'support', 'api-usage'].includes(first)) return first
  return 'dashboard'
}

export default function App() {
  const [user, setUser] = useState<StoredAdmin | null>(() => getStoredAdmin())
  const [page, setPage] = useState<Page>(pageFromHash)

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const authed = !!user && !!getToken()

  const onAuth = (u: StoredAdmin, token: string) => {
    setToken(token); setStoredAdmin(u); setUser(u)
    window.location.hash = '#/dashboard'
  }

  const onSignOut = () => {
    signOut(); setUser(null)
    window.location.hash = '#/login'
  }

  if (!authed) return <Login onAuth={onAuth} />

  return (
    <div className="app">
      <Sidebar page={page} user={user} onSignOut={onSignOut} />
      <main className="main">
        {page === 'dashboard' && <Dashboard />}
        {page === 'users' && <Users />}
        {page === 'plans' && <Plans />}
        {page === 'subscriptions' && <Subscriptions />}
        {page === 'payments' && <Payments />}
        {page === 'support' && <Support />}
        {page === 'api-usage' && <ApiUsage />}
      </main>
    </div>
  )
}
