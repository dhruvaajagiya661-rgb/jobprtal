from rest_framework import serializers
from .models import Application
from jobs.serializers import JobSerializer
from internships.serializers import InternshipListSerializer
from portal.validators import validate_resume_file


class ApplicationSerializer(serializers.ModelSerializer):
    job = JobSerializer(read_only=True)
    internship = InternshipListSerializer(read_only=True)
    student_name = serializers.SerializerMethodField()
    student_email = serializers.SerializerMethodField()
    student_skills = serializers.SerializerMethodField()

    class Meta:
        model = Application
        fields = (
            "id",
            "job",
            "internship",
            "student",
            "student_name",
            "student_email",
            "student_skills",
            "resume",
            "status",
            "applied_at",
            "updated_at",
        )
        read_only_fields = ("student", "status", "applied_at", "updated_at")

    def get_student_name(self, obj) -> str:
        return obj.student.get_full_name() or obj.student.username

    def get_student_email(self, obj) -> str:
        return obj.student.email

    def get_student_skills(self, obj) -> list[str]:
        profile = getattr(obj.student, "student_profile", None)
        if profile is None:
            return []
        return list(profile.skills.order_by("name").values_list("name", flat=True))


class ApplicationCreateSerializer(serializers.Serializer):
    job_id = serializers.IntegerField(required=False)
    internship_id = serializers.IntegerField(required=False)
    # Plain Serializer, not a ModelSerializer, so the validator on
    # Application.resume is never applied automatically -- wire it in by hand
    # or an .exe/.html upload sails straight through to MEDIA_ROOT.
    resume = serializers.FileField(required=True, validators=[validate_resume_file])

    def validate(self, data):
        if not data.get("job_id") and not data.get("internship_id"):
            raise serializers.ValidationError(
                "Either job_id or internship_id is required"
            )
        if data.get("job_id") and data.get("internship_id"):
            raise serializers.ValidationError(
                "Provide either job_id or internship_id, not both"
            )
        return data


class ApplicationStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = ("status",)
