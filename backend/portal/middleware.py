"""
Custom middleware for error handling and request/response processing.
"""

import logging
import traceback
from django.http import JsonResponse
from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import connection
from django.db.backends.signals import connection_created

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# RLS Context Middleware - sets PostgreSQL session variables for Row Level
# Security policies so that students/recruiters only see their own data.
# ---------------------------------------------------------------------------
def _set_rls_context(sender, connection, **kwargs):
    """Set app.current_user_id and app.current_user_role on every new DB
    connection so RLS policies can reference them."""
    # We store the values on the connection object so the signal handler
    # can pick them up.  The middleware writes to connection.rls_* before
    # any queries fire.
    user_id = getattr(connection, '_rls_user_id', None)
    user_role = getattr(connection, '_rls_user_role', None)

    if user_id is not None and user_role is not None:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT set_config('app.current_user_id', %s, true)",
                [str(user_id)],
            )
            cursor.execute(
                "SELECT set_config('app.current_user_role', %s, true)",
                [user_role],
            )


connection_created.connect(_set_rls_context)


class RLSContextMiddleware:
    """On each request, store the current user's id and role on the DB
    connection so that RLS policies in PostgreSQL can filter rows.

    Add this middleware *before* any middleware that touches the DB, e.g.
    right after AuthenticationMiddleware in settings.MIDDLEWARE.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Default: no user context (anonymous requests see nothing via RLS
        # unless a permissive policy allows it).
        user_id = None
        user_role = None

        if hasattr(request, 'user') and request.user.is_authenticated:
            user_id = request.user.id
            if getattr(request.user, 'is_recruiter', False):
                user_role = 'recruiter'
            elif getattr(request.user, 'is_student', False):
                user_role = 'student'
            else:
                user_role = 'admin'

        # Store on the connection so the signal handler can pick it up
        connection._rls_user_id = user_id
        connection._rls_user_role = user_role

        response = self.get_response(request)

        # Cleanup
        connection._rls_user_id = None
        connection._rls_user_role = None

        return response


class ErrorHandlingMiddleware:
    """
    Middleware to catch and handle exceptions, providing consistent JSON error responses.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.is_debug = settings.DEBUG

    def __call__(self, request):
        response = self.get_response(request)
        return response

    def process_exception(self, request, exception):
        """Handle exceptions and return appropriate JSON responses."""
        # Only intercept API routes; non-API paths (admin, templates) keep
        # Django's native error handling.
        if not request.path.startswith("/api/"):
            return None

        if isinstance(exception, PermissionDenied):
            return JsonResponse(
                {
                    "error": "Permission denied",
                    "message": str(exception),
                    "code": "permission_denied",
                },
                status=403,
            )

        if isinstance(exception, ValidationError):
            return JsonResponse(
                {
                    "error": "Validation error",
                    "message": str(exception),
                    "code": "validation_error",
                },
                status=400,
            )

        # Log the exception
        logger.error(
            f"Unhandled exception: {exception}\n"
            f"Path: {request.path}\n"
            f"Method: {request.method}\n"
            f"Traceback: {traceback.format_exc()}"
        )

        if self.is_debug:
            return JsonResponse(
                {
                    "error": "Server error",
                    "message": str(exception),
                    "type": exception.__class__.__name__,
                    "traceback": traceback.format_exc(),
                    "code": "server_error",
                },
                status=500,
            )

        return JsonResponse(
            {
                "error": "An error occurred",
                "message": "Please contact support if the problem persists.",
                "code": "server_error",
            },
            status=500,
        )


class RequestLoggingMiddleware:
    """
    Middleware to log all incoming requests and responses.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Log request
        logger.debug(
            f"Request: {request.method} {request.path} "
            f"User: {request.user.id if request.user.is_authenticated else 'Anonymous'}"
        )

        response = self.get_response(request)

        # Log response
        logger.debug(
            f"Response: {request.method} {request.path} "
            f"Status: {response.status_code}"
        )

        return response


class CORSCustomHeaders:
    """
    Add custom CORS headers for API security.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Add security headers
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = "DENY"
        response["X-XSS-Protection"] = "1; mode=block"
        response["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Only add CSP in production
        if not settings.DEBUG:
            response["Content-Security-Policy"] = "default-src 'self'"

        return response


class APIVersionMiddleware:
    """
    Add API versioning headers to responses.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response["X-API-Version"] = "1.0"
        response["X-API-Build"] = getattr(settings, "BUILD_VERSION", "dev")
        return response
