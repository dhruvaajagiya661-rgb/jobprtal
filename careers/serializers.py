from rest_framework import serializers
from .models import (
    CareerPath,
    CareerPathMilestone,
    InterviewQuestion,
    SkillResource,
    QuestionBookmark,
    QuestionAttempt,
    SkillLearningStatus,
)
from jobs.serializers import SkillSerializer


class CareerPathMilestoneSerializer(serializers.ModelSerializer):
    skills_required = SkillSerializer(many=True, read_only=True)

    class Meta:
        model = CareerPathMilestone
        fields = (
            "id",
            "title",
            "level",
            "description",
            "order",
            "skills_required",
            "experience_years",
            "salary_range",
        )


class CareerPathSerializer(serializers.ModelSerializer):
    milestone_count = serializers.SerializerMethodField()
    question_count = serializers.SerializerMethodField()

    class Meta:
        model = CareerPath
        fields = (
            "id",
            "name",
            "description",
            "icon",
            "color",
            "avg_salary_min",
            "avg_salary_max",
            "growth_outlook",
            "milestone_count",
            "question_count",
        )

    def get_milestone_count(self, obj) -> int:
        return obj.milestones.count()

    def get_question_count(self, obj) -> int:
        return obj.questions.count()


class CareerPathDetailSerializer(serializers.ModelSerializer):
    milestones = CareerPathMilestoneSerializer(many=True, read_only=True)

    class Meta:
        model = CareerPath
        fields = (
            "id",
            "name",
            "description",
            "icon",
            "color",
            "avg_salary_min",
            "avg_salary_max",
            "growth_outlook",
            "milestones",
        )


class InterviewQuestionSerializer(serializers.ModelSerializer):
    skill = SkillSerializer(read_only=True)
    career_path_name = serializers.SerializerMethodField()

    class Meta:
        model = InterviewQuestion
        fields = (
            "id",
            "skill",
            "question",
            "answer",
            "difficulty",
            "career_path",
            "career_path_name",
            "is_behavioral",
            "created_at",
        )

    def get_career_path_name(self, obj):
        return obj.career_path.name if obj.career_path else None


class SkillResourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillResource
        fields = (
            "id",
            "title",
            "url",
            "resource_type",
            "description",
            "difficulty",
            "is_free",
        )


class QuestionAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAttempt
        fields = ("id", "question", "correct", "mode", "answered_at")


class QuestionBookmarkSerializer(serializers.ModelSerializer):
    question = InterviewQuestionSerializer(read_only=True)

    class Meta:
        model = QuestionBookmark
        fields = ("id", "question", "created_at")


class SkillLearningStatusSerializer(serializers.ModelSerializer):
    skill_name = serializers.CharField(source="skill.name", read_only=True)

    class Meta:
        model = SkillLearningStatus
        fields = ("id", "skill", "skill_name", "status", "updated_at")
