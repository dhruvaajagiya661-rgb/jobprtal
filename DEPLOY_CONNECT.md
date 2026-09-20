# Connecting the Vercel frontend to the Render backend

Frontend: https://jobprtal-1.vercel.app (Vercel, SPA only)
Backend:  https://portal-web-1f60.onrender.com (Render, Django + Daphne)

## What was changed in code

| File | Change |
|---|---|
| `frontend/src/config/api.ts` | **New.** Reads `VITE_API_BASE` / `VITE_WS_BASE`, exports `API_BASE`, `wsBaseUrl()`, `backendUrl()`. Dev default is unchanged (`/api` + Vite proxy). |
| `frontend/src/api/client.ts` | Imports `API_BASE` from the config module (no more inline `import.meta.env`). |
| `frontend/src/context/NotificationContext.tsx` | Notification websocket now uses `wsBaseUrl()` — points at Render in prod. |
| `frontend/src/pages/chat/Chat.tsx` | Chat websocket uses `wsBaseUrl()` — Vercel cannot proxy websockets, so this is required. |
| `frontend/src/pages/admin/AdminDashboard.tsx` | Resume links go through `mediaUrl()` so relative `/media/...` paths resolve against Render. |
| `frontend/src/utils/mediaUrl.ts` | **New.** Tiny helper wrapping `backendUrl()`. |
| `backend/portal/settings.py` | Adds `CORS_ALLOWED_ORIGIN_REGEXES` for `*.vercel.app` + wildcard CSRF origin, so any Vercel subdomain (including preview builds) is trusted. |

## 1. Set env vars in Vercel (then redeploy)

Project **jobprtal** → Settings → Environment Variables (applies to
Production/Preview/Development as you prefer):

```
VITE_API_BASE = https://portal-web-1f60.onrender.com/api
VITE_WS_BASE  = wss://portal-web-1f60.onrender.com
```

Notes:
- `VITE_*` vars are baked in at **build time** — after adding them, trigger
  a redeploy (Deployments → ⋯ → Redeploy). If you deploy from Git, push or
  click redeploy; `vercel --prod` from CLI also works.
- `VITE_SITE_URL` should also be set to `https://jobprtal-1.vercel.app`
  (or your real domain) so canonical/OG tags point at the right origin.
- Local dev needs nothing: with `VITE_API_BASE` unset, everything falls back
  to the current Vite proxy behaviour.

## 2. Set env vars on Render (then redeploy)

Service → Environment:

```
CORS_ALLOWED_ORIGINS = https://jobprtal-1.vercel.app,http://localhost:5173,http://localhost:8000
CSRF_TRUSTED_ORIGINS = https://jobprtal-1.vercel.app,http://localhost:5173,http://localhost:8000
ALLOWED_HOSTS        = portal-web-1f60.onrender.com
SITE_URL             = https://jobprtal-1.vercel.app
```

Even without these, the new settings code already trusts `*.vercel.app` for
CORS and CSRF — the explicit vars just document the real origin.

## 3. Deploy both

- **Frontend:** commit + push (or `vercel --prod`).
- **Backend:** commit + push — Render redeploys on push.

## 4. Verify

1. `curl https://portal-web-1f60.onrender.com/api/v1/platform/stats/` → JSON (not HTML).
2. Open https://jobprtal-1.vercel.app → home shows real counters.
3. Register/login → JWT requests go to Render, browser console shows no CORS errors.
4. Chat page → websocket connects to `wss://portal-web-1f60.onrender.com/ws/chat/...` (Render supports WS).
5. Admin dashboard → "View" resume links open Render-hosted files.
