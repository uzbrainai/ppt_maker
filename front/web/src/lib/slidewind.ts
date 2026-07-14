import type { Credits, Tier } from '../types'

/** Error from a slidewind API call, carrying the HTTP status and server error code. */
export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function apiError(res: Response, fallback: string): Promise<ApiError> {
  const detail = await res.json().catch(() => null)
  return new ApiError((detail && detail.error) || `${fallback} (HTTP ${res.status})`, res.status, detail && detail.code)
}

// Client for the slidewind PPTX generation service (../../src/services/server.ts,
// exposed by docker-compose on :8081). Point VITE_SLIDEWIND_BASE at it, e.g.
// "http://localhost:8081". When unset, the app falls back to the local mock
// generator so the prototype keeps working without Docker running.
export const SLIDEWIND_BASE: string =
  (import.meta as any).env?.VITE_SLIDEWIND_BASE ||
  (typeof window !== 'undefined' && (window as any).SLIDEWIND_BASE) ||
  ''

// NOTE: the shared SLIDEWIND_TOKEN is intentionally NOT read in the browser. It
// is a master service key that bypasses JWT auth, so it must never ship in a
// public bundle — server-to-server callers send it directly. The browser
// authenticates with the per-user JWT from login (see lib/auth.ts).

export function slidewindEnabled(): boolean {
  return !!SLIDEWIND_BASE
}

// ── Dropdown option lists — one per generation argument the service accepts ──

/** Theme names registered in src/themes/defs.ts. */
export const THEME_OPTIONS: { value: string; label: string }[] = [
  { value: 'modern.enterprise', label: 'Modern Enterprise' },
  { value: 'agrobank.ai', label: 'Agrobank AI' },
  { value: 'dark.tech', label: 'Dark Tech' },
  { value: 'indigo', label: 'Electric Indigo' },
  { value: 'amethyst', label: 'Amethyst' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'sorbet', label: 'Sorbet' },
  { value: 'midnight', label: 'Midnight' },
]

export const APPEARANCE_OPTIONS: { value: 'light' | 'dark'; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
]

export const PAGE_OPTIONS: number[] = [5, 8, 10, 12, 15, 20]

export const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'uz', label: "O'zbekcha" },
  { value: 'ru', label: 'Русский' },
]

export const RESEARCH_OPTIONS: { value: 'on' | 'off'; label: string }[] = [
  { value: 'on', label: 'Web research (grounded)' },
  { value: 'off', label: 'Off (faster)' },
]

/** Percent of slides illustrated with AI photos (premium tier only). */
export const IMAGE_PCT_OPTIONS: number[] = [0, 20, 40, 60, 80]

export const IMAGE_QUALITY_OPTIONS: { value: 'low' | 'medium' | 'high'; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High (costly)' },
]

/** Everything the generation form can tune, with sensible defaults. */
export interface DeckOptions {
  theme: string
  appearance: 'light' | 'dark'
  pages: number
  lang: string
  research: boolean
  imagePct: number
  imageQuality: 'low' | 'medium' | 'high'
}

export const DEFAULT_DECK_OPTIONS: DeckOptions = {
  theme: 'midnight',
  appearance: 'dark',
  pages: 10,
  lang: 'en',
  research: true,
  imagePct: 40,
  imageQuality: 'medium',
}

export interface GenerateResponse {
  title: string
  slides: number
  premium: boolean
  pptxBase64: string
  /** one standalone SVG string per slide, for previewing the real deck */
  previews?: string[]
  yaml: string
  sources?: { url: string; title?: string }[]
  warnings?: number
  /** updated credit balance after this generation (when tracking is on) */
  credits?: Credits & { charged: number }
}

