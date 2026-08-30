"""
WebSocket authentication middleware.

The React SPA authenticates exclusively with JWT bearer tokens (stored in
localStorage), so it never carries a Django session cookie. Django Channels'
AuthMiddlewareStack therefore resolves these users as anonymous, and every
WebSocket consumer (notifications, chat, analytics) closes the connection.

This middleware authenticates the user from a JWT passed as a query-string
parameter (?token=<access_token>) and is stacked *inside* AuthMiddlewareStack,
so it runs after the session lookup: if a valid JWT resolves to an active
user it overrides the (anonymous) session user, otherwise the session user
is left untouched so session-cookie clients keep working.

Note on the query-string token: it can leak into access logs / browser
history. Acceptable for this project's dev setup, but if this is ever
exposed publicly consider passing the token via the Sec-WebSocket-Protocol
header instead.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def _user_from_token(token):
    """Resolve an active user from a JWT access token, else AnonymousUser."""
    try:
        access = AccessToken(token)
        user = User.objects.filter(id=access["user_id"], is_active=True).first()
        return user or AnonymousUser()
    except (InvalidToken, TokenError, KeyError):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """Authenticate WebSocket scope user from ?token=<jwt> query parameter."""

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        query = parse_qs(scope.get("query_string", b"").decode())
        token = query.get("token", [None])[0]
        if token:
            user = await _user_from_token(token)
            # Only override when the JWT resolves to an active user, so a
            # stale/invalid ?token= never knocks a valid session user down
            # to anonymous (that would break session-based chat clients).
            if user.is_authenticated:
                scope["user"] = user
        return await super().__call__(scope, receive, send)
