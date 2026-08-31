from rest_framework import serializers
from .models import StudentProfile
from jobs.serializers import SkillSerializer


class StudentProfileSerializer(serializers.ModelSerializer):
    skills = SkillSerializer(many=True, read_only=True)
    skill_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    # Projects are a list of {"id", "title", "description", "link"} entries.
    # The DictField keeps the shape honest while allowing blank values.
    projects = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField(allow_blank=True, required=False)
        ),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = StudentProfile
        fields = (
            "id",
            "profile_photo",
            "resume",
            "skills",
            "skill_ids",
            "education",
            "experience",
            "portfolio_link",
            "github_link",
            "github_username",
            "linkedin_link",
            "projects",
        )
        read_only_fields = ("verified_github_data",)

    def update(self, instance, validated_data):
        skill_ids = validated_data.pop("skill_ids", None)
        if skill_ids is not None:
            from jobs.models import Skill

            instance.skills.set(Skill.objects.filter(id__in=skill_ids))
        return super().update(instance, validated_data)
