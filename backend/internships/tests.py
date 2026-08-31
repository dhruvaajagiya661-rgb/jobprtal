"""Tests for internships app - Internship listings and management."""

from datetime import timedelta

from django.test import TestCase
from django.apps import apps as django_apps
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import CustomUser
from internships.models import Internship
from recruiters.models import Company


class InternshipsAppTestCase(TestCase):
    """Test case for internships functionality."""

    def test_app_config(self):
        try:
            app_config = django_apps.get_app_config("internships")
            self.assertIsNotNone(app_config)
            self.assertEqual(app_config.name, "internships")
        except LookupError:
            self.fail("internships app is not registered in INSTALLED_APPS")

    def test_models_importable(self):
        try:
            __import__("internships.models")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "internships.models should import correctly")

    def test_views_importable(self):
        try:
            __import__("internships.views")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "internships.views should import correctly")


class InternshipTypeFilterAPITestCase(TestCase):
    """Tests for the type filter on the internships API."""

    def setUp(self):
        self.recruiter = CustomUser.objects.create_user(
            email="recruiter@example.com", password="testpass123", is_recruiter=True
        )
        self.company = Company.objects.create(
            name="Acme", description="We build things", location="Remote"
        )
        self.deadline = timezone.now().date() + timedelta(days=30)
        self._create_internship("Full-time Intern", "Full-time")
        self._create_internship("Part-time Intern", "Part-time")
        self._create_internship("Remote Intern", "Remote")
        self.client = APIClient()

    def _create_internship(self, title, internship_type):
        return Internship.objects.create(
            title=title,
            company=self.company,
            recruiter=self.recruiter,
            description="Test description",
            requirements="Test requirements",
            location="Remote",
            stipend="$1000/month",
            duration="3 months",
            internship_type=internship_type,
            deadline=self.deadline,
        )

    def test_no_filter_returns_all_internships(self):
        resp = self.client.get("/api/v1/internships/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 3)

    def test_single_type_filter(self):
        resp = self.client.get("/api/v1/internships/", {"type": "Part-time"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["internship_type"], "Part-time")

    def test_comma_separated_type_filter(self):
        resp = self.client.get(
            "/api/v1/internships/", {"type": "Part-time,Remote"}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 2)
        self.assertEqual(
            {i["internship_type"] for i in data["results"]},
            {"Part-time", "Remote"},
        )

    def test_repeated_type_params_filter(self):
        resp = self.client.get(
            "/api/v1/internships/", {"type": ["Part-time", "Remote"]}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 2)


class RecruiterSeesOnlyOwnInternshipsTestCase(TestCase):
    """
    Recruiters must only see their own postings on the public internships API.
    """

    def setUp(self):
        self.recruiter_a = CustomUser.objects.create_user(
            email="recruiter_a@example.com",
            password="testpass123",
            is_recruiter=True,
        )
        self.recruiter_b = CustomUser.objects.create_user(
            email="recruiter_b@example.com",
            password="testpass123",
            is_recruiter=True,
        )
        self.company = Company.objects.create(
            name="Acme", description="We build things", location="Remote"
        )
        self.deadline = timezone.now().date() + timedelta(days=30)
        self.intern_a = self._create_internship(
            "Recruiter A Intern", self.recruiter_a
        )
        self.intern_b = self._create_internship(
            "Recruiter B Intern", self.recruiter_b
        )
        self.client = APIClient()

    def _create_internship(self, title, recruiter):
        return Internship.objects.create(
            title=title,
            company=self.company,
            recruiter=recruiter,
            description="Test description",
            requirements="Test requirements",
            location="Remote",
            stipend="$1000/month",
            duration="3 months",
            internship_type="Full-time",
            deadline=self.deadline,
        )

    def test_anonymous_sees_all_internships(self):
        resp = self.client.get("/api/v1/internships/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 2)

    def test_recruiter_only_sees_own_internships_in_list(self):
        self.client.force_authenticate(user=self.recruiter_a)
        resp = self.client.get("/api/v1/internships/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["id"], self.intern_a.id)

    def test_recruiter_cannot_open_another_recruiters_internship(self):
        self.client.force_authenticate(user=self.recruiter_a)
        resp = self.client.get(f"/api/v1/internships/{self.intern_b.id}/")
        self.assertEqual(resp.status_code, 404)

    def test_recruiter_can_open_own_internship(self):
        self.client.force_authenticate(user=self.recruiter_a)
        resp = self.client.get(f"/api/v1/internships/{self.intern_a.id}/")
        self.assertEqual(resp.status_code, 200)
