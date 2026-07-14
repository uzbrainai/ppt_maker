import type { Credits, DocItem, ProductId, Tier } from '../types'
import { apiHeaders } from './auth'
import { generateDeckStream, slidewindEnabled, type DeckOptions } from './slidewind'
import { getStoredLang, t, type Lang } from './i18n'

let seq = 0

function newId(): string {
  return 'gen-' + Date.now().toString(36) + '-' + seq++
}

function defaultTitle(p: ProductId, lang: Lang): string {
  return p === 'ppt' ? t(lang, 'untitledPpt') : p === 'kurs' ? t(lang, 'untitledKurs') : t(lang, 'untitledMustaqil')
}

/** Result of a generation: the dashboard item plus real per-slide SVG previews. */
export interface GenerationResult {
  doc: DocItem
  /** standalone SVG strings, one per slide (empty for the local mock path) */
  previews: string[]
  /** base64-encoded .pptx, so the UI can offer a Download button on demand */
  pptxBase64?: string
  /** updated credit balance after this generation (when tracking is on) */
  credits?: Credits & { charged: number }
}

export async function createDocument(
  product: ProductId,
  prompt: string,
  tier: Tier,
  options: DeckOptions,
  onProgress: (msg: string) => void = () => {},
): Promise<GenerationResult> {
  const topic = (prompt || '').replace(/\s+/g, ' ').trim()
  const lang = getStoredLang()

  if (product === 'ppt' && slidewindEnabled()) {
    const res = await generateDeckStream(topic, tier, options, apiHeaders(), onProgress)
    const title = res.title || (topic ? topic.slice(0, 64) : defaultTitle('ppt', lang))
    const previews = res.previews ?? []
    const doc: DocItem = {
      id: newId(),
      type: 'ppt',
      title,
      category: t(lang, 'aiGenerated'),
      tags: [
        tier === 'premium' ? 'premium' : 'general',
        t(lang, 'slidesCount', { n: res.slides }),
        options.theme,
        'PPTX',
      ],
      updated: t(lang, 'justNow'),
      deckId: res.deckId,
      cover: previews[0],
      pageCount: res.slides,
      slides: [
        { title, bullets: [t(lang, 'slidesCount', { n: res.slides }), t(lang, 'themeAppearance', { theme: options.theme, appearance: options.appearance }), t(lang, 'editableOnCanvas')] },
      ],
    }
    return { doc, previews, pptxBase64: res.pptxBase64, credits: res.credits }
  }

  return { doc: buildDoc(product, prompt, tier, lang), previews: [] }
}

export function buildDoc(product: ProductId, prompt: string, tier: Tier, lang: Lang = getStoredLang()): DocItem {
  const id = 'gen-' + Date.now().toString(36) + '-' + seq++
  const topic = (prompt || '').replace(/\s+/g, ' ').trim()
  const title = topic ? topic.slice(0, 64) : defaultTitle(product, lang)
  const tags = [tier === 'premium' ? 'premium' : 'general', t(lang, 'aiGenerated')]
  const base = { id, type: product, title, category: t(lang, 'aiGenerated'), tags, updated: t(lang, 'justNow') }

  if (product === 'ppt') {
    return {
      ...base,
      slides: [
        { title, bullets: [t(lang, 'genFromPrompt'), tier === 'premium' ? t(lang, 'premiumDesignHint') : t(lang, 'standardQuality')] },
        { title: t(lang, 'overview'), bullets: [topic || t(lang, 'setContext'), t(lang, 'whyItMatters')] },
        { title: t(lang, 'keyPoints'), bullets: [t(lang, 'firstKey'), t(lang, 'secondKey'), t(lang, 'thirdKey')] },
        { title: t(lang, 'details'), bullets: [t(lang, 'supportingDetail'), t(lang, 'exampleEvidence')] },
        { title: t(lang, 'summary'), bullets: [t(lang, 'recapMain'), t(lang, 'nextSteps')] },
      ],
    }
  }

  const sections = [
    { heading: t(lang, 'introduction'), body: topic ? t(lang, 'introTopic', { topic }) : t(lang, 'introEmpty') },
    { heading: product === 'kurs' ? t(lang, 'chapter1Background') : t(lang, 'mainSection'), body: t(lang, 'generatedBody') },
    { heading: product === 'kurs' ? t(lang, 'chapter2Analysis') : t(lang, 'discussion'), body: t(lang, 'expandAnalysis') },
    { heading: t(lang, 'conclusion'), body: t(lang, 'conclusionBody') },
  ]
  if (product === 'kurs') sections.push({ heading: t(lang, 'references'), body: t(lang, 'referencesSample') })
  return { ...base, sections }
}
