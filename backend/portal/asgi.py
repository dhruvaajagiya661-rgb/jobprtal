"""
ASGI config for portal project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "portal.settings")

# Django has to be fully initialised *before* anything that touches the ORM is
# imported. `daphne portal.asgi:application` — the Docker entrypoint
# (docker-start.sh), README step 4, and Render's start command — does not call
# django.setup() itself; it only imports this module. get_asgi_application()
# is what runs django.setup(), so it must come first. With the old order the
# `from .ws_auth import ...` import ran before it and its module-level
# get_user_model() raised "AUTH_USER_MODEL refers to model
# 'accounts.CustomUser' that has not been installed" (or AppRegistryNotReady
# from chat.models) — Daphne exited during boot, the container never opened a
# port, and Render answered every request with 502 Bad Gateway. `manage.py
# runserver` masks this because it calls django.setup() before loading the
# ASGI application, so it only ever failed in the deployed environment.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.auth import AuthMiddlewareStack  # noqa: E402
from .ws_auth import JWTAuthMiddleware  # noqa: E402
import chat.routing  # noqa: E402
import notifications.routing  # noqa: E402
import analytics.routing  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
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
