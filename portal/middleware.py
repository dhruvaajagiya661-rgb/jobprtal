"""
Custom middleware for error handling and request/response processing.
"""

import logging
import traceback
from django.http import JsonResponse
from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError

logger = logging.getLogger(__name__)


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
