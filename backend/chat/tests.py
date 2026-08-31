"""Tests for chat app - Real-time messaging and AI assistant."""

from django.test import TestCase
from django.apps import apps as django_apps


class ChatAppTestCase(TestCase):
    """Test case for chat functionality."""

    def test_app_config(self):
        try:
            app_config = django_apps.get_app_config("chat")
            self.assertIsNotNone(app_config)
            self.assertEqual(app_config.name, "chat")
        except LookupError:
            self.fail("chat app is not registered in INSTALLED_APPS")

    def test_models_importable(self):
        try:
            __import__("chat.models")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "chat.models should import correctly")

    def test_ai_consumer_importable(self):
        try:
            __import__("chat.ai_consumer")
            __import__("chat.consumers")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "chat consumers should import correctly")

    def test_tasks_importable(self):
        try:
            __import__("chat.tasks")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "chat tasks should import correctly")
