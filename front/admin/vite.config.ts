import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Admin panel (separate SPA from front/web). Talks to the same slidewind backend
// via /api (proxied by nginx in prod, or set VITE_API_BASE for dev).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_BASE || '/',
    plugins: [react()],
    server: { port: 5174 },
  }
})
