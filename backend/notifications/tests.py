"""Tests for notifications app - In-app notification system."""

from django.test import TestCase
from django.apps import apps as django_apps


class NotificationsAppTestCase(TestCase):
    """Test case for notifications functionality."""

    def test_app_config(self):
        try:
            app_config = django_apps.get_app_config("notifications")
            self.assertIsNotNone(app_config)
            self.assertEqual(app_config.name, "notifications")
        except LookupError:
            self.fail("notifications app is not registered in INSTALLED_APPS")

    def test_models_importable(self):
        try:
            __import__("notifications.models")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "notifications.models should import correctly")

    def test_views_importable(self):
        try:
            __import__("notifications.views")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "notifications.views should import correctly")
