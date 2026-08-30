from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from portal.query_utils import filter_by_id
# DRF's get_object_or_404 is the same shortcut but also turns a pk that
# cannot be coerced to the field type (e.g. /courses/abc/) into a 404
# instead of letting the ValueError surface as a 500.
from rest_framework.generics import get_object_or_404
from django.utils import timezone

from .models import Course, CourseModule, CourseLesson, CourseEnrollment, LessonProgress
from .serializers import (
    CourseSerializer, CourseListSerializer,
    CourseEnrollmentSerializer, CourseLessonSerializer,
)


class CourseViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.AllowAny]
    serializer_class = CourseSerializer

    def list(self, request):
        """List published courses."""
        queryset = Course.objects.filter(is_published=True).select_related("instructor", "skill")

        skill_id = request.query_params.get("skill_id")
        difficulty = request.query_params.get("difficulty")
        is_free = request.query_params.get("is_free")

        if skill_id:
            queryset, invalid = filter_by_id(queryset, skill_id=skill_id)
            if invalid:
                return Response({"error": "skill_id must be a number"}, status=400)
        if difficulty:
            queryset = queryset.filter(difficulty=difficulty)
        if is_free is not None:
            queryset = queryset.filter(is_free=is_free.lower() == "true")

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = CourseListSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)

        serializer = CourseListSerializer(queryset[:50], many=True, context={"request": request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        course = get_object_or_404(Course, pk=pk)
        serializer = CourseSerializer(course, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def enroll(self, request, pk=None):
        """Enroll in a course."""
        course = get_object_or_404(Course, pk=pk)
        enrollment, created = CourseEnrollment.objects.get_or_create(
            user=request.user, course=course
        )
        if created:
            course.enrollment_count += 1
            course.save(update_fields=["enrollment_count"])
            return Response(CourseEnrollmentSerializer(enrollment).data, status=201)
        return Response(CourseEnrollmentSerializer(enrollment).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def unenroll(self, request, pk=None):
        """Unenroll from a course."""
        course = get_object_or_404(Course, pk=pk)
        enrollment = CourseEnrollment.objects.filter(user=request.user, course=course).first()
        if enrollment:
            enrollment.delete()
            course.enrollment_count = max(0, course.enrollment_count - 1)
            course.save(update_fields=["enrollment_count"])
            return Response(status=204)
        return Response({"error": "Not enrolled"}, status=400)

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def my_courses(self, request):
        """Get courses the user is enrolled in."""
        enrollments = CourseEnrollment.objects.filter(user=request.user).select_related("course")
        serializer = CourseEnrollmentSerializer(enrollments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def complete_lesson(self, request, pk=None):
        """Mark a lesson as completed."""
        course = get_object_or_404(Course, pk=pk)
        lesson_id = request.data.get("lesson_id")
        if not lesson_id:
            return Response({"error": "lesson_id is required"}, status=400)

        lesson = get_object_or_404(CourseLesson, pk=lesson_id, module__course=course)
        progress, _ = LessonProgress.objects.get_or_create(
            user=request.user, lesson=lesson,
            defaults={"completed": True, "completed_at": timezone.now()}
        )
        if not progress.completed:
            progress.completed = True
            progress.completed_at = timezone.now()
            progress.save(update_fields=["completed", "completed_at"])

        # Update enrollment progress
        enrollment = CourseEnrollment.objects.filter(user=request.user, course=course).first()
        if enrollment:
            total_lessons = CourseLesson.objects.filter(module__course=course).count()
            completed_lessons = LessonProgress.objects.filter(
                user=request.user, lesson__module__course=course, completed=True
            ).count()
            enrollment.progress_percent = int((completed_lessons / max(total_lessons, 1)) * 100)
            if enrollment.progress_percent >= 100:
                enrollment.status = "completed"
                enrollment.completed_at = timezone.now()
            else:
                enrollment.status = "in_progress"
            enrollment.save(update_fields=["progress_percent", "status", "completed_at"])

        return Response({"completed": True, "progress_percent": enrollment.progress_percent if enrollment else 0})

    @action(detail=False, methods=["get"], permission_classes=[permissions.IsAuthenticated])
    def progress(self, request):
        """Get overall learning progress."""
        enrollments = CourseEnrollment.objects.filter(user=request.user).select_related("course")
        total_courses = enrollments.count()
        completed = enrollments.filter(status="completed").count()
        in_progress = enrollments.filter(status="in_progress").count()
        total_hours = sum(float(e.course.duration_hours) * (e.progress_percent / 100) for e in enrollments)

        return Response({
            "total_courses": total_courses,
            "completed": completed,
            "in_progress": in_progress,
            "total_hours_learned": round(total_hours, 1),
            "enrollments": CourseEnrollmentSerializer(enrollments, many=True).data,
        })


class LessonViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=["get"], url_path="module/(?P<module_id>[^/.]+)")
    def by_module(self, request, module_id=None):
        """Get lessons for a module."""
        lessons = CourseLesson.objects.filter(module_id=module_id).order_by("order")
        serializer = CourseLessonSerializer(lessons, many=True, context={"request": request})
        return Response(serializer.data)
