export type ProductId = 'ppt' | 'kurs' | 'mustaqil'
export type Theme = 'dark' | 'light'
export type Tier = 'general' | 'premium'
export type View = 'landing' | 'auth' | 'profile' | 'editor'
export type AuthMode = 'signin' | 'signup'

export type UploadChip = [label: string, color: string, icon: string]
export type Field = [label: string, value: string | string[]]
export type FlowStep = [icon: string, title: string, desc: string, time: string, status: string, trigger: string | null]
export type Feature = [grad: [string, string], icon: string, title: string, desc: string]
export type TemplateCard = [title: string, kind: string, c1: string, c2: string, c3: string]
export type WorkflowStep = [n: string, title: string, desc: string, c1: string, c2: string]

export interface ProductConfig {
  tab: string
  accent: string
  badge: string
  titleLead: string
  titleEmph: string
  subtitle: string
  primaryBtn: string
  footline: string
  flowTitle: string
  promptText: string
  generateLabel: string
  uploads: UploadChip[]
  fields: Field[]
  categories: string[]
  flow: FlowStep[]
  featuresHeading: string
  features: Feature[]
  templatesHeading: string
  templateMeta: string
  templates: TemplateCard[]
  workflowHeading: string
  workflow: WorkflowStep[]
  ctaHeading: string
  ctaSub: string
  ctaBtn: string
}

export interface Slide { title: string; bullets: string[] }
export interface Section { heading: string; body: string }
export interface DocItem {
  id: string
  type: ProductId
  title: string
  category: string
  tags: string[]
  updated: string
  /** Number of slides (shown on profile list status). */
  pageCount?: number
  slides?: Slide[]
  sections?: Section[]
  /** id of the generated deck on the slidewind service (enables the canvas editor) */
  deckId?: string
  /** cover slide preview (SVG string) shown as the dashboard thumbnail */
  cover?: string
  /** Profile list / queue status */
  status?: 'queued' | 'generating' | 'ready' | 'error'
  /** Latest generation progress message (in-flight jobs). */
  progressLabel?: string
  progressStage?: number
  /** True when this row is a live generation job (not yet a saved material). */
  isJob?: boolean
}

export interface User { id?: string; name: string; email: string; plan?: string; role?: string }

/** Credit balance for the signed-in user (1 credit = 1 generated page). */
export interface Credits { balance: number; monthlyAllowance: number; period: string; unlimited?: boolean }
