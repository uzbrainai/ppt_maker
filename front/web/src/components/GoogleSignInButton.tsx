import { useEffect, useRef } from 'react'
import { googleClientId } from '../lib/auth'

const GSI_SRC = 'https://accounts.google.com/gsi/client'

type CredentialResponse = { credential: string }

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: {
            client_id: string
            callback: (res: CredentialResponse) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; width?: number; text?: string; shape?: string }
          ) => void
        }
      }
    }
  }
}

let gsiLoading: Promise<void> | null = null

function loadGsi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.id) return Promise.resolve()
  if (gsiLoading) return gsiLoading
  gsiLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In')))
      return
    }
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google Sign-In'))
    document.head.appendChild(s)
  })
  return gsiLoading
}

export default function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (idToken: string) => void
  disabled?: boolean
}) {
  const clientId = googleClientId()
  const host = useRef<HTMLDivElement>(null)
  const cb = useRef(onCredential)
  cb.current = onCredential

  useEffect(() => {
    if (!clientId || disabled) return
    let cancelled = false
    void loadGsi()
      .then(() => {
        if (cancelled || !host.current || !window.google?.accounts?.id) return
        host.current.innerHTML = ''
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => { if (res.credential) cb.current(res.credential) },
          cancel_on_tap_outside: true,
        })
        const width = Math.min(360, Math.max(240, host.current.clientWidth || 320))
        window.google.accounts.id.renderButton(host.current, {
          theme: 'outline',
          size: 'large',
          width,
          text: 'continue_with',
          shape: 'pill',
        })
      })
      .catch(() => { /* script blocked — button stays empty */ })
    return () => { cancelled = true }
  }, [clientId, disabled])

  if (!clientId) return null

  return (
    <div
      ref={host}
      style={{ width: '100%', minHeight: 44, marginBottom: 10, display: 'flex', justifyContent: 'center', opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    />
  )
}
