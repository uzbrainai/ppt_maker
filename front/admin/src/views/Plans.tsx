import { useEffect, useMemo, useState } from 'react'
import {
  fetchPlans, createPlan, updatePlan, deletePlan,
  fmtInt, fmtUzs, type Plan, type PlanKind,
} from '../lib/api'
import { t, useLang, type Lang } from '../lib/i18n'

const emptyPlan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> = {
  slug: '',
  name: '',
  kind: 'subscription',
  priceUzs: 0,
  credits: 0,
  monthlyAllowance: 0,
  blurb: '',
  features: [],
  isActive: true,
  isPopular: false,
  sortOrder: 0,
  yearlyDiscountPct: 0,
}

function PlanForm({ initial, onCancel, onSaved, lang }: {
  initial: Plan | null
  onCancel: () => void
  onSaved: (p: Plan) => void
  lang: Lang
}) {
  const [form, setForm] = useState(() => initial
    ? { ...initial }
    : { ...emptyPlan, id: 0 as unknown as number, createdAt: '', updatedAt: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [featureInput, setFeatureInput] = useState('')

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const addFeature = () => {
    const s = featureInput.trim()
    if (!s) return
    set('features', [...form.features, s])
    setFeatureInput('')
  }
  const removeFeature = (i: number) => set('features', form.features.filter((_, x) => x !== i))

  const save = async () => {
    setErr(null); setBusy(true)
    try {
      const payload = {
        slug: form.slug.trim().toLowerCase(),
        name: form.name.trim(),
        kind: form.kind,
        priceUzs: Number(form.priceUzs) || 0,
        credits: Math.max(0, Math.floor(Number(form.credits) || 0)),
        monthlyAllowance: form.kind === 'subscription'
          ? Math.max(0, Math.floor(Number(form.monthlyAllowance ?? form.credits) || 0))
          : null,
        blurb: form.blurb ?? null,
        features: form.features,
        isActive: form.isActive,
        isPopular: form.isPopular,
        sortOrder: Math.max(0, Math.floor(Number(form.sortOrder) || 0)),
        yearlyDiscountPct: Math.max(0, Math.min(100, Math.floor(Number(form.yearlyDiscountPct) || 0))),
      }
      if (!payload.slug || !payload.name) throw new Error(t(lang, 'plans_slugName_required'))
      const saved = initial
        ? await updatePlan(initial.id, payload)
        : await createPlan(payload)
      onSaved(saved)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t(lang, 'saveFailed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h2>{initial ? t(lang, 'plans_edit') : t(lang, 'plans_newForm')}</h2>
        <p style={{ color: 'var(--text-2)', margin: '0 0 14px' }}>
          {form.kind === 'subscription' ? t(lang, 'plans_subDesc') : t(lang, 'plans_tokenDesc')}
        </p>
        {err && <div className="error-banner">{err}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>{t(lang, 'plans_slug')}</label>
            <input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="pro / tokens-100" disabled={!!initial} />
          </div>
          <div className="field">
            <label>{t(lang, 'plans_name')}</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Pro" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>{t(lang, 'plans_kind')}</label>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value as PlanKind)}>
              <option value="subscription">{t(lang, 'plans_kind_subscription')}</option>
              <option value="token">{t(lang, 'plans_kind_token')}</option>
            </select>
          </div>
          <div className="field">
            <label>{t(lang, 'plans_priceUzs')}</label>
            <input type="number" min="0" value={String(form.priceUzs)} onChange={(e) => set('priceUzs', Number(e.target.value))} />
          </div>
          <div className="field">
            <label>{t(lang, 'plans_credits')}</label>
            <input type="number" min="0" value={String(form.credits)} onChange={(e) => set('credits', Number(e.target.value))} />
          </div>
        </div>

        {form.kind === 'subscription' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>{t(lang, 'plans_monthly')}</label>
              <input
                type="number" min="0"
                value={String(form.monthlyAllowance ?? 0)}
                onChange={(e) => set('monthlyAllowance', Number(e.target.value))}
                placeholder={t(lang, 'plans_monthlyPh')}
              />
            </div>
            <div className="field">
              <label>{t(lang, 'plans_yearlyPct')}</label>
              <input
                type="number" min="0" max="100"
                value={String(form.yearlyDiscountPct)}
                onChange={(e) => set('yearlyDiscountPct', Number(e.target.value))}
                placeholder={t(lang, 'plans_yearlyPctPh')}
              />
              {form.yearlyDiscountPct > 0 && Number(form.priceUzs) > 0 && (
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {t(lang, 'plans_yearlyBilled', {
                    sum: fmtUzs(Math.round(Number(form.priceUzs) * 12 * (1 - form.yearlyDiscountPct / 100))),
                    saved: fmtUzs(Math.round(Number(form.priceUzs) * 12 * form.yearlyDiscountPct / 100)),
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="field">
          <label>{t(lang, 'plans_blurb')}</label>
          <input value={form.blurb ?? ''} onChange={(e) => set('blurb', e.target.value)} placeholder="For founders, students, and creators" />
        </div>

        <div className="field">
          <label>{t(lang, 'plans_features')}</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={featureInput}
              onChange={(e) => setFeatureInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFeature() } }}
              placeholder={t(lang, 'plans_addFeature')}
            />
            <button type="button" onClick={addFeature}>{t(lang, 'plans_add')}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {form.features.map((f, i) => (
              <div key={i} className="spread" style={{ padding: '8px 10px', background: 'var(--chip)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span>{f}</span>
                <button type="button" onClick={() => removeFeature(i)} className="danger" style={{ padding: '3px 10px', fontSize: 12 }}>{t(lang, 'plans_remove')}</button>
              </div>
            ))}
            {form.features.length === 0 && <div className="muted" style={{ fontSize: 12 }}>{t(lang, 'plans_noFeatures')}</div>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="field">
            <label>{t(lang, 'plans_sort')}</label>
            <input type="number" min="0" value={String(form.sortOrder)} onChange={(e) => set('sortOrder', Number(e.target.value))} />
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
              <span>{t(lang, 'plans_active')}</span>
            </label>
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.isPopular} onChange={(e) => set('isPopular', e.target.checked)} />
              <span>{t(lang, 'plans_popular')}</span>
            </label>
          </div>
        </div>

        <div className="actions">
          <button onClick={onCancel}>{t(lang, 'cancel')}</button>
          <button className="primary" onClick={save} disabled={busy}>{busy ? t(lang, 'saving') : t(lang, 'plans_saveBtn')}</button>
        </div>
      </div>
    </div>
  )
}

function PlanCard({ plan, onEdit, onToggle, onDelete, lang }: {
  plan: Plan
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
  lang: Lang
}) {
  return (
    <div className="card" style={{
      border: plan.isPopular ? '1px solid rgba(124,92,255,0.55)' : undefined,
      boxShadow: plan.isPopular ? '0 22px 45px -22px rgba(124,92,255,0.35)' : undefined,
      opacity: plan.isActive ? 1 : 0.55,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div className="spread">
        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', fontWeight: 700 }}>
            {plan.kind === 'subscription' ? t(lang, 'plans_subscription_label') : t(lang, 'plans_token_label')}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 2 }}>{plan.name}</div>
          <div className="muted mono" style={{ fontSize: 11 }}>slug: {plan.slug}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {plan.isPopular && <span className="badge admin">{t(lang, 'plans_popular')}</span>}
          {!plan.isActive && <span className="badge blocked">{t(lang, 'plans_hidden')}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmtUzs(plan.priceUzs)}</span>
        {plan.kind === 'subscription' && <span className="muted">{t(lang, 'subs_perMonth')}</span>}
      </div>
      {plan.kind === 'subscription' && plan.yearlyDiscountPct > 0 && plan.priceUzs > 0 && (
        <div style={{
          fontSize: 12, color: 'var(--accent-2)', fontWeight: 700,
          background: 'rgba(205,240,63,0.10)',
          padding: '5px 10px', borderRadius: 8,
          border: '1px solid rgba(205,240,63,0.25)',
          display: 'inline-block', alignSelf: 'flex-start',
        }}>
          {t(lang, 'plans_yearlyBilled', {
            sum: fmtUzs(Math.round(plan.priceUzs * 12 * (1 - plan.yearlyDiscountPct / 100))),
            saved: `${plan.yearlyDiscountPct}%`,
          })}
        </div>
      )}
      {plan.blurb && <div className="muted" style={{ fontSize: 13 }}>{plan.blurb}</div>}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
        <div><span className="muted">{t(lang, 'subs_creditsLbl')} </span><strong>{fmtInt(plan.credits)}</strong></div>
        {plan.kind === 'subscription' && (
          <div><span className="muted">{t(lang, 'subs_monthlyLbl')} </span><strong>{fmtInt(plan.monthlyAllowance ?? plan.credits)}</strong></div>
        )}
        <div><span className="muted">{t(lang, 'plans_sort')}: </span><strong>{plan.sortOrder}</strong></div>
      </div>

      {plan.features.length > 0 && (
        <ul style={{ margin: 0, padding: '4px 0 0 18px', color: 'var(--text-2)', fontSize: 13 }}>
          {plan.features.map((f, i) => <li key={i}>{f}</li>)}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={onEdit} style={{ flex: 1 }}>{t(lang, 'edit')}</button>
        <button onClick={onToggle} className={plan.isActive ? '' : 'ok'} style={{ flex: 1 }}>
          {plan.isActive ? t(lang, 'plans_hide') : t(lang, 'plans_show')}
        </button>
        <button onClick={onDelete} className="danger">{t(lang, 'plans_delete')}</button>
      </div>
    </div>
  )
}

export default function Plans() {
  const lang = useLang()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [editing, setEditing] = useState<Plan | 'new' | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true); setErr(null)
    fetchPlans()
      .then((p) => { if (alive) setPlans(p) })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : t(lang, 'failedLoad')) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [lang])

  const groups = useMemo(() => {
    const subs = plans.filter((p) => p.kind === 'subscription')
    const tokens = plans.filter((p) => p.kind === 'token')
    return { subs, tokens }
  }, [plans])

  const toggle = async (p: Plan) => {
    try {
      const u = await updatePlan(p.id, { isActive: !p.isActive })
      setPlans((list) => list.map((x) => x.id === u.id ? u : x))
    } catch (e) { alert(e instanceof Error ? e.message : t(lang, 'actionFailed')) }
  }

  const remove = async (p: Plan) => {
    if (!confirm(t(lang, 'plans_confirmDelete', { name: p.name }))) return
    try {
      await deletePlan(p.id)
      setPlans((list) => list.filter((x) => x.id !== p.id))
    } catch (e) { alert(e instanceof Error ? e.message : t(lang, 'actionFailed')) }
  }

  const onSaved = (saved: Plan) => {
    setPlans((list) => {
      const idx = list.findIndex((x) => x.id === saved.id)
      if (idx === -1) return [...list, saved]
      const next = [...list]
      next[idx] = saved
      return next
    })
    setEditing(null)
  }

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{t(lang, 'plans_title')}</h1>
          <p>{t(lang, 'plans_subtitle')}</p>
        </div>
        <button className="primary" onClick={() => setEditing('new')}>{t(lang, 'plans_new')}</button>
      </div>

      {err && <div className="error-banner">{err}</div>}
      {loading && <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner" /></div>}

      {!loading && (
        <>
          <h2 style={{ margin: '10px 0 12px', fontSize: 14, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t(lang, 'plans_subscriptions')} ({groups.subs.length})
          </h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginBottom: 24 }}>
            {groups.subs.map((p) => (
              <PlanCard key={p.id} plan={p} lang={lang} onEdit={() => setEditing(p)} onToggle={() => toggle(p)} onDelete={() => remove(p)} />
            ))}
            {groups.subs.length === 0 && <div className="card muted" style={{ textAlign: 'center' }}>{t(lang, 'plans_noSubs')}</div>}
          </div>

          <h2 style={{ margin: '10px 0 12px', fontSize: 14, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t(lang, 'plans_tokens')} ({groups.tokens.length})
          </h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            {groups.tokens.map((p) => (
              <PlanCard key={p.id} plan={p} lang={lang} onEdit={() => setEditing(p)} onToggle={() => toggle(p)} onDelete={() => remove(p)} />
            ))}
            {groups.tokens.length === 0 && <div className="card muted" style={{ textAlign: 'center' }}>{t(lang, 'plans_noTokens')}</div>}
          </div>
        </>
      )}

      {editing && (
        <PlanForm
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={onSaved}
          lang={lang}
        />
      )}
    </>
  )
}
