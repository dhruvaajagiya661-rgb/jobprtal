from rest_framework import serializers
from .models import Internship
from jobs.serializers import (
    CompanySerializer,
    CategorySerializer,
    SkillSerializer,
    MatchScoreMixin,
)


class InternshipListSerializer(MatchScoreMixin, serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    skills_required = SkillSerializer(many=True, read_only=True)
    match_score = serializers.SerializerMethodField()

    class Meta:
        model = Internship
        fields = (
            "id",
            "title",
            "company",
            "category",
            "internship_type",
            "location",
            "stipend",
            "duration",
            "skills_required",
            "deadline",
            "created_at",
            "is_active",
            "match_score",
        )


class InternshipDetailSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    skills_required = SkillSerializer(many=True, read_only=True)
    preferred_skills = SkillSerializer(many=True, read_only=True)
    has_applied = serializers.SerializerMethodField()
    recruiter = serializers.SerializerMethodField()

    class Meta:
        model = Internship
        fields = (
            "id",
            "title",
            "company",
            "recruiter",
            "category",
            "internship_type",
            "description",
            "requirements",
            "location",
            "stipend",
            "duration",
            "skills_required",
            "preferred_skills",
            "deadline",
            "openings",
            "created_at",
            "is_active",
            "has_applied",
        )
        read_only_fields = ("created_at",)

    def get_has_applied(self, obj) -> bool:
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            from applications.models import Application

            return Application.objects.filter(
                internship=obj, student=request.user
            ).exists()
        return False

    def get_recruiter(self, obj) -> dict | None:
        """Who posted this, so the listing can link to their public profile."""
        recruiter = obj.recruiter
        if recruiter is None:
            return None
        profile = getattr(recruiter, "recruiter_profile", None)
        return {
            "id": recruiter.id,
            "name": recruiter.get_full_name() or recruiter.username,
            "designation": profile.designation if profile else "",
        }
