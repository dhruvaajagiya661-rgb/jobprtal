import os
import mimetypes
import logging
from django.shortcuts import render
from django.conf import settings
from django.http import JsonResponse, HttpResponse

logger = logging.getLogger(__name__)

# Cache the built SPA index.html across requests (re-read only when the file
# changes, e.g. after a rebuild) so page loads don't hit disk every time.
_index_cache = {"mtime": None, "content": None}


def _is_asset_path(rel_path, frontend_dist):
    """Decide whether a request is for a build file rather than an SPA route.

    Everything hashed lives under dist/assets/. The rest of the build root is
    whatever `frontend/public/` holds (favicon.svg, site.webmanifest,
    og-image.png, the PWA icons...), which changes as the site grows, so
    rather than maintain a hardcoded list we accept any single-segment name
    that is a real file in the build root. Multi-segment SPA routes never
    reach the file check, and single-segment ones like "jobs" or "about" have
    no matching file, so they still fall through to index.html.
    """
    if rel_path.startswith("assets/"):
        return True
    if "/" in rel_path or rel_path in ("", ".", ".."):
        return False
    return os.path.isfile(os.path.join(frontend_dist, rel_path))


def home(request):
    """
    Serve the React SPA for all non-API, non-admin routes.

    Real build files (JS, CSS, images, etc.) under frontend/dist are served
    with their correct MIME types; everything else receives index.html so
    React Router can handle the route (SPA fallback).
    """
    frontend_dist = os.path.join(settings.BASE_DIR, "frontend", "dist")
    index_file = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_file):
        # Serve an actual build asset (e.g. /assets/index-<hash>.js) if present.
        rel_path = request.path.lstrip("/")
        if rel_path and _is_asset_path(rel_path, frontend_dist):
            dist_root = os.path.normpath(frontend_dist)
            candidate = os.path.normpath(os.path.join(frontend_dist, rel_path))
            if candidate.startswith(dist_root + os.sep) and os.path.isfile(candidate):
                content_type, _ = mimetypes.guess_type(candidate)
                with open(candidate, "rb") as f:
                    return HttpResponse(
                        f.read(), content_type=content_type or "application/octet-stream"
                    )
            # Missing build asset: return a real 404 instead of the SPA shell.
            return HttpResponse("Not found", status=404)
        mtime = os.path.getmtime(index_file)
        if _index_cache["mtime"] != mtime:
            with open(index_file, "r", encoding="utf-8") as f:
                _index_cache["content"] = f.read()
            _index_cache["mtime"] = mtime
        return HttpResponse(_index_cache["content"], content_type="text/html")
    # Fallback while React is being built
    return render(request, "home.html")


def api_health(request):
    """Simple API health check."""
    return JsonResponse({"status": "ok", "message": "PortAL API is running"})


def custom_404(request, exception=None):
    """
    Project-wide 404 handler.
    - Unknown /api/* routes return JSON (frontend expects JSON errors).
    - Everything else serves the SPA so React Router can render its 404 page.
    """
    if request.path.startswith("/api/") or request.path.startswith("/admin/"):
        return JsonResponse(
            {
                "error": "Not found",
                "message": f"The requested resource '{request.path}' does not exist.",
                "code": "not_found",
            },
            status=404,
        )
    # Safety net: excluded-prefix misses (e.g. /health/<x>) fall back to the SPA.
    return home(request)


def custom_500(request):
    """Project-wide 500 handler returning JSON for API routes."""
    logger.error("Internal server error on %s %s", request.method, request.path)
    if request.path.startswith("/api/") or request.path.startswith("/admin/"):
        return JsonResponse(
            {
                "error": "Internal server error",
                "message": "An unexpected error occurred. Please try again later.",
                "code": "server_error",
            },
            status=500,
        )
    # Non-API pages keep serving the SPA so React can render a friendly error,
    # but preserve the 500 status so uptime monitors still see the failure.
    response = home(request)
    response.status_code = 500
    return response
