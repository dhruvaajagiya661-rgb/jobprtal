"""
URL configuration for portal project.
API-first routing with React SPA catch-all.
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from .views import home, api_health
from .health import HealthCheckView, ReadinessView, LivenessView
from analytics.views import admin_analytics_dashboard
from .admin_dashboard import admin_dashboard
from .admin_api import AdminDashboardAPIView, AdminDeleteAPIView, AdminUpdateAPIView
from .site_api import PlatformStatsAPIView, ContactAPIView
from .seo import robots_txt, sitemap_xml
from rest_framework import routers
from jobs.api import JobViewSet, SkillListView
from internships.api import InternshipViewSet
from applications.api import ApplicationViewSet
from students.api import StudentProfileViewSet
from recruiters.api import RecruiterViewSet
from notifications.api import NotificationViewSet
from chat.api import MessageViewSet
from careers.api import CareerPathViewSet, InterviewPrepViewSet, SkillGapViewSet
from analytics.api import AnalyticsViewSet
from feed.api import FeedViewSet
from network.api import (
    ConnectionViewSet,
    EndorsementViewSet,
    RecommendationViewSet,
    ProfileViewSet,
    FollowViewSet,
    PublicProfileViewSet,
)
from learning.api import CourseViewSet, LessonViewSet
from recruiters.api import CompanyPageViewSet, JobAlertViewSet
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

# API Router
router = routers.DefaultRouter(trailing_slash=True)
router.register(r"jobs", JobViewSet, basename="job-api")
router.register(r"internships", InternshipViewSet, basename="internship-api")
router.register(r"applications", ApplicationViewSet, basename="application-api")
router.register(r"students", StudentProfileViewSet, basename="student-api")
router.register(r"recruiters", RecruiterViewSet, basename="recruiter-api")
router.register(r"notifications", NotificationViewSet, basename="notification-api")
router.register(r"messages", MessageViewSet, basename="message-api")
router.register(r"career-paths", CareerPathViewSet, basename="careerpath-api")
router.register(r"interview-prep", InterviewPrepViewSet, basename="interviewprep-api")
router.register(r"skill-gap", SkillGapViewSet, basename="skillgap-api")
router.register(r"analytics", AnalyticsViewSet, basename="analytics-api")
router.register(r"feed", FeedViewSet, basename="feed-api")
router.register(r"connections", ConnectionViewSet, basename="connection-api")
router.register(r"endorsements", EndorsementViewSet, basename="endorsement-api")
router.register(r"recommendations", RecommendationViewSet, basename="recommendation-api")
router.register(r"profile-views", ProfileViewSet, basename="profileview-api")
router.register(r"follows", FollowViewSet, basename="follow-api")
router.register(r"public-profiles", PublicProfileViewSet, basename="publicprofile-api")
router.register(r"courses", CourseViewSet, basename="course-api")
router.register(r"lessons", LessonViewSet, basename="lesson-api")
router.register(r"company-pages", CompanyPageViewSet, basename="companypage-api")
router.register(r"job-alerts", JobAlertViewSet, basename="jobalert-api")

urlpatterns = [
    # API root
    path("api/", api_health, name="api-root"),
    path("api/v1/", include(router.urls)),
    # All known skills (consumed by the student profile editor)
    path("api/v1/skills/", SkillListView.as_view(), name="skills-list"),
    # Auth endpoints (using SimpleJWT + custom views)
    path("api/auth/register/", include("accounts.urls_api")),
    path("api/auth/", include("accounts.urls_jwt")),
    # Health checks
    path("health/", HealthCheckView.as_view(), name="health_check"),
    path("ready/", ReadinessView.as_view(), name="readiness"),
    path("alive/", LivenessView.as_view(), name="liveness"),
    # API Documentation (Swagger)
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # Admin
    path("admin/dashboard/", admin_dashboard, name="admin_dashboard"),
    path("admin/analytics/", admin_analytics_dashboard, name="admin_analytics"),
    path(settings.ADMIN_URL, admin.site.urls),
    # Admin dashboard JSON API (superuser only, consumed by the SPA page)
    path("api/v1/admin/dashboard/", AdminDashboardAPIView.as_view(), name="admin_api_dashboard"),
    # Admin record deletion (superuser only)
    path("api/v1/admin/delete/", AdminDeleteAPIView.as_view(), name="admin_api_delete"),
    # Admin record editing (superuser only)
    path("api/v1/admin/update/", AdminUpdateAPIView.as_view(), name="admin_api_update"),
    # Public site endpoints (home page counters, contact form)
    path("api/v1/platform/stats/", PlatformStatsAPIView.as_view(), name="platform_stats"),
    path("api/v1/platform/contact/", ContactAPIView.as_view(), name="platform_contact"),
    # SEO: served by Django so they work with or without a built SPA
    path("robots.txt", robots_txt, name="robots_txt"),
    path("sitemap.xml", sitemap_xml, name="sitemap_xml"),
    # Serve React SPA for all other routes (catch-all).
    # Unknown /api/* and /admin/* paths fall through to custom_404 (JSON).
    re_path(
        r"^(?!api/|admin/|media/|static/|health/|ready/|alive/|robots\.txt|sitemap\.xml).*$",
        home,
        name="home",
    ),
]

# Project-wide error handlers
handler404 = "portal.views.custom_404"
handler500 = "portal.views.custom_500"

# Add media URL serving in development
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
