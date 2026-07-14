// The third page's shader lights itself from HDR environment maps that
// @shadergradient loads on demand. Its EnvironmentMap component actually loads
// ALL THREE presets (city, dawn, lobby) and suspends until every one resolves —
// that multi-MB download is what makes the page stall the first time it opens.
//
// We warm those files into the browser cache at app start (low-priority prefetch,
// on idle) so the loader gets cache hits when the page is finally opened. The URLs
// and filenames mirror @shadergradient's defaults (dist/chunk-CPUZJ7YV.mjs → base
// path, dist/.../EnvironmentMap.mjs → the three filenames). If the library changes
// its CDN path, this simply stops helping — it never breaks rendering.
const HDR_BASE = 'https://ruucm.github.io/shadergradient/ui@0.0.0/assets/hdr/'
const HDR_FILES = ['city.hdr', 'dawn.hdr', 'lobby.hdr']

let started = false

/** Prefetch the shader env maps once, shortly after the app becomes idle. */
export function preloadShaderEnv(): void {
  if (started || typeof document === 'undefined') return
  started = true
  const run = () => {
    for (const file of HDR_FILES) {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.as = 'fetch'
      link.href = HDR_BASE + file
      link.crossOrigin = 'anonymous' // match three.js's CORS fetch so the cache entry is reused
      document.head.appendChild(link)
    }
  }
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }
  if (typeof w.requestIdleCallback === 'function') w.requestIdleCallback(run, { timeout: 2500 })
  else window.setTimeout(run, 1500)
}
