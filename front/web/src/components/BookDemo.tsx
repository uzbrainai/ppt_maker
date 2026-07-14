import { useState } from 'react'
import { useApp } from '../context'
import { Icon } from '../lib/icons'
import { t } from '../lib/i18n'
import { LogoColor } from './ui'

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12,
  border: '1px solid var(--c-chip)', background: 'var(--c-input)', color: 'var(--c-text)',
  fontSize: 14.5, outline: 'none', fontFamily: 'inherit',
}

export default function BookDemo() {
  const { user, lang } = useApp()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const valid = /.+@.+\..+/.test(email) && message.trim().length >= 10
  const submit = () => {
    if (!valid) return
    setSent(true)
  }

  return (
    <section id="support" style={{ position: 'relative', zIndex: 4, marginTop: 130 }}>
      <div style={{ textAlign: 'center', marginBottom: 36, maxWidth: 720, margin: '0 auto 36px' }}>
        <h2 style={{ fontSize: 'clamp(28px,4vw,46px)', fontWeight: 700, letterSpacing: '-0.025em', margin: '0 0 14px', color: 'var(--c-on-bg)', textWrap: 'balance' } as React.CSSProperties}>
          {t(lang, 'enterpriseHeading')}
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.55, color: 'var(--c-on-bg-2)', margin: '0 0 10px', fontWeight: 500 }}>
          {t(lang, 'enterpriseSub')}
        </p>
        <p style={{ fontSize: 14, color: 'var(--c-on-bg-3)', margin: 0, fontWeight: 500 }}>
          {t(lang, 'enterpriseNote')}
        </p>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', borderRadius: 28, padding: '36px 34px', background: 'var(--c-panel)', backdropFilter: 'blur(26px)', WebkitBackdropFilter: 'blur(26px)', border: '1px solid var(--c-border)', boxShadow: '0 40px 80px -40px rgba(31,42,68,0.5),inset 0 1px 0 rgba(255,255,255,0.12)' }}>
        {sent ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: '28px 8px' }}>
            <span style={{ width: 56, height: 56, borderRadius: 999, background: '#cdf03f', display: 'grid', placeItems: 'center' }}>
              <Icon name="check" opts={{ stroke: '#15200a', sw: 3, size: 26 }} />
            </span>
            <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--c-text)' }}>{t(lang, 'messageSent')}</h3>
            <p style={{ fontSize: 15, color: 'var(--c-text-2)', fontWeight: 500, margin: 0, maxWidth: 420, lineHeight: 1.5 }}>
              {t(lang, 'messageSentBody', { email })}
            </p>
            <button
              onClick={() => { setSent(false); setMessage('') }}
              style={{ marginTop: 6, padding: '11px 20px', borderRadius: 12, border: '1px solid var(--c-border)', background: 'var(--c-chip)', color: 'var(--c-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              {t(lang, 'sendAnother')}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 22 }}>
              <LogoColor w={36} h={36} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--c-text)' }}>{t(lang, 'contactSupport')}</div>
                <div style={{ fontSize: 13, color: 'var(--c-text-3)', fontWeight: 500 }}>{t(lang, 'contactSupportSub')}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(lang, 'yourName')} style={inputStyle} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t(lang, 'emailAddress')} style={inputStyle} />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t(lang, 'howCanWeHelp')}
                rows={5}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 120, lineHeight: 1.45 }}
              />
              <button
                onClick={submit}
                disabled={!valid}
                style={{
                  marginTop: 4, padding: 14, borderRadius: 14, border: 'none',
                  background: valid ? 'var(--c-btn-bg)' : 'var(--c-chip)',
                  color: valid ? 'var(--c-btn-fg)' : 'var(--c-text-3)',
                  fontSize: 15, fontWeight: 700, cursor: valid ? 'pointer' : 'default',
                  boxShadow: valid ? '0 14px 24px -12px rgba(25,35,62,0.6)' : 'none',
                }}
              >
                {t(lang, 'sendMessage')}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
