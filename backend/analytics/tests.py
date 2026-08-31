"""Tests for analytics app - Audit logging and real-time analytics."""

from django.test import TestCase
from django.apps import apps as django_apps


class AnalyticsAppTestCase(TestCase):
    """Test case for analytics functionality."""

    def test_app_config(self):
        try:
            app_config = django_apps.get_app_config("analytics")
            self.assertIsNotNone(app_config)
            self.assertEqual(app_config.name, "analytics")
        except LookupError:
            self.fail("analytics app is not registered in INSTALLED_APPS")

    def test_models_importable(self):
        try:
            __import__("analytics.models")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "analytics.models should import correctly")

    def test_views_importable(self):
        try:
            __import__("analytics.views")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "analytics.views should import correctly")

    def test_utils_importable(self):
        try:
            __import__("analytics.utils")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "analytics.utils should import correctly")
