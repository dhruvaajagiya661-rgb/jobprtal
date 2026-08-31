"""
Shared authentication helpers.

LenientJWTAuthentication is used by read-only convenience endpoints (e.g.
notifications/messages unread_count) that the SPA polls in the background.
It must ONLY be paired with AllowAny views whose anonymous response is a
harmless default (0 / []), so an expired or malformed token never surfaces
as a 401 mid-session.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class LenientJWTAuthentication(JWTAuthentication):
    """Like SimpleJWT auth, but treats an invalid/expired token as anonymous
    instead of raising 401.

    Note: a user with a stale-but-valid-session token is treated as anonymous
    here, so such endpoints report the anonymous default (e.g. unread 0) until
    the SPA's interceptor refreshes the token — an acceptable transient state.
    """

    def authenticate(self, request):
        try:
            return super().authenticate(request)
        except (InvalidToken, TokenError):
            return None


try:
    from drf_spectacular.extensions import OpenApiAuthenticationExtension

    class LenientJWTAuthenticationScheme(OpenApiAuthenticationExtension):
        """Register LenientJWTAuthentication with drf-spectacular so views
        using it keep their bearer-auth security definition in the schema."""

        target_class = "portal.authentication.LenientJWTAuthentication"
        name = "lenientJwtAuth"

        def get_security_definition(self, auto_schema):
            return {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
except ImportError:  # drf-spectacular not installed (e.g. minimal deploys)
    pass
