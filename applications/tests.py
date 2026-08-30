"""Tests for applications app - Job and internship applications."""

from datetime import date

from django.test import TestCase
from django.apps import apps as django_apps
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.models import CustomUser
from jobs.models import Job, Skill
from internships.models import Internship
from recruiters.models import Company, RecruiterProfile
from students.models import StudentProfile
from .models import Application


class ApplicationsAppTestCase(TestCase):
    """Test case for applications functionality."""

    def test_app_config(self):
        try:
            app_config = django_apps.get_app_config("applications")
            self.assertIsNotNone(app_config)
            self.assertEqual(app_config.name, "applications")
        except LookupError:
            self.fail("applications app is not registered in INSTALLED_APPS")

    def test_models_importable(self):
        try:
            __import__("applications.models")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "applications.models should import correctly")

    def test_views_importable(self):
        try:
            __import__("applications.views")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "applications.views should import correctly")


class RecruiterApplicantsVisibilityTestCase(TestCase):
    """
    Recruiters must see applicants for both their job postings and their
    internship postings - and never another recruiter's applicants.
    """

    def setUp(self):
        self.recruiter_a = CustomUser.objects.create_user(
            username="recruiter_a",
            email="recruiter_a@test.com",
            password="pass12345",
            is_recruiter=True,
        )
        self.recruiter_b = CustomUser.objects.create_user(
            username="recruiter_b",
            email="recruiter_b@test.com",
            password="pass12345",
            is_recruiter=True,
        )
        self.student = CustomUser.objects.create_user(
            username="student_one",
            email="student_one@test.com",
            password="pass12345",
            is_student=True,
        )

        company_a = Company.objects.create(
            name="Company A", description="desc", location="NYC"
        )
        company_b = Company.objects.create(
            name="Company B", description="desc", location="LA"
        )
        RecruiterProfile.objects.create(
            user=self.recruiter_a, company=company_a, designation="HR"
        )
        RecruiterProfile.objects.create(
            user=self.recruiter_b, company=company_b, designation="HR"
        )

        self.job_a = Job.objects.create(
            title="Backend Engineer",
            company=company_a,
            recruiter=self.recruiter_a,
            description="desc",
            requirements="req",
            location="NYC",
            salary="$100K",
            job_type="Full-time",
            experience_required="2 years",
            deadline=date(2027, 1, 1),
        )
        self.internship_a = Internship.objects.create(
            title="Data Analyst Intern",
            company=company_a,
            recruiter=self.recruiter_a,
            description="desc",
            requirements="req",
            location="Remote",
            stipend="$500/month",
            duration="3 months",
            internship_type="Remote",
            deadline=date(2027, 1, 1),
        )
        self.internship_b = Internship.objects.create(
            title="Design Intern",
            company=company_b,
            recruiter=self.recruiter_b,
            description="desc",
            requirements="req",
            location="LA",
            stipend="$400/month",
            duration="2 months",
            internship_type="On-site",
            deadline=date(2027, 1, 1),
        )

        resume = SimpleUploadedFile(
            "resume.pdf", b"%PDF-1.4 test content", content_type="application/pdf"
        )
        self.job_application = Application.objects.create(
            job=self.job_a, student=self.student, resume=resume
        )
        self.internship_application = Application.objects.create(
            internship=self.internship_a, student=self.student, resume=resume
        )
        # Application to the OTHER recruiter's internship (must stay hidden)
        Application.objects.create(
            internship=self.internship_b, student=self.student, resume=resume
        )

        self.client = APIClient()

    def test_recruiter_sees_job_and_internship_applicants(self):
        """Recruiter A sees applicants for their job AND their internship."""
        self.client.force_authenticate(user=self.recruiter_a)
        response = self.client.get("/api/v1/recruiters/applicants/")
        self.assertEqual(response.status_code, 200)
        ids = {app["id"] for app in response.data}
        self.assertEqual(ids, {self.job_application.id, self.internship_application.id})

    def test_recruiter_does_not_see_other_recruiters_applicants(self):
        """Recruiter B only sees their own internship applicant."""
        self.client.force_authenticate(user=self.recruiter_b)
        response = self.client.get("/api/v1/recruiters/applicants/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertIsNotNone(response.data[0]["internship"])
        self.assertEqual(response.data[0]["internship"]["id"], self.internship_b.id)

    def test_status_update_works_for_internship_application(self):
        """Recruiters can update the status of internship applications."""
        self.client.force_authenticate(user=self.recruiter_a)
        response = self.client.post(
            "/api/v1/recruiters/update_application_status/",
            {
                "application_id": self.internship_application.id,
                "status": "Shortlisted",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.internship_application.refresh_from_db()
        self.assertEqual(self.internship_application.status, "Shortlisted")

    def test_status_update_rejects_invalid_status(self):
        """Arbitrary status strings must be rejected, not persisted."""
        self.client.force_authenticate(user=self.recruiter_a)
        response = self.client.post(
            "/api/v1/recruiters/update_application_status/",
            {
                "application_id": self.job_application.id,
                "status": "Hacked",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.job_application.refresh_from_db()
        self.assertEqual(self.job_application.status, "Applied")

    def test_dashboard_counts_include_internship_applications(self):
        """Recruiter dashboard totals include internship applications."""
        self.client.force_authenticate(user=self.recruiter_a)
        response = self.client.get("/api/v1/recruiters/dashboard/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_applicants"], 2)


class RecruiterApplicantFiltersTestCase(TestCase):
    """Recruiters can search and filter applicants by name, skill, and status."""

    def setUp(self):
        self.recruiter = CustomUser.objects.create_user(
            username="recruiter_filter",
            email="recruiter_filter@test.com",
            password="pass12345",
            is_recruiter=True,
        )
        self.alice = CustomUser.objects.create_user(
            username="alice_chen",
            email="alice@test.com",
            password="pass12345",
            is_student=True,
            first_name="Alice",
            last_name="Chen",
        )
        self.bob = CustomUser.objects.create_user(
            username="bob_smith",
            email="bob@test.com",
            password="pass12345",
            is_student=True,
            first_name="Bob",
            last_name="Smith",
        )

        company = Company.objects.create(
            name="Filter Co", description="desc", location="NYC"
        )
        RecruiterProfile.objects.create(
            user=self.recruiter, company=company, designation="HR"
        )
        self.job = Job.objects.create(
            title="Backend Engineer",
            company=company,
            recruiter=self.recruiter,
            description="desc",
            requirements="req",
            location="NYC",
            salary="$100K",
            job_type="Full-time",
            experience_required="2 years",
            deadline=date(2027, 1, 1),
        )

        # Alice: Python + Django on her profile; Bob: Figma
        alice_profile = StudentProfile.objects.create(user=self.alice)
        python_skill, _ = Skill.objects.get_or_create(name="Python")
        django_skill, _ = Skill.objects.get_or_create(name="Django")
        figma_skill, _ = Skill.objects.get_or_create(name="Figma")
        alice_profile.skills.add(python_skill, django_skill)
        bob_profile = StudentProfile.objects.create(user=self.bob)
        bob_profile.skills.add(figma_skill)

        resume = SimpleUploadedFile(
            "resume.pdf", b"%PDF-1.4 test content", content_type="application/pdf"
        )
        self.alice_applied = Application.objects.create(
            job=self.job, student=self.alice, resume=resume, status="Applied"
        )
        self.alice_shortlisted = Application.objects.create(
            job=self.job, student=self.alice, resume=resume, status="Shortlisted"
        )
        self.bob_accepted = Application.objects.create(
            job=self.job, student=self.bob, resume=resume, status="Accepted"
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.recruiter)

    def test_search_by_student_name(self):
        """Search matches the student's first name."""
        response = self.client.get(
            "/api/v1/recruiters/applicants/?search=Alice"
        )
        self.assertEqual(response.status_code, 200)
        ids = {app["id"] for app in response.data}
        self.assertEqual(ids, {self.alice_applied.id, self.alice_shortlisted.id})

    def test_search_by_email(self):
        """Search matches the student's email."""
        response = self.client.get(
            "/api/v1/recruiters/applicants/?search=bob@test.com"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.bob_accepted.id)

    def test_filter_by_status(self):
        """Status filter returns only matching applications."""
        response = self.client.get(
            "/api/v1/recruiters/applicants/?status=Accepted"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.bob_accepted.id)

    def test_filter_by_skill(self):
        """Skill filter returns applicants whose profile has the skill."""
        response = self.client.get(
            "/api/v1/recruiters/applicants/?skill=Python"
        )
        self.assertEqual(response.status_code, 200)
        ids = {app["id"] for app in response.data}
        self.assertEqual(ids, {self.alice_applied.id, self.alice_shortlisted.id})

    def test_filter_by_skill_is_case_insensitive(self):
        """Skill matching ignores case."""
        response = self.client.get(
            "/api/v1/recruiters/applicants/?skill=python"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_combined_filters(self):
        """Search + skill + status filters combine."""
        response = self.client.get(
            "/api/v1/recruiters/applicants/?skill=Python&status=Applied"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.alice_applied.id)

    def test_distinct_prevents_duplicate_rows(self):
        """
        A skill filter matching multiple of one student's skills must yield
        one row per application, not one per matching skill row.
        """
        # "n" matches both "Python" and "Django" (Alice's two skills), so
        # without .distinct() each of Alice's applications would appear twice.
        response = self.client.get("/api/v1/recruiters/applicants/?skill=n")
        self.assertEqual(response.status_code, 200)
        ids = {app["id"] for app in response.data}
        self.assertEqual(ids, {self.alice_applied.id, self.alice_shortlisted.id})
        self.assertEqual(len(response.data), 2)

    def test_student_skills_included_in_response(self):
        """The API returns each applicant's skill list for the UI."""
        response = self.client.get("/api/v1/recruiters/applicants/")
        self.assertEqual(response.status_code, 200)
        by_id = {app["id"]: app for app in response.data}
        self.assertEqual(
            set(by_id[self.alice_applied.id]["student_skills"]),
            {"Python", "Django"},
        )
        self.assertEqual(
            set(by_id[self.bob_accepted.id]["student_skills"]), {"Figma"}
        )


class ResumeUploadValidationTestCase(TestCase):
    """Resume uploads must be documents of a sane size.

    Regression guard: Application.resume was a bare FileField and
    ApplicationCreateSerializer is a plain Serializer (so it would not pick up
    a model-level validator anyway). An .exe or .html file, or a file of any
    size, was accepted and written under MEDIA_ROOT.
    """

    def setUp(self):
        self.client = APIClient()
        self.recruiter = CustomUser.objects.create_user(
            username="up_rec", email="up_rec@test.com",
            password="pass12345", is_recruiter=True,
        )
        self.student = CustomUser.objects.create_user(
            username="up_stu", email="up_stu@test.com",
            password="pass12345", is_student=True,
        )
        StudentProfile.objects.get_or_create(user=self.student)
        company = Company.objects.create(name="UpCo", description="d", location="Remote")
        RecruiterProfile.objects.get_or_create(user=self.recruiter, company=company)
        self.job = Job.objects.create(
            title="Dev", company=company, recruiter=self.recruiter,
            description="d", requirements="r", location="Remote",
            salary="1", job_type="Full-time", experience_required="0",
            deadline=date(2030, 1, 1),
        )

    def _apply(self, filename, content, content_type):
        self.client.force_authenticate(user=self.student)
        upload = SimpleUploadedFile(filename, content, content_type=content_type)
        return self.client.post(
            "/api/v1/applications/apply/",
            {"job_id": self.job.id, "resume": upload},
            format="multipart",
        )

    def test_executable_resume_is_rejected(self):
        response = self._apply("evil.exe", b"MZ\x90\x00payload", "application/x-msdownload")
        self.assertEqual(response.status_code, 400)
        self.assertIn("resume", response.data)

    def test_html_resume_is_rejected(self):
        response = self._apply("x.html", b"<script>alert(1)</script>", "text/html")
        self.assertEqual(response.status_code, 400)
        self.assertIn("resume", response.data)

    def test_oversized_resume_is_rejected(self):
        response = self._apply(
            "big.pdf", b"%PDF-1.4" + b"A" * (6 * 1024 * 1024), "application/pdf"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("resume", response.data)

    def test_pdf_resume_is_accepted(self):
        response = self._apply("ok.pdf", b"%PDF-1.4 real resume", "application/pdf")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Application.objects.filter(student=self.student).count(), 1)
