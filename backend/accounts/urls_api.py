from django.urls import path
from .api import register

urlpatterns = [
    path("", register, name="api_register"),
]
