from django.shortcuts import render, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.db.models import Count
from django.http import JsonResponse
from jobs.models import Skill
from .models import CareerPath, InterviewQuestion, SkillResource
from .services import SkillGapService, CareerPathService, InterviewPrepService
from students.models import StudentProfile
from accounts.decorators import student_required

# --- Career Path Views ---


@login_required
def career_path_list(request):
    """List all career paths."""
    paths = CareerPath.objects.filter(is_active=True).annotate(
        milestone_count=Count("milestones"), question_count=Count("questions")
    )
    context = {
        "paths": paths,
    }
    # If student, get personalized recommendations
    if request.user.is_student:
        profile = StudentProfile.objects.filter(user=request.user).first()
        if profile:
            context["recommended_paths"] = CareerPathService.get_path_for_student(
                profile
            )

    return render(request, "careers/path_list.html", context)


@login_required
def career_path_detail(request, path_id):
    """Show detailed view of a career path with milestones."""
    path_data = CareerPathService.get_path_detail(path_id)
    context = {
        "path": path_data["path"],
        "milestones": path_data["milestones"],
        "total_skills": path_data["total_skills"],
        "questions_count": path_data["questions_count"],
    }
    return render(request, "careers/path_detail.html", context)


# --- Interview Prep Views ---


@login_required
def interview_prep_hub(request):
    """Main interview preparation hub."""
    skills = (
        Skill.objects.annotate(question_count=Count("interview_questions"))
        .filter(question_count__gt=0)
        .order_by("name")
    )

    career_paths = CareerPath.objects.annotate(
        question_count=Count("questions")
    ).filter(question_count__gt=0, is_active=True)

    # Get recent questions
    recent_questions = InterviewQuestion.objects.select_related(
        "skill", "career_path"
    ).order_by("-created_at")[:5]

    context = {
        "skills": skills,
        "career_paths": career_paths,
        "recent_questions": recent_questions,
        "total_questions": InterviewQuestion.objects.count(),
    }
    return render(request, "careers/interview_prep.html", context)


@login_required
def interview_questions_by_skill(request, skill_id):
    """Show interview questions for a specific skill."""
    skill = get_object_or_404(Skill, id=skill_id)
    difficulty = request.GET.get("difficulty", "")
    questions = InterviewQuestion.objects.filter(skill=skill)
    if difficulty:
        questions = questions.filter(difficulty=difficulty)
    questions = questions.select_related("career_path")

    resources = SkillResource.objects.filter(skill=skill)[:5]

    context = {
        "skill": skill,
        "questions": questions,
        "resources": resources,
        "current_difficulty": difficulty,
        "difficulties": ["beginner", "intermediate", "advanced"],
    }
    return render(request, "careers/interview_questions.html", context)


@login_required
def interview_questions_by_path(request, path_id):
    """Show interview questions for a career path."""
    path = get_object_or_404(CareerPath, id=path_id)
    difficulty = request.GET.get("difficulty", "")
    questions = InterviewQuestion.objects.filter(career_path=path)
    if difficulty:
        questions = questions.filter(difficulty=difficulty)
    questions = questions.select_related("skill")

    context = {
        "path": path,
        "questions": questions,
        "current_difficulty": difficulty,
        "difficulties": ["beginner", "intermediate", "advanced"],
    }
    return render(request, "careers/interview_questions.html", context)


@login_required
def practice_questions(request):
    """Get a random practice set."""
    skill_ids = request.GET.getlist("skills")
    count = min(int(request.GET.get("count", 5)), 20)
    questions = InterviewPrepService.get_practice_set(
        skill_ids=[int(s) for s in skill_ids] if skill_ids else None, count=count
    )
    questions = questions.select_related("skill")

    context = {
        "questions": questions,
        "is_practice": True,
    }
    return render(request, "careers/practice_questions.html", context)


# --- Skill Gap Analysis Views ---


@student_required
def skill_gap_analysis(request):
    """Analyze skill gaps for the student."""
    profile = StudentProfile.objects.get_or_create(user=request.user)[0]
    analysis = SkillGapService.analyze_gaps(profile)

    context = {
        "profile": profile,
        "analysis": analysis,
    }
    return render(request, "careers/skill_gap.html", context)


@student_required
def skill_gap_detail(request, skill_name):
    """Show detailed learning path for a specific missing skill."""
    learning_path = SkillGapService.get_learning_path(skill_name)

    if not learning_path:
        return render(
            request,
            "careers/skill_detail.html",
            {
                "error": f'No resources found for "{skill_name}"',
                "skill_name": skill_name,
            },
        )

    context = {
        "learning_path": learning_path,
        "skill_name": skill_name,
    }
    return render(request, "careers/skill_detail.html", context)


# --- AJAX endpoint for quick match ---


@login_required
def get_skill_resources(request, skill_id):
    """AJAX endpoint to get resources for a skill."""
    resources = SkillResource.objects.filter(skill_id=skill_id).values(
        "title", "url", "resource_type", "difficulty", "is_free"
    )
    return JsonResponse({"resources": list(resources)})
