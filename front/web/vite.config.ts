import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is read from VITE_BASE (e.g. set to /v2/ in .env.production when the app
// is served under make-ppt.com/v2). Defaults to / for root deployments.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    server: { port: 5173 },
  }
})
