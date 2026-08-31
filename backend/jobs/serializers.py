from rest_framework import serializers
from .models import Job, Skill, Category, JobAlert
from recruiters.models import Company
from portal.validators import validate_posting_deadline


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ("id", "name")


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name")


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ("id", "name", "logo", "industry", "location")


class MatchScoreMixin:
    """Adds a `match_score` field computed for authenticated students.

    For anonymous users and recruiters the field is `None` so the API shape
    stays stable; the frontend simply hides the badge when it's absent.
    """

    def get_match_score(self, obj) -> float | None:
        request = self.context.get("request")
        if not (
            request and request.user.is_authenticated and request.user.is_student
        ):
            return None
        profile = getattr(request.user, "student_profile", None)
        if profile is None:
            return None
        from careers.services import JobMatchingService

        return JobMatchingService.get_match_score(profile, obj)

    def get_match_breakdown(self, obj) -> dict | None:
        """Per-component explanation of `match_score` (students only)."""
        request = self.context.get("request")
        if not (
            request and request.user.is_authenticated and request.user.is_student
        ):
            return None
        profile = getattr(request.user, "student_profile", None)
        if profile is None:
            return None
        from careers.services import JobMatchingService

        return JobMatchingService.get_match_breakdown(profile, obj)


class JobSerializer(MatchScoreMixin, serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    skills_required = SkillSerializer(many=True, read_only=True)
    match_score = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = (
            "id",
            "title",
            "company",
            "category",
            "job_type",
            "location",
            "salary",
            "experience_required",
            "skills_required",
            "deadline",
            "created_at",
            "match_score",
        )

    # update_job writes through this serializer, so it needs the same deadline
    # guard the create serializer has -- otherwise a PATCH can move a live job
    # into the past, where every listing's deadline__gte filter hides it.
    validate_deadline = validate_posting_deadline


class JobDetailSerializer(MatchScoreMixin, serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    skills_required = SkillSerializer(many=True, read_only=True)
    preferred_skills = SkillSerializer(many=True, read_only=True)
    match_score = serializers.SerializerMethodField()
    match_breakdown = serializers.SerializerMethodField()
    has_applied = serializers.SerializerMethodField()
    recruiter = serializers.SerializerMethodField()

    class Meta:
        model = Job
        fields = (
            "id",
            "title",
            "company",
            "recruiter",
            "category",
            "job_type",
            "description",
            "requirements",
            "location",
            "salary",
            "experience_required",
            "skills_required",
            "preferred_skills",
            "deadline",
            "openings",
            "created_at",
            "is_active",
            "match_score",
            "match_breakdown",
            "has_applied",
        )

    def get_has_applied(self, obj) -> bool:
        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.is_student:
            from applications.models import Application

            return Application.objects.filter(
                job=obj, student=request.user
            ).exists()
        return False

    def get_recruiter(self, obj) -> dict | None:
        """Who posted this, so the listing can link to their public profile.

        Name and job title only - the hiring contact is public information on
        a job advert, their email is not.
        """
        recruiter = obj.recruiter
        if recruiter is None:
            return None
        profile = getattr(recruiter, "recruiter_profile", None)
        return {
            "id": recruiter.id,
            "name": recruiter.get_full_name() or recruiter.username,
            "designation": profile.designation if profile else "",
        }


class JobAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobAlert
        fields = [
            "id", "title", "keywords", "location", "job_type",
            "category", "skills", "min_salary", "frequency",
            "is_active", "last_sent", "created_at",
        ]
        read_only_fields = ["id", "last_sent", "created_at"]
