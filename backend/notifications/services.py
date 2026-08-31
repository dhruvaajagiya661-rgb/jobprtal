"""Notification helpers used across the portal.

Centralizes creation of Notification records so every event (application
submitted, job posted, status updated) also keeps superusers/admins in the
loop — admins currently receive no notifications otherwise.
"""

from django.contrib.auth import get_user_model

from .models import Notification

User = get_user_model()


def notify_admins(title, message):
    """Create a Notification for every active superuser (admin)."""
    admins = User.objects.filter(is_superuser=True, is_active=True)
    for admin in admins:
        Notification.objects.create(user=admin, title=title, message=message)
