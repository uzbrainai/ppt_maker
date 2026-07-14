import { useRef, useState } from 'react'
import { useApp } from '../context'
import { authHref } from '../lib/routes'
import { Icon, iconSvg } from '../lib/icons'
import { t } from '../lib/i18n'
import { Brand, Overlay } from '../components/ui'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { googleClientId, resendCode, type Credentials } from '../lib/auth'

const githubSvg = iconSvg('github', { stroke: 'currentColor', sw: 2, size: 17 })
const inputStyle: React.CSSProperties = { width: '100%', padding: '13px 14px', borderRadius: 13, border: '1px solid var(--c-chip)', background: 'var(--c-input)', color: 'var(--c-text)', fontSize: 14.5, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }

export default function AuthView() {
  const { view, authMode, setAuthMode, signIn, signInGoogle, verifyCode, gotoLanding, lang } = useApp()
  const creds = useRef<Credentials>({})
  const signup = authMode === 'signup'
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<'form' | 'verify'>('form')
  const [pendingEmail, setPendingEmail] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const code = useRef('')
  const hasGoogle = !!googleClientId()

  const submit = async () => {
    if (busy) return
    setError(null)
    if (!creds.current.email || !creds.current.password) {
      setError(t(lang, 'errEnterCreds'))
      return
    }
    setBusy(true)
    try {
      const result = await signIn(authMode, creds.current)
      if (result.status === 'verify') {
        setPendingEmail(result.email)
        setStage('verify')
        setNotice(t(lang, 'sentCodeNotice', { email: result.email }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t(lang, 'errAuthFailed'))
    } finally {
      setBusy(false)
    }
  }
  const submitCode = async () => {
    if (busy) return
    setError(null)
    const c = code.current.trim()
    if (!/^\d{6}$/.test(c)) {
      setError(t(lang, 'errEnterCode'))
      return
    }
    setBusy(true)
    try {
      await verifyCode(pendingEmail, c)
    } catch (e) {
      setError(e instanceof Error ? e.message : t(lang, 'errVerifyFailed'))
    } finally {
      setBusy(false)
    }
  }
  const resend = async () => {
    setError(null)
    try {
      await resendCode(pendingEmail)
      setNotice(t(lang, 'newCodeNotice', { email: pendingEmail }))
    } catch {
      setError(t(lang, 'errCantResend'))
    }
  }
  const onGoogle = async (idToken: string) => {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      await signInGoogle(idToken)
    } catch (e) {
      setError(e instanceof Error ? e.message : t(lang, 'errGoogleFailed'))
    } finally {
      setBusy(false)
    }
  }
  const tab = (id: 'signin' | 'signup', label: string) => (
    <a href={authHref(id)} onClick={(e) => { e.preventDefault(); setAuthMode(id) }} style={{ flex: 1, padding: 10, borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, background: authMode === id ? 'var(--c-panel-2)' : 'transparent', color: authMode === id ? 'var(--c-text)' : 'var(--c-text-3)', transition: 'all .18s', textAlign: 'center', textDecoration: 'none' }}>{label}</a>
  )

  return (
    <Overlay open={view === 'auth'}>
      <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 420, borderRadius: 26, padding: 30, background: 'var(--c-panel-strong)', border: '1px solid var(--c-border)', boxShadow: '0 50px 90px -40px rgba(0,0,0,0.6)' }}>
          <button onClick={gotoLanding} aria-label={t(lang, 'close')} style={{ position: 'absolute', top: 16, right: 16, width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 999, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', cursor: 'pointer' }}>
            <Icon name="x" opts={{ stroke: 'currentColor', sw: 2, size: 18 }} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
            <Brand onClick={gotoLanding} size={40} colored />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '8px 0 4px', color: 'var(--c-text)' }}>{stage === 'verify' ? t(lang, 'verifyEmail') : signup ? t(lang, 'createAccount') : t(lang, 'welcomeBack')}</h2>
          <p style={{ fontSize: 14, color: 'var(--c-text-2)', margin: '0 0 20px', fontWeight: 500 }}>{stage === 'verify' ? t(lang, 'verifySub') : signup ? t(lang, 'createSub') : t(lang, 'signInSub')}</p>
          {stage === 'verify' ? (
            <>
              {notice && <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 500, color: 'var(--c-text-2)' }}>{notice}</p>}
              <input
                style={{ ...inputStyle, letterSpacing: 8, fontSize: 20, textAlign: 'center', fontWeight: 700 }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••••"
                autoFocus
                name="one-time-code"
                autoComplete="one-time-code"
                onInput={(e) => {
                  const v = e.currentTarget.value.replace(/\D/g, '').slice(0, 6)
                  if (v !== e.currentTarget.value) e.currentTarget.value = v
                  code.current = v
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') void submitCode() }}
              />
              {error && <p style={{ margin: '2px 0 12px', fontSize: 13, fontWeight: 600, color: '#f87171' }}>{error}</p>}
              <button onClick={submitCode} disabled={busy} style={{ width: '100%', padding: 13, borderRadius: 13, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, boxShadow: '0 14px 24px -12px rgba(25,35,62,0.6)', marginBottom: 14 }}>{busy ? t(lang, 'verifying') : t(lang, 'verifyContinue')}</button>
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--c-text-3)', margin: 0, fontWeight: 500 }}>
                {t(lang, 'didntGetIt')}{' '}
                <button onClick={resend} style={{ border: 'none', background: 'none', color: 'var(--c-text)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{t(lang, 'resendCode')}</button>
                <span style={{ margin: '0 6px' }}>·</span>
                <button onClick={() => { setStage('form'); setError(null); setNotice(null) }} style={{ border: 'none', background: 'none', color: 'var(--c-text)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{t(lang, 'back')}</button>
              </p>
            </>
          ) : (
          <>
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: 'var(--c-chip)', border: '1px solid var(--c-border)', marginBottom: 18 }}>
            {tab('signin', t(lang, 'signIn'))}{tab('signup', t(lang, 'createAccountTab'))}
          </div>
          {signup ? <input style={inputStyle} placeholder={t(lang, 'fullName')} onInput={(e) => { creds.current.name = e.currentTarget.value }} /> : null}
          <input style={inputStyle} type="email" placeholder={t(lang, 'emailAddress')} onInput={(e) => { creds.current.email = e.currentTarget.value }} />
          <input style={inputStyle} type="password" placeholder={signup ? t(lang, 'passwordSignup') : t(lang, 'password')} onInput={(e) => { creds.current.password = e.currentTarget.value }} onKeyDown={(e) => { if (e.key === 'Enter') void submit() }} />
          {error && <p style={{ margin: '2px 0 12px', fontSize: 13, fontWeight: 600, color: '#f87171' }}>{error}</p>}
          <button onClick={submit} disabled={busy} style={{ width: '100%', padding: 13, borderRadius: 13, border: 'none', background: 'var(--c-btn-bg)', color: 'var(--c-btn-fg)', fontSize: 14.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, boxShadow: '0 14px 24px -12px rgba(25,35,62,0.6)', marginBottom: 18 }}>{busy ? t(lang, 'pleaseWait') : signup ? t(lang, 'createAccountTab') : t(lang, 'signIn')}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 16px', color: 'var(--c-text-3)', fontSize: 12, fontWeight: 600 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />{t(lang, 'or')}<span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
          </div>
          {hasGoogle && <GoogleSignInButton onCredential={(tok) => void onGoogle(tok)} disabled={busy} />}
          <button onClick={() => setError(t(lang, 'errGithubNotReady'))} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', padding: 12, borderRadius: 13, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10, opacity: 0.7 }}>
            <span style={{ display: 'grid', placeItems: 'center' }} dangerouslySetInnerHTML={{ __html: githubSvg }} />{t(lang, 'continueWithGithub')}
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--c-text-3)', margin: '14px 0 0', fontWeight: 500 }}>
            {signup ? t(lang, 'alreadyHave') : t(lang, 'dontHave')}
            <a href={authHref(signup ? 'signin' : 'signup')} onClick={(e) => { e.preventDefault(); setAuthMode(signup ? 'signin' : 'signup') }} style={{ border: 'none', background: 'none', color: 'var(--c-text)', fontWeight: 700, cursor: 'pointer', fontSize: 13, textDecoration: 'none' }}>{signup ? t(lang, 'signIn') : t(lang, 'createOne')}</a>
          </p>
          </>
          )}
        </div>
      </div>
    </Overlay>
  )
}
