"""
Custom DRF exception handler.

Returns a consistent JSON error envelope for every API error:

    {"error": ..., "message": ..., "code": ...}

- 400 Validation errors keep their field-level details under "fields".
- 429 throttling errors include the retry wait in seconds.
- Unhandled exceptions are logged and returned as a generic 500 (no internals leaked).
"""

import logging

from django.http import JsonResponse
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.exceptions import Throttled

logger = logging.getLogger("portal.exceptions")

ERROR_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "permission_denied",
    404: "not_found",
    405: "method_not_allowed",
    429: "too_many_requests",
    500: "server_error",
}


def _flatten_detail(detail):
    """Turn DRF's detail (string, list, or dict) into a human-readable message."""
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        return "; ".join(str(item) for item in detail)
    if isinstance(detail, dict):
        return "; ".join(
            f"{key}: {_flatten_detail(value)}" for key, value in detail.items()
        )
    return str(detail)


def custom_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    request = context.get("request")
    path = getattr(request, "path", "unknown")

    # Unhandled exception -> 500 with a safe, generic message.
    if response is None:
        logger.exception("Unhandled API exception at %s", path)
        return JsonResponse(
            {
                "error": "Internal server error",
                "message": "An unexpected error occurred. Please try again later.",
                "code": "server_error",
            },
            status=500,
        )

    status_code = response.status_code
    code = ERROR_CODES.get(status_code, "error")

    data = response.data
    detail = data.get("detail", data) if isinstance(data, dict) else data
    message = _flatten_detail(detail)

    body = {
        "error": message or "Request failed",
        "message": message or "Request failed",
        "code": code,
    }

    if isinstance(exc, Throttled):
        wait = int(exc.wait or 0)
        body["error"] = "Rate limit exceeded. Please try again later."
        body["message"] = f"Rate limit exceeded. Please retry in {wait} seconds."
        body["retry_after"] = wait

    # Keep field-level validation errors for the frontend forms.
    if status_code == 400 and isinstance(data, dict) and "detail" not in data:
        body["fields"] = data

    if status_code >= 500:
        logger.exception("API error %s at %s: %s", status_code, path, exc)

    response.data = body
    return response
