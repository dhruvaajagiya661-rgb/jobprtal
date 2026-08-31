"""Tests for careers app - Career paths, interview prep, and skill development."""

from datetime import timedelta

from django.test import TestCase
from django.apps import apps as django_apps
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import CustomUser
from jobs.models import Skill, Job
from recruiters.models import Company
from students.models import StudentProfile
from .models import (
    InterviewQuestion,
    QuestionBookmark,
    QuestionAttempt,
    SkillLearningStatus,
)


class CareersAppTestCase(TestCase):
    """Test case for careers functionality."""

    def test_app_config(self):
        try:
            app_config = django_apps.get_app_config("careers")
            self.assertIsNotNone(app_config)
            self.assertEqual(app_config.name, "careers")
        except LookupError:
            self.fail("careers app is not registered in INSTALLED_APPS")

    def test_models_importable(self):
        try:
            __import__("careers.models")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "careers.models should import correctly")

    def test_views_importable(self):
        try:
            __import__("careers.views")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "careers.views should import correctly")

    def test_services_importable(self):
        try:
            __import__("careers.services")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "careers.services should import correctly")

    def test_seed_importable(self):
        try:
            __import__("careers.seed_careers")
            imported = True
        except ImportError:
            imported = False
        self.assertTrue(imported, "careers.seed_careers should import correctly")


