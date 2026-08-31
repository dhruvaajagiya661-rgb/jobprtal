from django.urls import path
from . import views

urlpatterns = [
    path("", views.notification_list, name="notification_list"),
    path("mark-as-read/<int:pk>/", views.mark_as_read, name="mark_as_read"),
]
