import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query. Re-renders when the match state changes.
 * Returns `false` during SSR / before mount.
 */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mql = window.matchMedia(query)
    const on = () => setMatches(mql.matches)
    on()
    mql.addEventListener('change', on)
    return () => mql.removeEventListener('change', on)
  }, [query])
  return matches
}

/** Handy: true when viewport is ≤ 768px (phones + small tablets). */
export const useIsMobile = () => useMedia('(max-width: 768px)')
/** ≤ 1024px (add tablet-portrait handling). */
export const useIsTablet = () => useMedia('(max-width: 1024px)')
