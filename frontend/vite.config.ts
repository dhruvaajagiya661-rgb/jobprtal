import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal ambient declaration for the one Node global this config reads. The
// alternative is pulling in @types/node purely for a single env lookup.
declare const process: { env: Record<string, string | undefined> }

// Absolute URLs are required in og:/canonical/JSON-LD tags -- relative ones are
// ignored by crawlers. index.html carries a %SITE_URL% placeholder that this
// plugin fills at build time from VITE_SITE_URL, so the same source file works
// for localhost and for production without hardcoding a domain.
const siteUrl = (process.env.VITE_SITE_URL || 'http://localhost:8000').replace(/\/+$/, '')

const injectSiteUrl = {
  name: 'inject-site-url',
  transformIndexHtml(html: string) {
    return html.replaceAll('%SITE_URL%', siteUrl)
  },
}

export default defineConfig({
  plugins: [react(), injectSiteUrl],
  build: {
    rollupOptions: {
      output: {
        // Split stable vendor code from app code so browsers cache the
        // framework chunk across app deploys and the main chunk stays small.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          data: ['@tanstack/react-query', 'axios'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
      '/media': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/static': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})

