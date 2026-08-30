"""Tests for the learning app (courses, enrollment, lesson progress)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from .models import Course, CourseModule, CourseLesson, CourseEnrollment, LessonProgress

User = get_user_model()


@pytest.fixture
def alice(db):
    return User.objects.create_user(username="alice", email="alice@x.com", password="pw12345!")


@pytest.fixture
def client_alice(alice):
    client = APIClient()
    client.force_authenticate(user=alice)
    return client


@pytest.fixture
def course(db):
    return Course.objects.create(
        title="Python Basics",
        description="Learn Python",
        difficulty="beginner",
        duration_hours=10,
        is_published=True,
    )


@pytest.fixture
def lessons(course):
    module = CourseModule.objects.create(course=course, title="Module 1", order=1)
    return [
        CourseLesson.objects.create(module=module, title=f"Lesson {i}", order=i)
        for i in range(1, 3)
    ]


class TestCourseList:
    def test_list_is_public(self, course):
        response = APIClient().get("/api/v1/courses/")
        assert response.status_code == 200

    def test_unpublished_course_hidden(self, course):
        Course.objects.create(title="Draft", description="d", is_published=False)
        response = APIClient().get("/api/v1/courses/")
        titles = [c["title"] for c in response.json().get("results", response.json())]
        assert "Draft" not in titles

    def test_filter_by_difficulty(self, course):
        response = APIClient().get("/api/v1/courses/?difficulty=beginner")
        assert response.status_code == 200

    def test_non_numeric_skill_id_returns_400(self, course):
        """Regression: a non-numeric skill_id reached the ORM and raised a 500."""
        response = APIClient().get("/api/v1/courses/?skill_id=abc")
        assert response.status_code == 400

    def test_missing_course_returns_404(self, db):
        response = APIClient().get("/api/v1/courses/999999/")
        assert response.status_code == 404


class TestEnrollment:
    def test_enroll_increments_count(self, client_alice, alice, course):
        response = client_alice.post(f"/api/v1/courses/{course.id}/enroll/", {}, format="json")
        assert response.status_code == 201
        course.refresh_from_db()
        assert course.enrollment_count == 1
        assert CourseEnrollment.objects.filter(user=alice, course=course).exists()

    def test_enroll_twice_does_not_double_count(self, client_alice, course):
        client_alice.post(f"/api/v1/courses/{course.id}/enroll/", {}, format="json")
        response = client_alice.post(f"/api/v1/courses/{course.id}/enroll/", {}, format="json")
        assert response.status_code == 200
        course.refresh_from_db()
        assert course.enrollment_count == 1

    def test_enroll_requires_auth(self, course):
        response = APIClient().post(f"/api/v1/courses/{course.id}/enroll/", {}, format="json")
        assert response.status_code in (401, 403)

    def test_unenroll(self, client_alice, alice, course):
        client_alice.post(f"/api/v1/courses/{course.id}/enroll/", {}, format="json")
        response = client_alice.post(f"/api/v1/courses/{course.id}/unenroll/", {}, format="json")
        assert response.status_code == 204
        course.refresh_from_db()
        assert course.enrollment_count == 0

    def test_unenroll_when_not_enrolled(self, client_alice, course):
        response = client_alice.post(f"/api/v1/courses/{course.id}/unenroll/", {}, format="json")
        assert response.status_code == 400


class TestLessonProgress:
    def test_complete_lesson_updates_progress(self, client_alice, alice, course, lessons):
        client_alice.post(f"/api/v1/courses/{course.id}/enroll/", {}, format="json")
        response = client_alice.post(
            f"/api/v1/courses/{course.id}/complete_lesson/",
            {"lesson_id": lessons[0].id},
            format="json",
        )
        assert response.status_code == 200
        assert response.json()["progress_percent"] == 50
        assert LessonProgress.objects.filter(user=alice, lesson=lessons[0], completed=True).exists()

    def test_completing_all_lessons_marks_course_completed(
        self, client_alice, alice, course, lessons
    ):
        client_alice.post(f"/api/v1/courses/{course.id}/enroll/", {}, format="json")
        for lesson in lessons:
            client_alice.post(
                f"/api/v1/courses/{course.id}/complete_lesson/",
                {"lesson_id": lesson.id},
                format="json",
            )
        enrollment = CourseEnrollment.objects.get(user=alice, course=course)
        assert enrollment.progress_percent == 100
        assert enrollment.status == "completed"

    def test_missing_lesson_id_returns_400(self, client_alice, course):
        response = client_alice.post(
            f"/api/v1/courses/{course.id}/complete_lesson/", {}, format="json"
        )
        assert response.status_code == 400

    def test_lesson_from_another_course_returns_404(self, client_alice, course, lessons):
        other = Course.objects.create(title="Other", description="d", is_published=True)
        response = client_alice.post(
            f"/api/v1/courses/{other.id}/complete_lesson/",
            {"lesson_id": lessons[0].id},
            format="json",
        )
        assert response.status_code == 404


class TestProgressSummary:
    def test_progress_summary(self, client_alice, course):
        client_alice.post(f"/api/v1/courses/{course.id}/enroll/", {}, format="json")
        response = client_alice.get("/api/v1/courses/progress/")
        assert response.status_code == 200
        body = response.json()
        assert body["total_courses"] == 1
        assert body["completed"] == 0

    def test_progress_requires_auth(self):
        response = APIClient().get("/api/v1/courses/progress/")
        assert response.status_code in (401, 403)


class TestNonNumericPkReturns404:
    """A non-numeric pk must be a clean 404, never a 500.

    Regression guard: these viewsets used django.shortcuts.get_object_or_404,
    which lets the ValueError from coercing "abc" to an integer escape as an
    unhandled 500. DRF's variant maps it to Http404.
    """

    @pytest.mark.parametrize("path", [
        "/api/v1/courses/abc/",
        "/api/v1/courses/1.5/",
        "/api/v1/lessons/abc/",
    ])
    def test_bad_pk_is_404(self, db, path):
        response = APIClient().get(path)
        assert response.status_code == 404, (
            "%s returned %s; a non-numeric pk must not 500"
            % (path, response.status_code)
        )
