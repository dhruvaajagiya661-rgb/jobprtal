"""Tests for accounts app - Custom user authentication and registration."""

from django.test import TestCase
from django.apps import apps as django_apps
from rest_framework.test import APIClient

from .models import CustomUser


class AccountsAppTestCase(TestCase):
    """Test case for accounts functionality."""

    def test_app_config(self):
        """Verify the app is properly configured."""
        try:
            app_config = django_apps.get_app_config("accounts")
            self.assertIsNotNone(app_config)
            self.assertEqual(app_config.name, "accounts")
        except LookupError:
            self.fail("accounts app is not registered in INSTALLED_APPS")

    def test_models_importable(self):
        """Verify all models import correctly."""
        try:
            __import__("accounts.models")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "accounts.models should import correctly")

    def test_views_importable(self):
        """Verify views import correctly."""
        try:
            __import__("accounts.views")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "accounts.views should import correctly")


class RegisterEdgeCasesTestCase(TestCase):
    """Registration must reject bad input with 400s, never 500s."""

    def setUp(self):
        self.client = APIClient()

    def _register(self, **data):
        payload = {"email": "newuser@test.com", "password": "pass12345"}
        payload.update(data)
        return self.client.post("/api/auth/register/", payload, format="json")

    def test_duplicate_email_is_case_insensitive(self):
        CustomUser.objects.create_user(
            email="Taken@Test.com", password="pass12345", username="taken"
        )
        response = self._register(email="taken@test.com")
        self.assertEqual(response.status_code, 400)
        self.assertIn("already exists", response.data["error"])

    def test_duplicate_username_returns_400_not_500(self):
        CustomUser.objects.create_user(
            email="first@test.com", password="pass12345", username="samename"
        )
        response = self._register(username="samename", email="other@test.com")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Username is already taken", response.data["error"])

    def test_derived_username_collision_returns_400_not_500(self):
        """Same email prefix across different domains must not 500."""
        CustomUser.objects.create_user(
            email="a@x.com", password="pass12345", username="a"
        )
        response = self._register(email="a@y.com")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Username", response.data["error"])

    def test_invalid_role_rejected(self):
        response = self._register(role="manager")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Role", response.data["error"])

    def test_recruiters_with_same_company_get_separate_companies(self):
        """Registering two recruiters with the same company name must not share a row."""
        from recruiters.models import Company, RecruiterProfile

        first = self._register(
            email="r1@test.com", role="recruiter", company_name="Acme Corp"
        )
        second = self._register(
            email="r2@test.com", role="recruiter", company_name="Acme Corp"
        )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        companies = Company.objects.filter(name="Acme Corp")
        self.assertEqual(companies.count(), 2)
        self.assertEqual(RecruiterProfile.objects.count(), 2)
        self.assertNotEqual(
            RecruiterProfile.objects.get(user__email="r1@test.com").company_id,
            RecruiterProfile.objects.get(user__email="r2@test.com").company_id,
        )

    def test_recruiter_can_login_after_registration(self):
        response = self._register(
            email="recruiter-login@test.com",
            password="pass12345",
            role="recruiter",
            company_name="Hiring Co",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["user"]["is_recruiter"])
        self.assertFalse(response.data["user"]["is_student"])

        login_response = self.client.post(
            "/api/auth/login/",
            {"email": "recruiter-login@test.com", "password": "pass12345"},
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertTrue(login_response.data["user"]["is_recruiter"])
        self.assertFalse(login_response.data["user"]["is_student"])

    def test_legacy_user_type_recruiter_registers_recruiter(self):
        response = self._register(
            email="legacy-recruiter@test.com",
            password="pass12345",
            user_type="recruiter",
            company_name="Legacy Hiring Co",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["user"]["is_recruiter"])
        self.assertFalse(response.data["user"]["is_student"])

    def test_logout_without_valid_access_token_returns_200(self):
        """Logout should not 401 when the access token has expired."""
        response = self.client.post(
            "/api/auth/logout/", {"refresh": "not-a-real-token"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
