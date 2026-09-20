@echo off
cd /d "%~dp0"
echo == PortAL: pushing deploy fixes to GitHub ==
echo.
git add backend/portal/asgi.py
git add backend/portal/health.py
git add backend/portal/settings.py
git add docker-start.sh
git commit -m "Fix ASGI boot, stop health checks from rolling back deploys, accept DATABASE_URL"
git push origin main
echo.
echo == Done. No errors above means GitHub has the fix and Render can redeploy. ==
echo == Next: Render dashboard, service portal-web, Manual Deploy.              ==
echo.
pause
