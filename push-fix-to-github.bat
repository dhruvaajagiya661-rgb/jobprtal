@echo off
cd /d "%~dp0"
echo == PortAL: pushing the ASGI boot fix to GitHub ==
echo.
git add backend/portal/asgi.py
git commit -m "Fix ASGI boot: init Django before importing channels routing"
git push origin main
echo.
echo == Done. No errors above means GitHub has the fix and Render can redeploy. ==
echo == Next: Render dashboard, service portal-web, Manual Deploy.              ==
echo.
pause
