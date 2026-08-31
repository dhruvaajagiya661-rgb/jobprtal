from rest_framework import viewsets, permissions, status

from portal.serializers import EmptySerializer
from rest_framework.decorators import action
from rest_framework.response import Response
from portal.query_utils import parse_id
from django.db.models import Count
# DRF's get_object_or_404 is the same shortcut but also turns a pk that
# cannot be coerced to the field type (e.g. /courses/abc/) into a 404
# instead of letting the ValueError surface as a 500.
from rest_framework.generics import get_object_or_404

from .models import (
    CareerPath,
    InterviewQuestion,
    SkillResource,
    QuestionBookmark,
    QuestionAttempt,
    SkillLearningStatus,
)
from .serializers import (
    CareerPathSerializer,
    CareerPathDetailSerializer,
    InterviewQuestionSerializer,
    SkillResourceSerializer,
    QuestionBookmarkSerializer,
    QuestionAttemptSerializer,
    SkillLearningStatusSerializer,
)
from .services import (
    SkillGapService,
    CareerPathService,
    InterviewPrepService,
    ProgressService,
)
from jobs.models import Skill
from students.models import StudentProfile


def _safe_count(raw, default):
    """Parse a count query param, clamped to [1, 20], without crashing on junk."""
    try:
        return min(max(int(raw), 1), 20)
    except (TypeError, ValueError):
        return default


class CareerPathViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]

    def get_permissions(self):
        if self.action == "recommended":
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CareerPathDetailSerializer
        return CareerPathSerializer

    def get_queryset(self):
        return CareerPath.objects.filter(is_active=True).annotate(
            milestone_count=Count("milestones"), question_count=Count("questions")
        )

    @action(detail=False, methods=["get"])
    def recommended(self, request):
        """Get recommended career paths for the current student."""
        if not request.user.is_student:
            return Response({"error": "Only for students"}, status=403)

        profile = StudentProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response([])

        recommended_paths = CareerPathService.get_path_for_student(profile)
        # recommended_paths is list of {'path': CareerPath, 'match_score': float}
        result = [
            {
                "name": item["path"].name,
                "match_percentage": round(item["match_score"]),
            }
            for item in recommended_paths
        ]
        return Response(result)


class InterviewPrepViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.AllowAny]
    # Ad-hoc dict responses; named empty serializer keeps these actions in the OpenAPI schema.
    serializer_class = EmptySerializer

    def get_permissions(self):
        """Personal actions (progress, bookmarks, attempts) need auth."""
        if self.action in ("progress", "record_attempt", "bookmark", "bookmarks"):
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    @action(detail=False, methods=["get"])
    def hub(self, request):
        """Get interview prep hub data."""
        skills = (
            Skill.objects.annotate(question_count=Count("interview_questions"))
            .filter(question_count__gt=0)
            .order_by("name")
        )

        career_paths = CareerPath.objects.annotate(
            question_count=Count("questions")
        ).filter(question_count__gt=0, is_active=True)

        recent_questions = InterviewQuestion.objects.select_related(
            "skill", "career_path"
        ).order_by("-created_at")[:5]

        return Response(
            {
                "skills": [
                    {"id": s.id, "name": s.name, "question_count": s.question_count}
                    for s in skills
                ],
                "career_paths": CareerPathSerializer(career_paths, many=True).data,
                "recent_questions": InterviewQuestionSerializer(
                    recent_questions, many=True
                ).data,
                "total_questions": InterviewQuestion.objects.count(),
            }
        )

    @action(detail=False, methods=["get"])
    def by_skill(self, request):
        """Get interview questions by skill."""
        skill_id = request.query_params.get("skill_id")
        difficulty = request.query_params.get("difficulty", "")

        if not skill_id:
            return Response({"error": "skill_id is required"}, status=400)
        if parse_id(skill_id) is None:
            return Response({"error": "skill_id must be a number"}, status=400)

        skill = get_object_or_404(Skill, id=skill_id)
        questions = InterviewQuestion.objects.filter(skill=skill)
        if difficulty:
            questions = questions.filter(difficulty=difficulty)
        questions = questions.select_related("career_path")

        resources = SkillResource.objects.filter(skill=skill)[:5]

        return Response(
            {
                "skill": {"id": skill.id, "name": skill.name},
                "questions": InterviewQuestionSerializer(questions, many=True).data,
                "resources": SkillResourceSerializer(resources, many=True).data,
            }
        )

    @action(detail=False, methods=["get"])
    def by_path(self, request):
        """Get interview questions by career path."""
        path_id = request.query_params.get("path_id")
        difficulty = request.query_params.get("difficulty", "")

        if not path_id:
            return Response({"error": "path_id is required"}, status=400)
        if parse_id(path_id) is None:
            return Response({"error": "path_id must be a number"}, status=400)

        path = get_object_or_404(CareerPath, id=path_id)
        questions = InterviewQuestion.objects.filter(career_path=path)
        if difficulty:
            questions = questions.filter(difficulty=difficulty)
        questions = questions.select_related("skill")

        return Response(
            {
                "path": CareerPathSerializer(path).data,
                "questions": InterviewQuestionSerializer(questions, many=True).data,
            }
        )

    @action(detail=False, methods=["get"])
    def practice(self, request):
        """Get a random practice set."""
        skill_ids = request.query_params.getlist("skill_ids")
        count = _safe_count(request.query_params.get("count", 5), 5)

        questions = InterviewPrepService.get_practice_set(
            skill_ids=[int(s) for s in skill_ids] if skill_ids else None, count=count
        )
        questions = questions.select_related("skill")

        return Response(
            {
                "questions": InterviewQuestionSerializer(questions, many=True).data,
                "is_practice": True,
            }
        )

    @action(detail=False, methods=["get"])
    def quiz(self, request):
        """Get a timed quiz set for the given skills."""
        skill_ids = request.query_params.getlist("skill_ids")
        count = _safe_count(request.query_params.get("count", 5), 5)
        difficulty = request.query_params.get("difficulty", "")
        questions = InterviewPrepService.get_practice_set(
            skill_ids=[int(s) for s in skill_ids] if skill_ids else None,
            count=count,
            difficulty=difficulty or None,
        )
        questions = questions.select_related("skill")

        return Response(
            {
                "questions": InterviewQuestionSerializer(questions, many=True).data,
                "time_per_question": 60,  # seconds
            }
        )

    @action(detail=False, methods=["get"])
    def mock(self, request):
        """Get a mock-interview set (one question at a time, timed)."""
        skill_ids = request.query_params.getlist("skill_ids")
        count = _safe_count(request.query_params.get("count", 8), 8)
        questions = InterviewPrepService.get_practice_set(
            skill_ids=[int(s) for s in skill_ids] if skill_ids else None,
            count=count,
        )
        questions = questions.select_related("skill")

        return Response(
            {
                "questions": InterviewQuestionSerializer(questions, many=True).data,
                "time_per_question": 45,  # seconds
                "is_mock": True,
            }
        )

    @action(detail=False, methods=["get"])
    def search(self, request):
        """Search interview questions by keyword."""
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"questions": []})
        questions = InterviewPrepService.search_questions(q)
        return Response(
            {"questions": InterviewQuestionSerializer(questions, many=True).data}
        )

    @action(detail=False, methods=["post"])
    def record_attempt(self, request):
        """Record a quiz/practice answer for progress tracking."""
        question_id = request.data.get("question_id")
        raw_correct = request.data.get("correct", False)
        # Accept real booleans and common string forms, so a form-encoded
        # "false" is never truthy.
        correct = raw_correct in (True, "true", "True", 1, "1")
        mode = request.data.get("mode", "practice")
        if not question_id:
            return Response({"error": "question_id is required"}, status=400)
        question = get_object_or_404(InterviewQuestion, id=question_id)
        QuestionAttempt.objects.create(
            student=request.user, question=question, correct=correct, mode=mode
        )
        stats = ProgressService.get_stats(request.user)
        stats["recent_attempts"] = QuestionAttemptSerializer(
            stats["recent_attempts"], many=True
        ).data
        return Response(stats)

    @action(detail=False, methods=["get"])
    def progress(self, request):
        """Get the student's practice progress stats."""
        stats = ProgressService.get_stats(request.user)
        stats["recent_attempts"] = QuestionAttemptSerializer(
            stats["recent_attempts"], many=True
        ).data
        return Response(stats)

    @action(detail=False, methods=["post"])
    def bookmark(self, request):
        """Toggle a bookmark on a question."""
        question_id = request.data.get("question_id")
        if not question_id:
            return Response({"error": "question_id is required"}, status=400)
        question = get_object_or_404(InterviewQuestion, id=question_id)
        bookmark, created = QuestionBookmark.objects.get_or_create(
            student=request.user, question=question
        )
        if not created:
            bookmark.delete()
        return Response({"bookmarked": created})

    @action(detail=False, methods=["get"])
    def bookmarks(self, request):
        """List the student's bookmarked questions."""
        bookmarks = QuestionBookmark.objects.filter(
            student=request.user
        ).select_related("question", "question__skill")
        return Response(
            {"bookmarks": QuestionBookmarkSerializer(bookmarks, many=True).data}
        )


class SkillGapViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    # Ad-hoc dict responses; named empty serializer keeps these actions in the OpenAPI schema.
    serializer_class = EmptySerializer

    @action(detail=False, methods=["get"])
    def analyze(self, request):
        """Analyze skill gaps for the current student."""
        if not request.user.is_student:
            return Response({"error": "Only for students"}, status=403)

        profile = StudentProfile.objects.get_or_create(user=request.user)[0]
        analysis = SkillGapService.analyze_gaps(profile)

        # Get student skills as string list
        student_skills = list(profile.skills.values_list("name", flat=True))

        # Learning statuses for recommended skills
        statuses = {
            s.skill.name: s.status
            for s in SkillLearningStatus.objects.filter(student=request.user)
        }

        # Transform missing_skills dict into recommended_skills array
        recommended_skills = []
        for skill_name, gap_data in analysis.get("missing_skills", {}).items():
            recommended_skills.append(
                {
                    "skill_name": skill_name,
                    "relevance": gap_data.get("demand_percentage", 0),
                    "jobs_demanding": gap_data.get("demand_count", 0),
                    "description": f"This skill is required or preferred in {gap_data.get('demand_count', 0)} job listings ({gap_data.get('demand_percentage', 0)}% of all jobs).",
                    "resources": gap_data.get("resources", []),
                    "status": statuses.get(skill_name, "not_started"),
                }
            )

        # Sort by relevance descending
        recommended_skills.sort(key=lambda x: x["relevance"], reverse=True)

        # Get career recommendations
        recommended_paths = CareerPathService.get_path_for_student(profile)
        career_recommendations = [
            {
                "name": item["path"].name,
                "match_percentage": round(item["match_score"]),
            }
            for item in recommended_paths
        ]

        # Per-job gap breakdown
        job_breakdown = SkillGapService.get_job_breakdown(profile)

        return Response(
            {
                "student_skills": student_skills,
                "recommended_skills": recommended_skills,
                "career_recommendations": career_recommendations,
                "job_breakdown": job_breakdown,
            }
        )

    @action(detail=False, methods=["get"])
    def roadmap(self, request):
        """Priority-ranked learning roadmap for the student's gaps."""
        if not request.user.is_student:
            return Response({"error": "Only for students"}, status=403)
        profile = StudentProfile.objects.get_or_create(user=request.user)[0]
        roadmap = SkillGapService.get_priority_roadmap(profile)
        return Response({"roadmap": roadmap})

    @action(detail=False, methods=["post"])
    def set_status(self, request):
        """Update the student's learning status for a skill."""
        if not request.user.is_student:
            return Response({"error": "Only for students"}, status=403)
        skill_name = request.data.get("skill_name", "").strip()
        new_status = request.data.get("status", "")
        valid = {c[0] for c in SkillLearningStatus.STATUS_CHOICES}
        if new_status not in valid:
            return Response({"error": "Invalid status"}, status=400)
        skill = Skill.objects.filter(name__iexact=skill_name).first()
        if not skill:
            return Response({"error": "Unknown skill"}, status=404)

        obj, _ = SkillLearningStatus.objects.update_or_create(
            student=request.user,
            skill=skill,
            defaults={"status": new_status},
        )

        # Marking a skill as learned also adds it to the student's profile
        # so future analyses treat it as an owned skill.
        if new_status == "learned":
            profile = StudentProfile.objects.get_or_create(user=request.user)[0]
            profile.skills.add(skill)

        return Response(SkillLearningStatusSerializer(obj).data)

    @action(detail=False, methods=["post"])
    def remove_status(self, request):
        """Delete a skill's learning status (reset to not started)."""
        skill_name = request.data.get("skill_name", "").strip()
        skill = Skill.objects.filter(name__iexact=skill_name).first()
        if skill:
            SkillLearningStatus.objects.filter(
                student=request.user, skill=skill
            ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def learning_path(self, request):
        """Get learning path for a specific skill."""
        skill_name = request.query_params.get("skill_name")
        if not skill_name:
            return Response({"error": "skill_name is required"}, status=400)

        learning_path = SkillGapService.get_learning_path(skill_name)
        if not learning_path:
            return Response(
                {"error": f'No resources found for "{skill_name}"'}, status=404
            )

        # Convert querysets to serializable resources array
        resources = []
        for difficulty in ["beginner", "intermediate", "advanced"]:
            for res in learning_path.get(difficulty, []):
                resources.append(
                    {
                        "title": res.title,
                        "url": res.url,
                        "resource_type": res.resource_type,
                        "difficulty": res.difficulty,
                        "is_free": res.is_free,
                    }
                )

        return Response({"resources": resources})

    @action(detail=False, methods=["get"])
    def resources(self, request):
        """Get resources for a specific skill."""
        skill_id = request.query_params.get("skill_id")
        if not skill_id:
            return Response({"error": "skill_id is required"}, status=400)
        if parse_id(skill_id) is None:
            return Response({"error": "skill_id must be a number"}, status=400)

        resources = SkillResource.objects.filter(skill_id=skill_id).values(
            "title", "url", "resource_type", "difficulty", "is_free"
        )
        return Response({"resources": list(resources)})
