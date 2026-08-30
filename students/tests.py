"""Tests for students app - Student profiles and dashboard."""

from django.test import TestCase
from django.apps import apps as django_apps
from rest_framework.test import APIClient

from accounts.models import CustomUser
from recruiters.models import Company, RecruiterProfile
from jobs.models import Job
from .models import StudentProfile


class StudentsAppTestCase(TestCase):
    """Test case for students functionality."""

    def test_app_config(self):
        try:
            app_config = django_apps.get_app_config("students")
            self.assertIsNotNone(app_config)
            self.assertEqual(app_config.name, "students")
        except LookupError:
            self.fail("students app is not registered in INSTALLED_APPS")

    def test_models_importable(self):
        try:
            __import__("students.models")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "students.models should import correctly")

    def test_views_importable(self):
        try:
            __import__("students.views")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "students.views should import correctly")


class ProfileIsolationTestCase(TestCase):
    """
    Every user must only ever see their OWN profile - never another
    user's. Role-specific profile endpoints must also reject the wrong role.
    """

    def setUp(self):
        self.student = CustomUser.objects.create_user(
            username="own_student",
            email="own_student@test.com",
            password="pass12345",
            is_student=True,
        )
        StudentProfile.objects.create(user=self.student, education="My Uni")
        self.other_student = CustomUser.objects.create_user(
            username="other_student",
            email="other_student@test.com",
            password="pass12345",
            is_student=True,
        )
        StudentProfile.objects.create(user=self.other_student, education="Other Uni")

        self.recruiter = CustomUser.objects.create_user(
            username="own_recruiter",
            email="own_recruiter@test.com",
            password="pass12345",
            is_recruiter=True,
        )
        company = Company.objects.create(
            name="Isolation Co", description="desc", location="NYC"
        )
        RecruiterProfile.objects.create(
            user=self.recruiter, company=company, designation="Talent"
        )
        self.client = APIClient()

    def test_student_sees_only_own_profile(self):
        """Student /me/ returns their own data, not another student's."""
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/v1/students/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.student.student_profile.id)
        self.assertEqual(response.data["education"], "My Uni")

    def test_recruiter_rejected_from_student_profile_endpoint(self):
        """Recruiters get 403 on student profile routes (no auto-created profile)."""
        self.client.force_authenticate(user=self.recruiter)
        response = self.client.get("/api/v1/students/me/")
        self.assertEqual(response.status_code, 403)
        # The whole point of the guard: no StudentProfile gets auto-created
        # for a non-student via get_or_create.
        self.assertEqual(
            StudentProfile.objects.filter(user=self.recruiter).count(), 0
        )

    def test_recruiter_rejected_from_all_student_actions(self):
        """All /v1/students/* endpoints are student-only, not just /me/."""
        self.client.force_authenticate(user=self.recruiter)
        for url in (
            "/api/v1/students/dashboard/",
            "/api/v1/students/applications/",
            "/api/v1/students/saved_jobs/",
            "/api/v1/students/save_job/",
        ):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 403, f"{url} should be 403")

    def test_student_rejected_from_recruiter_profile_endpoint(self):
        """Students get 403 on recruiter profile routes.

        This used to be a 404, but only incidentally: the view ran and simply
        found no recruiter_profile hanging off the student. Now IsRecruiter
        rejects at the door, mirroring the 403 recruiters get on /students/*.
        """
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/v1/recruiters/me/")
        self.assertEqual(response.status_code, 403)

    def test_student_rejected_from_all_recruiter_actions(self):
        """Every /v1/recruiters/* action is recruiter-only, reads and writes.

        create_job was the sharp edge: with IsAuthenticated alone a student
        could post a job and have a Company auto-provisioned for them.
        """
        self.client.force_authenticate(user=self.student)
        for url in (
            "/api/v1/recruiters/dashboard/",
            "/api/v1/recruiters/jobs/",
            "/api/v1/recruiters/internships/",
            "/api/v1/recruiters/applicants/",
            "/api/v1/recruiters/company/",
        ):
            self.assertEqual(
                self.client.get(url).status_code, 403, f"{url} should be 403"
            )

        job_count = Job.objects.count()
        response = self.client.post(
            "/api/v1/recruiters/create_job/",
            {
                "title": "Should Not Exist",
                "description": "x",
                "requirements": "none",
                "location": "Remote",
                "job_type": "Full-time",
                "experience_level": "Entry",
                "salary": "1",
                "experience_required": "0",
                "deadline": "2030-01-01",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Job.objects.count(), job_count)

    def test_recruiter_sees_only_own_recruiter_profile(self):
        """Recruiter /me/ returns their own recruiter profile."""
        self.client.force_authenticate(user=self.recruiter)
        response = self.client.get("/api/v1/recruiters/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["designation"], "Talent")

    def test_auth_me_returns_callers_own_identity(self):
        """/api/auth/me/ returns the authenticated user's own identity."""
        self.client.force_authenticate(user=self.student)
        response = self.client.get("/api/auth/me/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["id"], self.student.id)
        self.assertEqual(response.data["email"], "own_student@test.com")

    def test_save_job_with_unknown_job_id_returns_404(self):
        """A bogus job_id must not crash with a 500."""
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            "/api/v1/students/save_job/", {"job_id": 999999}, format="json"
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.student.saved_jobs.count(), 0)


class ResumeParserTestCase(TestCase):
    """Unit tests for the resume text/skill extraction, no HTTP involved."""

    def setUp(self):
        from jobs.models import Skill

        self.names = [
            "Python", "Django", "JavaScript", "TypeScript", "React",
            "Node.js", "PostgreSQL", "Kubernetes", "Docker", "CSS",
            "Java", "AWS", "Testing", "REST APIs", "Machine Learning",
        ]
        for name in self.names:
            Skill.objects.get_or_create(name=name)
        self.catalogue = list(Skill.objects.values_list("id", "name"))

    def _detect(self, text):
        from students import resume_parser

        return {s["name"] for s in resume_parser.detect_skills(text, self.catalogue)}

    def test_detects_plain_skill_mentions(self):
        found = self._detect("I build APIs with Python and Django every day.")
        self.assertIn("Python", found)
        self.assertIn("Django", found)

    def test_resolves_common_aliases(self):
        found = self._detect("Comfortable in JS and TS, deploy to k8s, store in Postgres.")
        self.assertIn("JavaScript", found)
        self.assertIn("TypeScript", found)
        self.assertIn("Kubernetes", found)
        self.assertIn("PostgreSQL", found)

    def test_does_not_match_skill_inside_a_longer_word(self):
        # The classic false positive: "Java" living inside "JavaScript".
        found = self._detect("Five years of JavaScript.")
        self.assertIn("JavaScript", found)
        self.assertNotIn("Java", found)

    def test_does_not_bleed_across_technology_punctuation(self):
        found = self._detect("Styling is done in CSS.")
        self.assertIn("CSS", found)
        self.assertNotIn("React", found)

    def test_evidence_quotes_the_source_sentence(self):
        from students import resume_parser

        results = resume_parser.detect_skills(
            "Unrelated opening line. Built a REST API in Python for payments.",
            self.catalogue,
        )
        python = next(r for r in results if r["name"] == "Python")
        self.assertIn("Python", python["evidence"])
        self.assertNotIn("Unrelated opening line", python["evidence"])

    def test_occurrences_are_counted(self):
        from students import resume_parser

        results = resume_parser.detect_skills(
            "Python here. More Python there. Python everywhere.", self.catalogue
        )
        python = next(r for r in results if r["name"] == "Python")
        self.assertEqual(python["occurrences"], 3)

    def test_extracts_experience_years_taking_the_largest_claim(self):
        from students import resume_parser

        text = "3 years of experience at one place, then 6 years of professional experience."
        self.assertEqual(resume_parser.detect_experience_years(text), 6)

    def test_experience_years_absent_when_not_stated(self):
        from students import resume_parser

        self.assertIsNone(resume_parser.detect_experience_years("No numbers here at all."))

    def test_education_level_prefers_the_highest_degree(self):
        from students import resume_parser

        self.assertEqual(
            resume_parser.detect_education_level("Bachelor of Science, later a PhD in ML."),
            "PhD",
        )
        self.assertEqual(
            resume_parser.detect_education_level("B.Tech in Computer Science"),
            "Bachelor's",
        )

    def test_unsupported_file_type_is_rejected(self):
        from students import resume_parser

        with self.assertRaises(resume_parser.ResumeTextExtractionError):
            resume_parser.extract_text(b"\x89PNG\r\n", "photo.png")

    def test_legacy_doc_is_rejected_with_a_helpful_message(self):
        from students import resume_parser

        with self.assertRaises(resume_parser.ResumeTextExtractionError) as ctx:
            resume_parser.extract_text(b"anything", "cv.doc")
        self.assertIn("PDF", str(ctx.exception))

    def test_parse_rejects_a_document_with_no_readable_text(self):
        from students import resume_parser

        with self.assertRaises(resume_parser.ResumeTextExtractionError):
            resume_parser.parse(b"hi", "cv.txt", self.catalogue)

    def test_docx_is_read_without_a_third_party_dependency(self):
        import io
        import zipfile

        from students import resume_parser

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as archive:
            archive.writestr(
                "word/document.xml",
                "<w:document><w:body><w:p><w:r><w:t>Backend work in Python and "
                "Django. 4 years of experience. Master of Science.</w:t></w:r>"
                "</w:p></w:body></w:document>",
            )
        result = resume_parser.parse(buf.getvalue(), "cv.docx", self.catalogue)
        self.assertIn("Python", {s["name"] for s in result["skills"]})
        self.assertEqual(result["experience_years"], 4)
        self.assertEqual(result["education_level"], "Master's")


class ResumeParsingEndpointTestCase(TestCase):
    """The HTTP contract: auth, validation, and confirm-before-write."""

    def setUp(self):
        from jobs.models import Skill

        self.client = APIClient()
        self.student = CustomUser.objects.create_user(
            username="resume_student",
            email="resume_student@example.com",
            password="pass12345",
            is_student=True,
        )
        self.recruiter = CustomUser.objects.create_user(
            username="resume_recruiter",
            email="resume_recruiter@example.com",
            password="pass12345",
            is_recruiter=True,
        )
        for name in ["Python", "Django", "Kubernetes"]:
            Skill.objects.get_or_create(name=name)
        self.python = Skill.objects.get(name="Python")
        self.cv = b"Backend engineer. Built services in Python and Django on Kubernetes clusters."

    def _upload(self, name="cv.txt", content=None):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return self.client.post(
            "/api/v1/students/parse_resume/",
            {"resume": SimpleUploadedFile(name, content or self.cv)},
            format="multipart",
        )

    def test_requires_authentication(self):
        self.assertEqual(self._upload().status_code, 401)

    def test_recruiters_are_rejected(self):
        self.client.force_authenticate(user=self.recruiter)
        self.assertEqual(self._upload().status_code, 403)

    def test_returns_detected_skills_for_a_student(self):
        self.client.force_authenticate(user=self.student)
        response = self._upload()
        self.assertEqual(response.status_code, 200)
        names = {s["name"] for s in response.data["skills"]}
        self.assertIn("Python", names)
        self.assertIn("Kubernetes", names)

    def test_parsing_never_writes_to_the_profile(self):
        self.client.force_authenticate(user=self.student)
        self._upload()
        profile = StudentProfile.objects.get(user=self.student)
        self.assertEqual(profile.skills.count(), 0)

    def test_already_on_profile_is_flagged(self):
        profile, _ = StudentProfile.objects.get_or_create(user=self.student)
        profile.skills.add(self.python)
        self.client.force_authenticate(user=self.student)
        response = self._upload()
        by_name = {s["name"]: s for s in response.data["skills"]}
        self.assertTrue(by_name["Python"]["already_on_profile"])
        self.assertFalse(by_name["Kubernetes"]["already_on_profile"])

    def test_missing_file_and_no_stored_resume_is_a_clean_400(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post("/api/v1/students/parse_resume/", {}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("error", response.data)

    def test_applying_skills_adds_them_to_the_profile(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            "/api/v1/students/apply_parsed_skills/",
            {"skill_ids": [self.python.id]},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["added"], ["Python"])
        profile = StudentProfile.objects.get(user=self.student)
        self.assertIn("Python", profile.skills.values_list("name", flat=True))

    def test_applying_the_same_skill_twice_is_idempotent(self):
        self.client.force_authenticate(user=self.student)
        payload = {"skill_ids": [self.python.id]}
        self.client.post("/api/v1/students/apply_parsed_skills/", payload, format="json")
        second = self.client.post("/api/v1/students/apply_parsed_skills/", payload, format="json")
        self.assertEqual(second.data["added"], [])
        profile = StudentProfile.objects.get(user=self.student)
        self.assertEqual(profile.skills.filter(name="Python").count(), 1)

    def test_apply_rejects_a_malformed_payload(self):
        self.client.force_authenticate(user=self.student)
        for payload in ({"skill_ids": []}, {"skill_ids": "Python"}, {"skill_ids": ["abc"]}, {}):
            response = self.client.post(
                "/api/v1/students/apply_parsed_skills/", payload, format="json"
            )
            self.assertEqual(response.status_code, 400, payload)

    def test_apply_rejects_unknown_skill_ids(self):
        self.client.force_authenticate(user=self.student)
        response = self.client.post(
            "/api/v1/students/apply_parsed_skills/", {"skill_ids": [999999]}, format="json"
        )
        self.assertEqual(response.status_code, 400)
