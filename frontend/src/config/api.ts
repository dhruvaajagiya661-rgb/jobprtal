/**
 * Where the SPA finds the backend API and its websocket endpoints.
 *
 * Local dev leaves VITE_API_BASE unset: API_BASE stays at "/api" and Vite's
 * dev-server proxy forwards to the Django process on :8000, exactly as before.
 *
 * When the frontend and backend deploy separately (Vercel SPA + Render API),
 * set VITE_API_BASE to the backend origin at build time, e.g.
 *   VITE_API_BASE=https://portal-web-1f60.onrender.com/api
 * Relative paths would otherwise resolve against the Vercel origin, where no
 * Django lives — and Vercel cannot proxy websockets at all, so the websocket
 * base needs the same treatment.
 */

const RAW_API_BASE = import.meta.env.VITE_API_BASE || '/api';

/** Root for every axios call: "/api" in dev, an absolute URL in production. */
export const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

/**
 * Turn a path into a URL that always points at the backend, even when the
 * frontend is served from another origin (Vercel). Used for media links the
 * backend returns as relative paths (e.g. "/media/resumes/x.pdf") — those
 * must resolve against Render, not the SPA host.
 */
export function backendUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const origin = API_BASE.startsWith('http')
    ? API_BASE.match(/^https?:\/\/[^/]+/i)?.[0] ?? ''
    : '';
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Base for websocket URLs ("ws://" or "wss://").
 * Explicit VITE_WS_BASE wins; otherwise derive from VITE_API_BASE's host
 * when it is absolute; otherwise same-origin (dev, where Vite proxies /ws).
 */
export function wsBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_WS_BASE;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  if (API_BASE.startsWith('http')) {
    try {
      return API_BASE.replace(/^http/i, 'ws');
    } catch {
      /* fall through to same-origin */
    }
  }
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${
    window.location.host
  }`;
}
