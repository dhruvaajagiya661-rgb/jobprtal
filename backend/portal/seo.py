"""robots.txt and sitemap.xml.

Served by Django rather than shipped as static files in the SPA build so the
URLs work in development (before `npm run build`) and so the sitemap can list
live job and internship detail pages.
"""

from xml.sax.saxutils import escape

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

SITEMAP_CACHE_KEY = "portal:sitemap:v1"
SITEMAP_CACHE_SECONDS = 3600

# Public SPA routes worth indexing, with their relative crawl priority.
STATIC_ROUTES = [
    ("", "1.0", "daily"),
    ("jobs", "0.9", "hourly"),
    ("internships", "0.9", "hourly"),
    ("careers/paths", "0.7", "weekly"),
    ("careers/interview-prep", "0.7", "weekly"),
    ("about", "0.5", "monthly"),
    ("contact", "0.5", "monthly"),
    ("privacy", "0.3", "yearly"),
    ("terms", "0.3", "yearly"),
    ("register", "0.6", "monthly"),
    ("login", "0.4", "monthly"),
]

# Anything behind auth, machine-facing, or user-specific stays out of the index.
DISALLOWED_PATHS = [
    "/api/",
    "/admin/",
    f"/{settings.ADMIN_URL.strip('/')}/",
    "/student/",
    "/recruiter/",
    "/admin-portal/",
    "/notifications",
    "/chat",
    "/feed",
    "/network",
    "/media/",
]


@require_GET
def robots_txt(request):
    site = settings.SITE_URL.rstrip("/")
    lines = ["User-agent: *"]
    lines += [f"Disallow: {path}" for path in dict.fromkeys(DISALLOWED_PATHS)]
    lines += ["", f"Sitemap: {site}/sitemap.xml", ""]
    return HttpResponse("\n".join(lines), content_type="text/plain; charset=utf-8")


def _url_entry(site, path, lastmod, changefreq, priority):
    loc = f"{site}/{path}" if path else f"{site}/"
    parts = [f"  <url>\n    <loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"    <lastmod>{lastmod:%Y-%m-%d}</lastmod>")
    parts.append(f"    <changefreq>{changefreq}</changefreq>")
    parts.append(f"    <priority>{priority}</priority>\n  </url>")
    return "\n".join(parts)


@require_GET
def sitemap_xml(request):
    cached = cache.get(SITEMAP_CACHE_KEY)
    if cached is not None:
        return HttpResponse(cached, content_type="application/xml; charset=utf-8")

    from internships.models import Internship
    from jobs.models import Job

    site = settings.SITE_URL.rstrip("/")
    today = timezone.now().date()
    entries = [
        _url_entry(site, path, None, changefreq, priority)
        for path, priority, changefreq in STATIC_ROUTES
    ]

    for job in Job.objects.filter(is_active=True, deadline__gte=today).only(
        "id", "created_at"
    )[:5000]:
        entries.append(
            _url_entry(site, f"jobs/{job.id}", job.created_at, "weekly", "0.8")
        )

    for internship in Internship.objects.filter(
        is_active=True, deadline__gte=today
    ).only("id", "created_at")[:5000]:
        entries.append(
            _url_entry(
                site,
                f"internships/{internship.id}",
                internship.created_at,
                "weekly",
                "0.8",
            )
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    cache.set(SITEMAP_CACHE_KEY, xml, SITEMAP_CACHE_SECONDS)
    return HttpResponse(xml, content_type="application/xml; charset=utf-8")
