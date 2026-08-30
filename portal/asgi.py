"""
ASGI config for portal project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from .ws_auth import JWTAuthMiddleware
import chat.routing
import notifications.routing
import analytics.routing

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "portal.settings")

application = ProtocolTypeRouter(
    {
        "http": get_asgi_application(),
        # JWTAuthMiddleware sits inside AuthMiddlewareStack so it runs after
        # the session lookup: a valid ?token= JWT overrides the (anonymous)
        # session user for the SPA, while session-cookie users keep working.
        "websocket": AuthMiddlewareStack(
            JWTAuthMiddleware(
                URLRouter(
                    chat.routing.websocket_urlpatterns
                    + notifications.routing.websocket_urlpatterns
                    + analytics.routing.websocket_urlpatterns
                )
            )
        ),
    }
)
