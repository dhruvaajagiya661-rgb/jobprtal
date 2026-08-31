"""Tests for recruiters app - Company profiles and recruiter management."""

from django.test import TestCase
from django.apps import apps as django_apps
from rest_framework.test import APIClient

from accounts.models import CustomUser


class RecruitersAppTestCase(TestCase):
    """Test case for recruiters functionality."""

    def test_app_config(self):
        try:
            app_config = django_apps.get_app_config("recruiters")
            self.assertIsNotNone(app_config)
            self.assertEqual(app_config.name, "recruiters")
        except LookupError:
            self.fail("recruiters app is not registered in INSTALLED_APPS")

    def test_models_importable(self):
        try:
            __import__("recruiters.models")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "recruiters.models should import correctly")

    def test_views_importable(self):
        try:
            __import__("recruiters.views")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "recruiters.views should import correctly")

    def test_services_importable(self):
        try:
            __import__("recruiters.services")
            __import__("recruiters.analytics_views")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "recruiters services should import correctly")


class RecruiterInternshipAPITestCase(TestCase):
    """The recruiter console's internship CRUD actions."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        from recruiters.models import Company, RecruiterProfile

        User = get_user_model()
        self.recruiter = User.objects.create_user(
            "rec@example.com", "pw12345!", username="rec", is_recruiter=True
        )
        self.other = User.objects.create_user(
            "rec2@example.com", "pw12345!", username="rec2", is_recruiter=True
        )
        self.student = User.objects.create_user(
            "stu@example.com", "pw12345!", username="stu", is_student=True
        )
        self.company = Company.objects.create(
            name="Acme", description="d", location="NYC"
        )
        RecruiterProfile.objects.create(
            user=self.recruiter, company=self.company, designation="Head of Talent"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.recruiter)

    def payload(self, **overrides):
        from datetime import date, timedelta

        data = {
            "title": "Backend Intern",
            "description": "Work on APIs",
            "requirements": "Python",
            "location": "Remote",
            "stipend": "$2000/mo",
            "duration": "3 months",
            "internship_type": "Remote",
            "category_name": "Engineering",
            "skills_required": ["Python", "Django"],
            "preferred_skills": ["Docker"],
            "deadline": str(date.today() + timedelta(days=30)),
            "openings": 2,
        }
        data.update(overrides)
        return data

    def create_internship(self, **overrides):
        response = self.client.post(
            "/api/v1/recruiters/create_internship/",
            self.payload(**overrides),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.data)
        return response.data["id"]

    def test_create_internship_resolves_skills_and_company(self):
        from internships.models import Internship

        internship_id = self.create_internship()
        internship = Internship.objects.get(pk=internship_id)
        self.assertEqual(internship.recruiter, self.recruiter)
        # The company comes from the recruiter's profile, never the request body.
        self.assertEqual(internship.company, self.company)
        self.assertEqual(internship.category.name, "Engineering")
        self.assertEqual(
            sorted(internship.skills_required.values_list("name", flat=True)),
            ["Django", "Python"],
        )
        self.assertEqual(
            list(internship.preferred_skills.values_list("name", flat=True)),
            ["Docker"],
        )

    def test_create_internship_ignores_company_id_in_body(self):
        """A recruiter cannot post under someone else's company."""
        from recruiters.models import Company
        from internships.models import Internship

        rival = Company.objects.create(name="Rival", description="d", location="LA")
        internship_id = self.create_internship(company=rival.id)
        self.assertEqual(Internship.objects.get(pk=internship_id).company, self.company)

    def test_update_internship_replaces_skills(self):
        from internships.models import Internship

        internship_id = self.create_internship()
        response = self.client.patch(
            "/api/v1/recruiters/update_internship/",
            {
                "internship_id": internship_id,
                "stipend": "$2500/mo",
                "skills_required": ["Python", "FastAPI"],
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        internship = Internship.objects.get(pk=internship_id)
        self.assertEqual(internship.stipend, "$2500/mo")
        self.assertEqual(
            sorted(internship.skills_required.values_list("name", flat=True)),
            ["FastAPI", "Python"],
        )
        # Untouched relations survive a partial update.
        self.assertEqual(
            list(internship.preferred_skills.values_list("name", flat=True)),
            ["Docker"],
        )

    def test_internship_detail_reads_back_a_closed_posting(self):
        """Editing a closed internship must still be possible.

        The public detail endpoint filters on is_active, so this owner-scoped
        one is what the edit form actually loads from.
        """
        from internships.models import Internship

        internship_id = self.create_internship()
        Internship.objects.filter(pk=internship_id).update(is_active=False)

        self.assertEqual(
            self.client.get(f"/api/v1/internships/{internship_id}/").status_code, 404
        )
        response = self.client.get(
            f"/api/v1/recruiters/internship_detail/?internship_id={internship_id}"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["title"], "Backend Intern")

    def test_actions_are_scoped_to_the_owning_recruiter(self):
        internship_id = self.create_internship()
        self.client.force_authenticate(user=self.other)

        self.assertEqual(
            self.client.get(
                f"/api/v1/recruiters/internship_detail/?internship_id={internship_id}"
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.patch(
                "/api/v1/recruiters/update_internship/",
                {"internship_id": internship_id, "stipend": "$0"},
                format="json",
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(
                "/api/v1/recruiters/delete_internship/",
                {"internship_id": internship_id},
                format="json",
            ).status_code,
            404,
        )

    def test_students_cannot_post_internships(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            "/api/v1/recruiters/create_internship/", self.payload(), format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_delete_internship(self):
        from internships.models import Internship

        internship_id = self.create_internship()
        response = self.client.delete(
            "/api/v1/recruiters/delete_internship/",
            {"internship_id": internship_id},
            format="json",
        )
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Internship.objects.filter(pk=internship_id).exists())


class SavedCandidateAPITestCase(TestCase):
    """The recruiter's private talent pool."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        from recruiters.models import Company, RecruiterProfile

        User = get_user_model()
        self.recruiter = User.objects.create_user(
            "rec@example.com", "pw12345!", username="rec", is_recruiter=True
        )
        self.other = User.objects.create_user(
            "rec2@example.com", "pw12345!", username="rec2", is_recruiter=True
        )
        self.student = User.objects.create_user(
            "stu@example.com", "pw12345!", username="stu", is_student=True
        )
        company = Company.objects.create(name="Acme", description="d", location="NYC")
        RecruiterProfile.objects.create(
            user=self.recruiter, company=company, designation="Recruiter"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.recruiter)

    def test_save_list_and_unsave(self):
        response = self.client.post(
            "/api/v1/recruiters/save_candidate/",
            {"student_id": self.student.id, "notes": "strong on backend"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["created"])

        listing = self.client.get("/api/v1/recruiters/saved_candidates/")
        self.assertEqual(len(listing.data), 1)
        self.assertEqual(listing.data[0]["student_id"], self.student.id)
        self.assertEqual(listing.data[0]["notes"], "strong on backend")

        removed = self.client.delete(
            "/api/v1/recruiters/unsave_candidate/",
            {"student_id": self.student.id},
            format="json",
        )
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(len(self.client.get("/api/v1/recruiters/saved_candidates/").data), 0)

    def test_saving_twice_updates_the_note_instead_of_erroring(self):
        """unique_together would 500 on a re-save; the action is idempotent."""
        self.client.post(
            "/api/v1/recruiters/save_candidate/",
            {"student_id": self.student.id, "notes": "first"},
            format="json",
        )
        again = self.client.post(
            "/api/v1/recruiters/save_candidate/",
            {"student_id": self.student.id, "notes": "second"},
            format="json",
        )
        self.assertEqual(again.status_code, 200)
        self.assertFalse(again.data["created"])
        self.assertEqual(again.data["candidate"]["notes"], "second")

    def test_pool_is_private_to_the_recruiter(self):
        self.client.post(
            "/api/v1/recruiters/save_candidate/",
            {"student_id": self.student.id},
            format="json",
        )
        self.client.force_authenticate(user=self.other)
        self.assertEqual(len(self.client.get("/api/v1/recruiters/saved_candidates/").data), 0)
        self.assertEqual(
            self.client.delete(
                "/api/v1/recruiters/unsave_candidate/",
                {"student_id": self.student.id},
                format="json",
            ).status_code,
            404,
        )

    def test_only_students_can_be_saved(self):
        response = self.client.post(
            "/api/v1/recruiters/save_candidate/",
            {"student_id": self.other.id},
            format="json",
        )
        self.assertEqual(response.status_code, 404)


class RecruiterAnalyticsAPITestCase(TestCase):
    """The analytics action behind the dashboard's funnel and metrics."""

    def setUp(self):
        from datetime import date, timedelta
        from django.contrib.auth import get_user_model
        from django.core.files.uploadedfile import SimpleUploadedFile
        from rest_framework.test import APIClient
        from recruiters.models import Company, RecruiterProfile
        from jobs.models import Job, Skill
        from applications.models import Application

        User = get_user_model()
        self.recruiter = User.objects.create_user(
            "rec@example.com", "pw12345!", username="rec", is_recruiter=True
        )
        company = Company.objects.create(name="Acme", description="d", location="NYC")
        RecruiterProfile.objects.create(
            user=self.recruiter, company=company, designation="Recruiter"
        )
        self.job = Job.objects.create(
            title="Engineer",
            company=company,
            recruiter=self.recruiter,
            description="d",
            requirements="r",
            location="NYC",
            salary="$100k",
            job_type="Full-time",
            experience_required="2 years",
            deadline=date.today() + timedelta(days=30),
        )
        self.job.skills_required.add(Skill.objects.create(name="Python"))

        # One applicant per stage, so each funnel step has a distinct count.
        for i, status in enumerate(["Applied", "Applied", "Shortlisted", "Accepted"]):
            student = User.objects.create_user(
                f"s{i}@example.com", "pw12345!", username=f"s{i}", is_student=True
            )
            Application.objects.create(
                job=self.job,
                student=student,
                resume=SimpleUploadedFile(f"r{i}.pdf", b"x"),
                status=status,
            )

        self.client = APIClient()
        self.client.force_authenticate(user=self.recruiter)

    def test_funnel_stages_are_cumulative(self):
        response = self.client.get("/api/v1/recruiters/analytics/")
        self.assertEqual(response.status_code, 200)
        funnel = {stage["stage"]: stage["count"] for stage in response.data["funnel"]}
        self.assertEqual(funnel["Applied"], 4)
        # An accepted candidate necessarily passed the shortlist, so the
        # stage counts everyone who got at least that far: 1 + 1.
        self.assertEqual(funnel["Shortlisted"], 2)
        self.assertEqual(funnel["Accepted"], 1)

    def test_time_to_fill_and_top_listings(self):
        response = self.client.get("/api/v1/recruiters/analytics/")
        self.assertEqual(response.data["time_to_fill"]["roles_filled"], 1)
        self.assertIsNotNone(response.data["time_to_fill"]["average_days"])

        top = response.data["top_listings"]
        self.assertEqual(len(top), 1)
        self.assertEqual(top[0]["title"], "Engineer")
        self.assertEqual(top[0]["applicants"], 4)

        self.assertEqual(
            [s["skill"] for s in response.data["top_skills"]], ["Python"]
        )

    def test_month_over_month_handles_a_zero_baseline(self):
        response = self.client.get("/api/v1/recruiters/analytics/")
        mom = response.data["month_over_month"]
        self.assertEqual(mom["this_month"], 4)
        self.assertEqual(mom["last_month"], 0)
        # No baseline to divide by — reported as 100% new, not a crash.
        self.assertEqual(mom["change_percent"], 100.0)

    def test_analytics_excludes_other_recruiters_data(self):
        from django.contrib.auth import get_user_model

        other = get_user_model().objects.create_user(
            "rec2@example.com", "pw12345!", username="rec2", is_recruiter=True
        )
        self.client.force_authenticate(user=other)
        response = self.client.get("/api/v1/recruiters/analytics/")
        self.assertEqual(response.data["funnel"][0]["count"], 0)
        self.assertEqual(response.data["top_listings"], [])


class PublicRecruiterProfileAPITestCase(TestCase):
    """GET /api/v1/recruiters/public/{id}/ — readable while signed out."""

    def setUp(self):
        from datetime import date, timedelta
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        from recruiters.models import Company, RecruiterProfile
        from jobs.models import Job

        User = get_user_model()
        self.recruiter = User.objects.create_user(
            "rec@example.com", "pw12345!", username="rec", is_recruiter=True
        )
        self.student = User.objects.create_user(
            "stu@example.com", "pw12345!", username="stu", is_student=True
        )
        self.company = Company.objects.create(
            name="Acme", description="d", location="NYC", followers_count=7
        )
        RecruiterProfile.objects.create(
            user=self.recruiter, company=self.company, designation="Head of Talent"
        )
        self.open_job = Job.objects.create(
            title="Open Role",
            company=self.company,
            recruiter=self.recruiter,
            description="d",
            requirements="r",
            location="NYC",
            salary="$100k",
            job_type="Full-time",
            experience_required="2 years",
            deadline=date.today() + timedelta(days=30),
        )
        Job.objects.create(
            title="Closed Role",
            company=self.company,
            recruiter=self.recruiter,
            description="d",
            requirements="r",
            location="NYC",
            salary="$100k",
            job_type="Full-time",
            experience_required="2 years",
            deadline=date.today() + timedelta(days=30),
            is_active=False,
        )
        self.client = APIClient()

    def test_anonymous_visitor_sees_the_profile(self):
        response = self.client.get(f"/api/v1/recruiters/public/{self.recruiter.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["designation"], "Head of Talent")
        self.assertEqual(response.data["company"]["name"], "Acme")
        self.assertEqual(response.data["followers_count"], 7)

    def test_only_active_postings_are_listed(self):
        response = self.client.get(f"/api/v1/recruiters/public/{self.recruiter.id}/")
        self.assertEqual([j["title"] for j in response.data["jobs"]], ["Open Role"])

    def test_email_is_not_exposed(self):
        response = self.client.get(f"/api/v1/recruiters/public/{self.recruiter.id}/")
        self.assertNotIn("email", response.data)
        self.assertNotIn("rec@example.com", str(response.data))

    def test_non_recruiter_and_unknown_ids_are_404(self):
        self.assertEqual(
            self.client.get(f"/api/v1/recruiters/public/{self.student.id}/").status_code,
            404,
        )
        self.assertEqual(
            self.client.get("/api/v1/recruiters/public/999999/").status_code, 404
        )

    def test_job_detail_carries_the_recruiter_for_the_profile_link(self):
        response = self.client.get(f"/api/v1/jobs/{self.open_job.id}/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["recruiter"]["id"], self.recruiter.id)
        self.assertEqual(response.data["recruiter"]["designation"], "Head of Talent")
        self.assertNotIn("email", response.data["recruiter"])


class BadPkAndPostingValidationTestCase(TestCase):
    """Guards for two defects found by live QA probing.

    1. Company pages 500'd on a non-numeric pk (django vs DRF
       get_object_or_404).
    2. Job/internship postings accepted a past deadline or a non-positive
       openings count. A past-deadline posting is invisible everywhere,
       because every listing filters on deadline__gte=today, so the recruiter
       got a success response and no listing.
    """

    def setUp(self):
        self.client = APIClient()
        self.recruiter = CustomUser.objects.create_user(
            username="valrec",
            email="valrec@test.com",
            password="pass12345",
            is_recruiter=True,
        )

    def test_company_page_bad_pk_is_404_not_500(self):
        response = self.client.get("/api/v1/company-pages/abc/")
        self.assertEqual(response.status_code, 404)

    def _job_payload(self, **overrides):
        payload = {
            "title": "QA Engineer",
            "description": "desc",
            "requirements": "req",
            "location": "Remote",
            "salary": "50000",
            "job_type": "Full-time",
            "experience_required": "0-1 years",
            "deadline": "2030-12-31",
            "openings": 2,
        }
        payload.update(overrides)
        return payload

    def test_job_with_past_deadline_is_rejected(self):
        self.client.force_authenticate(user=self.recruiter)
        response = self.client.post(
            "/api/v1/recruiters/create_job/",
            self._job_payload(deadline="2020-01-01"),
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("deadline", response.data)

    def test_job_with_non_positive_openings_is_rejected(self):
        self.client.force_authenticate(user=self.recruiter)
        for bad in (0, -5):
            response = self.client.post(
                "/api/v1/recruiters/create_job/",
                self._job_payload(openings=bad),
                format="json",
            )
            self.assertEqual(response.status_code, 400, "openings=%s" % bad)
            self.assertIn("openings", response.data)

    def test_valid_job_still_creates(self):
        self.client.force_authenticate(user=self.recruiter)
        response = self.client.post(
            "/api/v1/recruiters/create_job/", self._job_payload(), format="json"
        )
        self.assertEqual(response.status_code, 201)

    def test_update_job_cannot_move_deadline_into_the_past(self):
        """update_job writes through JobSerializer, not the create serializer.

        Without its own guard a recruiter could PATCH a live posting into the
        past, where every listing's deadline__gte filter silently hides it.
        """
        self.client.force_authenticate(user=self.recruiter)
        created = self.client.post(
            "/api/v1/recruiters/create_job/", self._job_payload(), format="json"
        )
        self.assertEqual(created.status_code, 201)
        job_id = created.data["id"]

        response = self.client.patch(
            "/api/v1/recruiters/update_job/",
            {"job_id": job_id, "deadline": "2020-01-01"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("deadline", response.data)

    def test_update_job_still_allows_legitimate_edits(self):
        self.client.force_authenticate(user=self.recruiter)
        created = self.client.post(
            "/api/v1/recruiters/create_job/", self._job_payload(), format="json"
        )
        job_id = created.data["id"]

        # An unrelated field must still be editable, and so must a future date.
        for payload in ({"title": "Renamed"}, {"deadline": "2031-06-30"}):
            payload["job_id"] = job_id
            response = self.client.patch(
                "/api/v1/recruiters/update_job/", payload, format="json"
            )
            self.assertEqual(response.status_code, 200, payload)