/** POST /generate on the slidewind service. Throws on a non-2xx response. */
export async function generateDeck(
  topic: string,
  tier: Tier,
  opts: DeckOptions,
  authHeaders: Record<string, string> = {},
): Promise<GenerateResponse> {
  const premium = tier === 'premium'
  const body: Record<string, unknown> = {
    topic,
    theme: opts.theme,
    mode: opts.appearance,
    pages: opts.pages,
    lang: opts.lang,
    research: opts.research,
    premium,
    ...(premium ? { imagePct: opts.imagePct, imageQuality: opts.imageQuality } : {}),
  }
  const res = await fetch(SLIDEWIND_BASE.replace(/\/$/, '') + '/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await apiError(res, 'Generation failed')
  return res.json() as Promise<GenerateResponse>
}

function headers(auth: Record<string, string>): Record<string, string> {
  return { 'Content-Type': 'application/json', ...auth }
}

function reqBody(topic: string, tier: Tier, opts: DeckOptions): Record<string, unknown> {
  const premium = tier === 'premium'
  return {
    topic,
    theme: opts.theme,
    mode: opts.appearance,
    pages: opts.pages,
    lang: opts.lang,
    research: opts.research,
    premium,
    ...(premium ? { imagePct: opts.imagePct, imageQuality: opts.imageQuality } : {}),
  }
}

export interface StreamDone {
  deckId: string
  title: string
  slides: number
  premium: boolean
  pptxBase64: string
  previews?: string[]
  sources?: { url: string; title?: string }[]
  warnings?: number
  /** updated credit balance after this generation (when tracking is on) */
  credits?: Credits & { charged: number }
}

/**
 * POST /generate/stream and surface real progress events. Calls onProgress with
 * each backend stage message; resolves with the final deck. Throws on error.
 */
export async function generateDeckStream(
  topic: string,
  tier: Tier,
  opts: DeckOptions,
  authHeaders: Record<string, string>,
  onProgress: (msg: string) => void,
): Promise<StreamDone> {
  const res = await fetch(SLIDEWIND_BASE.replace(/\/$/, '') + '/generate/stream', {
    method: 'POST',
    headers: headers(authHeaders),
    body: JSON.stringify(reqBody(topic, tier, opts)),
  })
  if (!res.ok || !res.body) throw await apiError(res, 'Generation failed')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let done: StreamDone | null = null
  let err: string | null = null

  // Parse Server-Sent-Event frames (separated by a blank line).
  for (;;) {
    const { value, done: streamEnded } = await reader.read()
    if (streamEnded) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, nl)
      buf = buf.slice(nl + 2)
      let event = 'message'
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      let parsed: { message?: string; error?: string } & Partial<StreamDone>
      try { parsed = JSON.parse(data) } catch { continue }
      if (event === 'progress') onProgress(parsed.message || '')
      else if (event === 'done') done = parsed as StreamDone
      else if (event === 'error') err = parsed.error || 'Generation failed'
    }
  }
  if (err) throw new Error(err)
  if (!done) throw new Error('Generation ended unexpectedly')
  return done
}

export interface EditableText {
  id: string
  text: string
  x: number; y: number; w: number; h: number
  sizePt: number
  bold: boolean
  italic: boolean
  color: string
  align: 'left' | 'center' | 'right'
  vAlign: 'top' | 'middle' | 'bottom'
  lineSpacing: number
}

export interface EditorData {
  title: string
  size: { width: number; height: number }
  /** one text-less SVG per slide (overlay editable text on top) */
  backgrounds: string[]
  slides: { texts: EditableText[] }[]
}

/** Load the editable text boxes + backgrounds for a stored deck. */
export async function fetchEditor(deckId: string, authHeaders: Record<string, string> = {}): Promise<EditorData> {
  const res = await fetch(`${SLIDEWIND_BASE.replace(/\/$/, '')}/deck/${deckId}/editor`, { headers: headers(authHeaders) })
  if (!res.ok) throw await apiError(res, 'Could not load editor')
  return res.json() as Promise<EditorData>
}

/** AI rewrite for magic editor. Returns the new text string. */
export async function rewriteText(
  text: string,
  instruction: string,
  authHeaders: Record<string, string> = {},
): Promise<string> {
  const res = await fetch(`${SLIDEWIND_BASE.replace(/\/$/, '')}/rewrite`, {
    method: 'POST',
    headers: headers(authHeaders),
    body: JSON.stringify({ text, instruction }),
  })
  if (!res.ok) throw await apiError(res, 'Rewrite failed')
  const data = (await res.json()) as { text: string }
  return data.text
}

export interface BuildResult { title: string; slides: number; pptxBase64: string; previews: string[] }

/** Apply text edits and recompile the .pptx for a stored deck. */
export async function buildDeck(deckId: string, edits: Record<string, string>, authHeaders: Record<string, string> = {}): Promise<BuildResult> {
  const res = await fetch(`${SLIDEWIND_BASE.replace(/\/$/, '')}/deck/${deckId}/build`, {
    method: 'POST',
    headers: headers(authHeaders),
    body: JSON.stringify({ edits }),
  })
  if (!res.ok) throw await apiError(res, 'Save failed')
  return res.json() as Promise<BuildResult>
}

export interface PdfResult { title: string; slides: number; pdfBase64: string }

/** Apply edits, recompile, and convert the deck to PDF (LibreOffice, server-side). */
export async function buildDeckPdf(deckId: string, edits: Record<string, string>, authHeaders: Record<string, string> = {}): Promise<PdfResult> {
  const res = await fetch(`${SLIDEWIND_BASE.replace(/\/$/, '')}/deck/${deckId}/pdf`, {
    method: 'POST',
    headers: headers(authHeaders),
    body: JSON.stringify({ edits }),
  })
  if (!res.ok) throw await apiError(res, 'PDF export failed')
  return res.json() as Promise<PdfResult>
}

/** Decode a base64 blob and trigger a browser download with the given MIME + extension. */
function downloadBase64(base64: string, filename: string, mime: string, ext: string): void {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.toLowerCase().endsWith(ext) ? filename : `${filename}${ext}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Decode a base64 .pptx and trigger a browser download. */
export function downloadPptx(base64: string, filename: string): void {
  downloadBase64(base64, filename, 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.pptx')
}

/** Decode a base64 .pdf and trigger a browser download. */
export function downloadPdf(base64: string, filename: string): void {
  downloadBase64(base64, filename, 'application/pdf', '.pdf')
}
