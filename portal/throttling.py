"""
Custom throttle classes.

Global limits live in settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] and are
configurable via environment variables (THROTTLE_ANON_RATE, THROTTLE_USER_RATE,
THROTTLE_AUTH_RATE).
"""

from rest_framework.throttling import AnonRateThrottle


class AuthRateThrottle(AnonRateThrottle):
    """
    Throttle for authentication endpoints (login/register).

    Keyed by IP + account email so one user's attempts don't drain the budget
    of other users sharing the same IP (schools, offices, NAT). Protects
    against credential stuffing / bot registrations while remaining generous
    for real users. Rate is set by the "auth" scope in DEFAULT_THROTTLE_RATES.
    """

    scope = "auth"

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        # Custom login/register views send "email"; SimpleJWT's TokenObtainPairView
        # sends the USERNAME_FIELD value as "username" (which is the email here).
        email = str(
            request.data.get("email") or request.data.get("username") or ""
        ).strip().lower()
        # Anonymous auth requests are throttled per IP; include the account
        # email when provided so a shared IP isn't exhausted by one account.
        return self.cache_format % {"scope": self.scope, "ident": f"{ident}:{email}"}
