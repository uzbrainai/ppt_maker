import type { ProductId, Tier } from '../types'
import type { DeckOptions } from './slidewind'
import { mapStage } from '../components/GenProgress'
import { getStoredLang, t } from './i18n'

export type GenJobStatus = 'queued' | 'generating' | 'done' | 'error'

/** In-flight (or failed) presentation generation tracked in the profile list. */
export interface GenJob {
  id: string
  status: GenJobStatus
  product: ProductId
  prompt: string
  tier: Tier
  options: DeckOptions
  title: string
  stage: number
  label: string
  error?: string
  deckId?: string
  pageCount?: number
  cover?: string
  createdAt: number
}

let seq = 0

export function newJobId(): string {
  return 'job-' + Date.now().toString(36) + '-' + (seq++).toString(36)
}

export function provisionalTitle(prompt: string): string {
  const trimmed = prompt.replace(/\s+/g, ' ').trim()
  return trimmed ? trimmed.slice(0, 64) : t(getStoredLang(), 'untitledPpt')
}

export function progressFromMessage(prevStage: number, msg: string): { stage: number; label: string } {
  return { label: msg, stage: Math.max(prevStage, mapStage(msg)) }
}
