from django.urls import path
from . import views

urlpatterns = [
    # Career Paths
    path("paths/", views.career_path_list, name="career_path_list"),
    path("paths/<int:path_id>/", views.career_path_detail, name="career_path_detail"),
    # Interview Prep
    path("interview-prep/", views.interview_prep_hub, name="interview_prep_hub"),
    path(
        "interview-prep/skill/<int:skill_id>/",
        views.interview_questions_by_skill,
        name="interview_questions_by_skill",
    ),
    path(
        "interview-prep/path/<int:path_id>/",
        views.interview_questions_by_path,
        name="interview_questions_by_path",
    ),
    path(
        "interview-prep/practice/", views.practice_questions, name="practice_questions"
    ),
    # Skill Gap Analysis
    path("skill-gap/", views.skill_gap_analysis, name="skill_gap_analysis"),
    path(
        "skill-gap/<str:skill_name>/", views.skill_gap_detail, name="skill_gap_detail"
    ),
    # AJAX
    path(
        "api/resources/<int:skill_id>/",
        views.get_skill_resources,
        name="get_skill_resources",
    ),
]
