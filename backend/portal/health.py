"""
Health check endpoints for production monitoring.
"""

import os
from django.db import connection
from django.http import JsonResponse
from django.views import View
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import logging

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name="dispatch")
class HealthCheckView(View):
    """
    Comprehensive health check endpoint.
    Returns status of all system components.
    """

    def get(self, request):
        health = {"status": "healthy", "checks": {}}

        # Check database
        db_status = self._check_database()
        health["checks"]["database"] = db_status

        # Check cache
        cache_status = self._check_cache()
        health["checks"]["cache"] = cache_status

        # Check disk space
        disk_status = self._check_disk()
        health["checks"]["disk"] = disk_status

        # Check environment
        env_status = self._check_environment()
        health["checks"]["environment"] = env_status

        # Only the database decides the status code. Render treats any non-2xx
        # from a configured health-check path as a failed deploy and rolls back
        # to the previous instance, so a degraded cache (Redis restarting, or
        # REDIS_URL pointing somewhere unreachable) or an unset optional env
        # var must not take the whole deployment down — those are reported
        # inside "checks" for the operator to read instead.
        if health["checks"]["database"]["status"] != "ok":
            health["status"] = "unhealthy"
            return JsonResponse(health, status=503)

        return JsonResponse(health)

    def _check_database(self):
        """Check database connectivity and responsiveness."""
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return {"status": "ok", "message": "Database connection successful"}
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {"status": "error", "message": str(e)}

    def _check_cache(self):
        """Check cache connectivity."""
        try:
            from django.core.cache import cache

            cache.set("health_check", "ok", 10)
            value = cache.get("health_check")
            if value == "ok":
                return {"status": "ok", "message": "Cache connection successful"}
            return {"status": "error", "message": "Cache response mismatch"}
        except Exception as e:
            logger.error(f"Cache health check failed: {e}")
            return {"status": "error", "message": str(e)}

    def _check_disk(self):
        """Check available disk space."""
        try:
            import shutil

            stat = shutil.disk_usage("/")
            free_gb = stat.free / (1024**3)
            if free_gb > 1:
                return {"status": "ok", "message": f"{free_gb:.2f}GB free"}
            return {"status": "warning", "message": f"Low disk space: {free_gb:.2f}GB"}
        except Exception as e:
            return {"status": "unknown", "message": str(e)}

    def _check_environment(self):
        """Check critical environment variables."""
        # DEBUG is deliberately absent: settings.py defaults it to False, so an
        # unset var is not a misconfiguration worth failing a health check for.
        required_vars = ["SECRET_KEY"]
        missing = [v for v in required_vars if not os.getenv(v)]
        if missing:
            return {
                "status": "warning",
                "message": f'Missing vars: {", ".join(missing)}',
            }
        return {"status": "ok", "message": "Environment configured"}


class ReadinessView(View):
    """
    Kubernetes-style readiness probe.
    Returns 200 when the app is ready to serve traffic.
    """

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return JsonResponse({"status": "ready"})
        except Exception as e:
            logger.error(f"Readiness check failed: {e}")
            return JsonResponse({"status": "not ready", "error": str(e)}, status=503)


class LivenessView(View):
    """
    Kubernetes-style liveness probe.
    Returns 200 when the app is running properly.
    """

    def get(self, request):
        return JsonResponse({"status": "alive"})
