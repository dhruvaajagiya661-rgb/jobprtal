from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenBlacklistView,
)
from .api import login, me, logout
from portal.throttling import AuthRateThrottle


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """TokenObtainPairView with per-IP+email auth throttling."""

    throttle_classes = [AuthRateThrottle]


class ThrottledTokenRefreshView(TokenRefreshView):
    """TokenRefreshView with per-IP auth throttling."""

    throttle_classes = [AuthRateThrottle]


class ThrottledTokenBlacklistView(TokenBlacklistView):
    """TokenBlacklistView with per-IP auth throttling."""

    throttle_classes = [AuthRateThrottle]


urlpatterns = [
    path("login/", login, name="api_login"),
    path(
        "login/jwt/",
        ThrottledTokenObtainPairView.as_view(),
        name="token_obtain_pair",
    ),
    path(
        "token/refresh/",
        ThrottledTokenRefreshView.as_view(),
        name="token_refresh",
    ),
    path(
        "token/blacklist/",
        ThrottledTokenBlacklistView.as_view(),
        name="token_blacklist",
    ),
    path("me/", me, name="api_me"),
    path("logout/", logout, name="api_logout"),
]
