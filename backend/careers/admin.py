from django.contrib import admin
from .models import (
    CareerPath,
    CareerPathMilestone,
    InterviewQuestion,
    SkillResource,
    QuestionBookmark,
    QuestionAttempt,
    SkillLearningStatus,
)


@admin.register(CareerPath)
class CareerPathAdmin(admin.ModelAdmin):
    list_display = ["name", "avg_salary_min", "avg_salary_max", "is_active"]
    list_filter = ["is_active"]


@admin.register(CareerPathMilestone)
class CareerPathMilestoneAdmin(admin.ModelAdmin):
    list_display = ["title", "career_path", "level", "order"]
    list_filter = ["level", "career_path"]


@admin.register(InterviewQuestion)
class InterviewQuestionAdmin(admin.ModelAdmin):
    list_display = ["skill", "difficulty", "is_behavioral", "created_at"]
    list_filter = ["difficulty", "skill", "is_behavioral"]
    search_fields = ["question", "answer"]


@admin.register(SkillResource)
class SkillResourceAdmin(admin.ModelAdmin):
    list_display = ["title", "skill", "resource_type", "difficulty", "is_free"]
    list_filter = ["resource_type", "difficulty", "is_free"]
    search_fields = ["title", "description"]


@admin.register(QuestionBookmark)
class QuestionBookmarkAdmin(admin.ModelAdmin):
    list_display = ["student", "question", "created_at"]
    search_fields = ["student__email", "question__question"]


@admin.register(QuestionAttempt)
class QuestionAttemptAdmin(admin.ModelAdmin):
    list_display = ["student", "question", "correct", "mode", "answered_at"]
    list_filter = ["correct", "mode"]
    search_fields = ["student__email"]


@admin.register(SkillLearningStatus)
class SkillLearningStatusAdmin(admin.ModelAdmin):
    list_display = ["student", "skill", "status", "updated_at"]
    list_filter = ["status"]
    search_fields = ["student__email", "skill__name"]
