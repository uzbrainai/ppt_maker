import type { DocItem, User } from '../types'

// Persistent storage for client-only documents (course works and independent
// works). The backend doesn't yet have generation endpoints for these, so we
// mock them locally in `lib/generate.ts:buildDoc`. Without persistence they'd
// vanish on page reload — this module keeps them keyed per user in
// localStorage so users see their history come back.

const KEY_PREFIX = 'pptmaker-local-docs::'

function storageKey(userId: string | null | undefined): string {
  return KEY_PREFIX + (userId || 'anon')
}

/** Read the local docs for a user. Returns [] on any error / no user. */
export function readLocalDocs(user: User | null): DocItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(user?.id ?? user?.email))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as DocItem[]) : []
  } catch {
    return []
  }
}

/** Write the local docs for a user. Silently no-ops on quota / no window. */
export function writeLocalDocs(user: User | null, docs: DocItem[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(user?.id ?? user?.email), JSON.stringify(docs))
  } catch {
    /* quota exceeded / private mode — silent */
  }
}

/** True if a doc was created client-side (no server `deckId`) and should be
 *  persisted by this module. Course works & independent works only. */
export function isLocalDoc(d: DocItem): boolean {
  if (d.isJob) return false
  if (d.deckId) return false
  return d.type === 'kurs' || d.type === 'mustaqil'
}
