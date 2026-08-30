from rest_framework import serializers
from .models import Course, CourseModule, CourseLesson, CourseEnrollment, LessonProgress


class CourseLessonSerializer(serializers.ModelSerializer):
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = CourseLesson
        fields = ["id", "title", "lesson_type", "content", "video_url", "duration_minutes", "order", "is_completed"]
        read_only_fields = ["id"]

    def get_is_completed(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return LessonProgress.objects.filter(user=request.user, lesson=obj, completed=True).exists()
        return False


class CourseModuleSerializer(serializers.ModelSerializer):
    lessons = CourseLessonSerializer(many=True, read_only=True)

    class Meta:
        model = CourseModule
        fields = ["id", "title", "order", "lessons"]
        read_only_fields = ["id"]


class CourseSerializer(serializers.ModelSerializer):
    modules = CourseModuleSerializer(many=True, read_only=True)
    is_enrolled = serializers.SerializerMethodField()
    instructor_name = serializers.SerializerMethodField()
    skill_name = serializers.CharField(source="skill.name", read_only=True, default=None)

    class Meta:
        model = Course
        fields = [
            "id", "title", "description", "instructor", "instructor_name",
            "skill", "skill_name", "thumbnail", "difficulty", "duration_hours",
            "is_free", "price", "rating", "enrollment_count", "is_published",
            "modules", "is_enrolled", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "enrollment_count", "created_at", "updated_at"]

    def get_is_enrolled(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return CourseEnrollment.objects.filter(user=request.user, course=obj).exists()
        return False

    def get_instructor_name(self, obj):
        if obj.instructor:
            return obj.instructor.username or obj.instructor.email
        return None


class CourseListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for course listing."""
    instructor_name = serializers.SerializerMethodField()
    skill_name = serializers.CharField(source="skill.name", read_only=True, default=None)
    is_enrolled = serializers.SerializerMethodField()
    total_lessons = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            "id", "title", "description", "instructor_name", "skill_name",
            "thumbnail", "difficulty", "duration_hours", "is_free", "price",
            "rating", "enrollment_count", "is_enrolled", "total_lessons",
        ]

    def get_instructor_name(self, obj):
        if obj.instructor:
            return obj.instructor.username or obj.instructor.email
        return None

    def get_is_enrolled(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return CourseEnrollment.objects.filter(user=request.user, course=obj).exists()
        return False

    def get_total_lessons(self, obj):
        return CourseLesson.objects.filter(module__course=obj).count()


class CourseEnrollmentSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = CourseEnrollment
        fields = ["id", "course", "course_title", "status", "progress_percent", "enrolled_at", "completed_at"]
        read_only_fields = ["id", "progress_percent", "enrolled_at", "completed_at"]
