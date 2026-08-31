"""Tests for jobs app - Job listings, skills, categories, and saved jobs."""

from datetime import timedelta

from django.test import TestCase
from django.apps import apps as django_apps
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import CustomUser
from jobs.models import Job
from recruiters.models import Company


class JobsAppTestCase(TestCase):
    """Test case for jobs functionality."""

    def test_app_config(self):
        """Verify the app is properly configured."""
        try:
            app_config = django_apps.get_app_config("jobs")
            self.assertIsNotNone(app_config)
            self.assertEqual(app_config.name, "jobs")
        except LookupError:
            self.fail("jobs app is not registered in INSTALLED_APPS")

    def test_models_importable(self):
        """Verify all models import correctly."""
        try:
            __import__("jobs.models")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "jobs.models should import correctly")

    def test_views_importable(self):
        """Verify views import correctly."""
        try:
            __import__("jobs.views")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "jobs.views should import correctly")


class JobTypeFilterAPITestCase(TestCase):
    """Tests for the job_type filter on the jobs API."""

    def setUp(self):
        self.recruiter = CustomUser.objects.create_user(
            email="recruiter@example.com", password="testpass123", is_recruiter=True
        )
        self.company = Company.objects.create(
            name="Acme", description="We build things", location="Remote"
        )
        self.deadline = timezone.now().date() + timedelta(days=30)
        self._create_job("Full-time Job", "Full-time")
        self._create_job("Part-time Job", "Part-time")
        self._create_job("Remote Job", "Remote")
        self.client = APIClient()

    def _create_job(self, title, job_type):
        return Job.objects.create(
            title=title,
            company=self.company,
            recruiter=self.recruiter,
            description="Test description",
            requirements="Test requirements",
            location="Remote",
            salary="$100k",
            job_type=job_type,
            experience_required="2 years",
            deadline=self.deadline,
        )

    def test_no_filter_returns_all_jobs(self):
        resp = self.client.get("/api/v1/jobs/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 3)

    def test_single_type_filter(self):
        resp = self.client.get("/api/v1/jobs/", {"job_type": "Part-time"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["job_type"], "Part-time")

    def test_comma_separated_type_filter(self):
        resp = self.client.get(
            "/api/v1/jobs/", {"job_type": "Part-time,Remote"}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 2)
        self.assertEqual(
            {j["job_type"] for j in data["results"]}, {"Part-time", "Remote"}
        )

    def test_repeated_type_params_filter(self):
        resp = self.client.get(
            "/api/v1/jobs/", {"job_type": ["Part-time", "Remote"]}
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 2)


class RecruiterSeesOnlyOwnJobsTestCase(TestCase):
    """
    Recruiters must only see their own postings on the public jobs API.
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
        self.job_a = self._create_job("Recruiter A Job", self.recruiter_a)
        self.job_b = self._create_job("Recruiter B Job", self.recruiter_b)
        self.client = APIClient()

    def _create_job(self, title, recruiter):
        return Job.objects.create(
            title=title,
            company=self.company,
            recruiter=recruiter,
            description="Test description",
            requirements="Test requirements",
            location="Remote",
            salary="$100k",
            job_type="Full-time",
            experience_required="2 years",
            deadline=self.deadline,
        )

    def test_anonymous_sees_all_jobs(self):
        resp = self.client.get("/api/v1/jobs/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["count"], 2)

    def test_recruiter_only_sees_own_jobs_in_list(self):
        self.client.force_authenticate(user=self.recruiter_a)
        resp = self.client.get("/api/v1/jobs/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["id"], self.job_a.id)

    def test_recruiter_cannot_open_another_recruiters_job(self):
        self.client.force_authenticate(user=self.recruiter_a)
        resp = self.client.get(f"/api/v1/jobs/{self.job_b.id}/")
        self.assertEqual(resp.status_code, 404)

    def test_recruiter_can_open_own_job(self):
        self.client.force_authenticate(user=self.recruiter_a)
        resp = self.client.get(f"/api/v1/jobs/{self.job_a.id}/")
        self.assertEqual(resp.status_code, 200)


class JobSearchAPITestCase(TestCase):
    """
    The `q` search must cover title, company name and location.

    Regression: the service only filtered `title__icontains`, so searching a
    company or a location silently returned nothing even though the UI
    advertises "Search jobs by title, company, or location".
    """

    def setUp(self):
        self.recruiter = CustomUser.objects.create_user(
            email="searchrec@example.com", password="testpass123", is_recruiter=True
        )
        self.acme = Company.objects.create(
            name="Acme Corp", description="Builders", location="Berlin"
        )
        self.globex = Company.objects.create(
            name="Globex", description="Science", location="Berlin"
        )
        self.deadline = timezone.now().date() + timedelta(days=30)
        self._create_job("Backend Engineer", self.acme, "Remote")
        self._create_job("Data Analyst", self.globex, "Berlin")
        self.client = APIClient()

    def _create_job(self, title, company, location):
        return Job.objects.create(
            title=title,
            company=company,
            recruiter=self.recruiter,
            description="Test description",
            requirements="Test requirements",
            location=location,
            salary="$100k",
            job_type="Full-time",
            experience_required="2 years",
            deadline=self.deadline,
        )

    def _titles(self, q):
        resp = self.client.get("/api/v1/jobs/", {"q": q})
        self.assertEqual(resp.status_code, 200)
        return {j["title"] for j in resp.json()["results"]}

    def test_search_matches_title(self):
        self.assertEqual(self._titles("Backend"), {"Backend Engineer"})

    def test_search_matches_company_name(self):
        self.assertEqual(self._titles("Globex"), {"Data Analyst"})

    def test_search_matches_location(self):
        """`Remote` is a location here, not part of any title."""
        self.assertEqual(self._titles("Remote"), {"Backend Engineer"})

    def test_search_is_case_insensitive(self):
        self.assertEqual(self._titles("acme corp"), {"Backend Engineer"})

    def test_search_with_no_match_returns_empty(self):
        self.assertEqual(self._titles("zzz-no-such-job"), set())