class InterviewPrepAPITestCase(TestCase):
    """Tests for the interview prep API endpoints."""

    def setUp(self):
        self.student = CustomUser.objects.create_user(
            email="student@example.com", password="testpass123", is_student=True
        )
        self.recruiter = CustomUser.objects.create_user(
            email="recruiter@example.com", password="testpass123", is_recruiter=True
        )
        self.skill = Skill.objects.create(name="Python")
        self.q1 = InterviewQuestion.objects.create(
            skill=self.skill,
            question="What is a decorator in Python?",
            answer="A function that wraps another function to extend its behavior.",
            difficulty="beginner",
        )
        self.q2 = InterviewQuestion.objects.create(
            skill=self.skill,
            question="Explain the Global Interpreter Lock.",
            answer="A mutex that protects access to Python objects.",
            difficulty="advanced",
        )
        self.client = APIClient()

    # ---- quiz ----

    def test_quiz_is_public_and_returns_questions(self):
        resp = self.client.get("/api/v1/interview-prep/quiz/", {"count": 2})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("questions", data)
        self.assertEqual(data["time_per_question"], 60)
        self.assertLessEqual(len(data["questions"]), 2)
        self.assertIn("question", data["questions"][0])

    def test_quiz_filters_by_skill_and_difficulty(self):
        resp = self.client.get(
            "/api/v1/interview-prep/quiz/",
            {"skill_ids": str(self.skill.id), "difficulty": "advanced", "count": 5},
        )
        self.assertEqual(resp.status_code, 200)
        questions = resp.json()["questions"]
        self.assertTrue(questions)
        for q in questions:
            self.assertEqual(q["skill"]["id"], self.skill.id)
            self.assertEqual(q["difficulty"], "advanced")

    def test_mock_returns_timed_set(self):
        resp = self.client.get("/api/v1/interview-prep/mock/", {"count": 2})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["is_mock"])
        self.assertEqual(data["time_per_question"], 45)

    # ---- record_attempt ----

    def test_record_attempt_requires_auth(self):
        resp = self.client.post(
            "/api/v1/interview-prep/record_attempt/",
            {"question_id": self.q1.id, "correct": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_record_attempt_creates_attempt_and_returns_stats(self):
        self.client.force_authenticate(user=self.student)
        resp = self.client.post(
            "/api/v1/interview-prep/record_attempt/",
            {"question_id": self.q1.id, "correct": True, "mode": "quiz"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_attempts"], 1)
        self.assertEqual(data["correct"], 1)
        self.assertEqual(data["accuracy"], 100.0)
        self.assertTrue(
            QuestionAttempt.objects.filter(
                student=self.student, question=self.q1, correct=True
            ).exists()
        )

    def test_record_attempt_string_false_is_not_correct(self):
        self.client.force_authenticate(user=self.student)
        resp = self.client.post(
            "/api/v1/interview-prep/record_attempt/",
            {"question_id": self.q1.id, "correct": "false", "mode": "quiz"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["correct"], 0)
        self.assertEqual(data["incorrect"], 1)

    def test_record_attempt_missing_question_returns_400(self):
        self.client.force_authenticate(user=self.student)
        resp = self.client.post(
            "/api/v1/interview-prep/record_attempt/",
            {"correct": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    # ---- progress ----

    def test_progress_requires_auth(self):
        resp = self.client.get("/api/v1/interview-prep/progress/")
        self.assertEqual(resp.status_code, 401)

    def test_progress_returns_empty_stats(self):
        self.client.force_authenticate(user=self.student)
        resp = self.client.get("/api/v1/interview-prep/progress/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_attempts"], 0)
        self.assertEqual(data["accuracy"], 0)
        self.assertEqual(data["streak"], 0)
        self.assertIn("by_difficulty", data)
        self.assertIn("recent_attempts", data)

    def test_progress_counts_attempts_and_accuracy(self):
        self.client.force_authenticate(user=self.student)
        QuestionAttempt.objects.create(
            student=self.student, question=self.q1, correct=True
        )
        QuestionAttempt.objects.create(
            student=self.student, question=self.q2, correct=False
        )
        resp = self.client.get("/api/v1/interview-prep/progress/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_attempts"], 2)
        self.assertEqual(data["correct"], 1)
        self.assertEqual(data["incorrect"], 1)
        self.assertEqual(data["accuracy"], 50.0)
        self.assertEqual(data["streak"], 1)

    # ---- bookmarks ----

    def test_bookmark_requires_auth(self):
        resp = self.client.post(
            "/api/v1/interview-prep/bookmark/",
            {"question_id": self.q1.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_bookmark_toggle_and_list(self):
        self.client.force_authenticate(user=self.student)
        # add
        resp = self.client.post(
            "/api/v1/interview-prep/bookmark/",
            {"question_id": self.q1.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["bookmarked"])
        self.assertTrue(
            QuestionBookmark.objects.filter(
                student=self.student, question=self.q1
            ).exists()
        )
        # list
        resp = self.client.get("/api/v1/interview-prep/bookmarks/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["bookmarks"]), 1)
        self.assertEqual(data["bookmarks"][0]["question"]["id"], self.q1.id)
        # toggle off
        resp = self.client.post(
            "/api/v1/interview-prep/bookmark/",
            {"question_id": self.q1.id},
            format="json",
        )
        self.assertFalse(resp.json()["bookmarked"])
        resp = self.client.get("/api/v1/interview-prep/bookmarks/")
        self.assertEqual(len(resp.json()["bookmarks"]), 0)

    def test_bookmarks_requires_auth(self):
        resp = self.client.get("/api/v1/interview-prep/bookmarks/")
        self.assertEqual(resp.status_code, 401)


class SkillGapAPITestCase(TestCase):
    """Tests for the skill gap analysis API endpoints."""

    def setUp(self):
        self.student = CustomUser.objects.create_user(
            email="student@example.com", password="testpass123", is_student=True
        )
        self.recruiter = CustomUser.objects.create_user(
            email="recruiter@example.com", password="testpass123", is_recruiter=True
        )
        self.skill = Skill.objects.create(name="Python")
        self.company = Company.objects.create(
            name="Acme", description="We build things", location="Remote"
        )
        self.job = Job.objects.create(
            title="Python Developer",
            company=self.company,
            recruiter=self.recruiter,
            description="Build backend services.",
            requirements="Python experience",
            location="Remote",
            salary="$100k",
            job_type="Full-time",
            experience_required="2 years",
            deadline=timezone.now().date() + timedelta(days=30),
        )
        self.job.skills_required.add(self.skill)
        self.profile = StudentProfile.objects.create(user=self.student)
        self.client = APIClient()
        self.client.force_authenticate(user=self.student)

    def test_analyze_returns_full_analysis(self):
        resp = self.client.get("/api/v1/skill-gap/analyze/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("student_skills", data)
        self.assertIn("recommended_skills", data)
        self.assertIn("career_recommendations", data)
        self.assertIn("job_breakdown", data)

    # ---- roadmap ----

    def test_roadmap_requires_student(self):
        self.client.force_authenticate(user=self.recruiter)
        resp = self.client.get("/api/v1/skill-gap/roadmap/")
        self.assertEqual(resp.status_code, 403)

    def test_roadmap_returns_ranked_gaps(self):
        resp = self.client.get("/api/v1/skill-gap/roadmap/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("roadmap", data)
        # Student has no skills yet, so Python (required by the job) is a gap.
        self.assertTrue(
            any(item["skill_name"] == "Python" for item in data["roadmap"])
        )
        item = next(i for i in data["roadmap"] if i["skill_name"] == "Python")
        self.assertIn("priority_score", item)
        self.assertIn("status", item)
        self.assertIn("demand_count", item)

    # ---- set_status ----

    def test_set_status_requires_student(self):
        self.client.force_authenticate(user=self.recruiter)
        resp = self.client.post(
            "/api/v1/skill-gap/set_status/",
            {"skill_name": "Python", "status": "in_progress"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_set_status_updates_learning_status(self):
        resp = self.client.post(
            "/api/v1/skill-gap/set_status/",
            {"skill_name": "Python", "status": "in_progress"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "in_progress")
        self.assertEqual(data["skill_name"], "Python")
        status = SkillLearningStatus.objects.get(
            student=self.student, skill=self.skill
        )
        self.assertEqual(status.status, "in_progress")

    def test_set_status_learned_adds_skill_to_profile(self):
        resp = self.client.post(
            "/api/v1/skill-gap/set_status/",
            {"skill_name": "Python", "status": "learned"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.profile.refresh_from_db()
        self.assertTrue(self.profile.skills.filter(id=self.skill.id).exists())

    def test_set_status_invalid_status_returns_400(self):
        resp = self.client.post(
            "/api/v1/skill-gap/set_status/",
            {"skill_name": "Python", "status": "banana"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_set_status_unknown_skill_returns_404(self):
        resp = self.client.post(
            "/api/v1/skill-gap/set_status/",
            {"skill_name": "DoesNotExist", "status": "in_progress"},
            format="json",
        )
        self.assertEqual(resp.status_code, 404)


class MatchBreakdownTestCase(TestCase):
    """
    The match breakdown must explain the score it reports.

    `get_match_score` delegates to `get_match_breakdown`, so these also guard
    against the score and its explanation drifting apart.
    """

    def setUp(self):
        self.recruiter = CustomUser.objects.create_user(
            email="mb_rec@example.com", password="testpass123", is_recruiter=True
        )
        self.student = CustomUser.objects.create_user(
            email="mb_student@example.com", password="testpass123", is_student=True
        )
        self.profile, _ = StudentProfile.objects.get_or_create(user=self.student)
        self.company = Company.objects.create(
            name="Initech", description="Software", location="Remote"
        )
        self.django = Skill.objects.create(name="Django")
        self.react = Skill.objects.create(name="React")
        self.rust = Skill.objects.create(name="Rust")

        self.job = Job.objects.create(
            title="Fullstack Engineer",
            company=self.company,
            recruiter=self.recruiter,
            description="d",
            requirements="r",
            location="Remote",
            salary="$100k",
            job_type="Full-time",
            experience_required="2 years",
            deadline=timezone.now().date() + timedelta(days=30),
        )
        self.job.skills_required.set([self.django, self.react, self.rust])
        # Student knows two of the three required skills.
        self.profile.skills.set([self.django, self.react])
        self.client = APIClient()

    def _breakdown(self):
        from .services import JobMatchingService

        # Re-fetch so the per-instance caches don't leak between assertions.
        profile = StudentProfile.objects.get(pk=self.profile.pk)
        return JobMatchingService.get_match_breakdown(profile, self.job)

    def test_matched_and_missing_skills_are_reported(self):
        b = self._breakdown()
        self.assertEqual(b["matched_skills"], ["Django", "React"])
        self.assertEqual(b["missing_skills"], ["Rust"])

    def test_score_matches_get_match_score(self):
        """The badge number and the explanation must never disagree."""
        from .services import JobMatchingService

        profile = StudentProfile.objects.get(pk=self.profile.pk)
        score = JobMatchingService.get_match_score(profile, self.job)
        self.assertEqual(score, self._breakdown()["score"])

    def test_component_points_sum_to_score(self):
        b = self._breakdown()
        total = round(sum(c["points"] for c in b["components"]), 1)
        self.assertEqual(total, b["score"])

    def test_components_never_exceed_their_weight(self):
        for c in self._breakdown()["components"]:
            self.assertLessEqual(c["points"], c["max_points"], c["label"])
            self.assertGreaterEqual(c["points"], 0, c["label"])

    def test_verdict_reflects_score_band(self):
        b = self._breakdown()
        expected = (
            "Strong match" if b["score"] >= 70
            else "Possible match" if b["score"] >= 40
            else "Stretch role"
        )
        self.assertEqual(b["verdict"], expected)

    def test_more_skills_raises_the_score(self):
        before = self._breakdown()["score"]
        self.profile.skills.add(self.rust)
        after = self._breakdown()["score"]
        self.assertGreater(after, before)
        self.assertEqual(self._breakdown()["missing_skills"], [])

    def test_api_exposes_breakdown_to_students(self):
        self.client.force_authenticate(user=self.student)
        resp = self.client.get(f"/api/v1/jobs/{self.job.id}/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIsNotNone(data["match_breakdown"])
        self.assertEqual(data["match_breakdown"]["score"], data["match_score"])
        self.assertEqual(data["match_breakdown"]["missing_skills"], ["Rust"])

    def test_api_hides_breakdown_from_anonymous_users(self):
        """API shape stays stable; the field is null rather than absent."""
        resp = self.client.get(f"/api/v1/jobs/{self.job.id}/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("match_breakdown", data)
        self.assertIsNone(data["match_breakdown"])
