from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from datetime import datetime, timedelta
from calendar import monthrange
from django.utils import timezone

from .models import StudentProfile
from .serializers import StudentProfileSerializer
# DRF's get_object_or_404 is the same shortcut but also turns a pk that
# cannot be coerced to the field type (e.g. /courses/abc/) into a 404
# instead of letting the ValueError surface as a 500.
from rest_framework.generics import get_object_or_404
from applications.models import Application
from applications.serializers import ApplicationSerializer
from jobs.models import Job, SavedJob, Skill
from jobs.serializers import JobSerializer
from internships.serializers import InternshipListSerializer
from careers.services import JobMatchingService
from . import resume_parser


class IsStudent(permissions.BasePermission):
    """Allow access only to student users."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_student
        )


class StudentProfileViewSet(viewsets.GenericViewSet):
    serializer_class = StudentProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get_object(self):
        profile, _ = StudentProfile.objects.get_or_create(user=self.request.user)
        return profile

    @action(detail=False, methods=["get", "patch"])
    def me(self, request):
        """Get or update the current student's profile."""
        profile = self.get_object()
        if request.method == "GET":
            serializer = self.get_serializer(profile)
            return Response(serializer.data)
        elif request.method == "PATCH":
            serializer = self.get_serializer(profile, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        """Get student dashboard data."""
        profile = self.get_object()
        applications = Application.objects.filter(student=request.user).order_by(
            "-applied_at"
        )

        pending_count = applications.filter(status="Applied").count()
        shortlisted_count = applications.filter(status="Shortlisted").count()
        rejected_count = applications.filter(status="Rejected").count()
        accepted_count = applications.filter(status="Accepted").count()

        # Monthly activity data (last 12 months)
        now = timezone.now()
        monthly_data = []
        for i in range(11, -1, -1):
            m = now.month - i
            yr = now.year
            if m <= 0:
                m += 12
                yr -= 1
            _, days_in_month = monthrange(yr, m)
            month_start = timezone.make_aware(datetime(yr, m, 1))
            month_end = month_start + timedelta(days=days_in_month)
            count = applications.filter(
                applied_at__gte=month_start, applied_at__lt=month_end
            ).count()
            monthly_data.append({"month": month_start.strftime("%b"), "count": count})

        # Recommended jobs/internships
        recommended_jobs = JobMatchingService.get_recommended_jobs(profile, limit=6)
        recommended_internships = JobMatchingService.get_recommended_internships(
            profile, limit=4
        )
        recommended_jobs_data = []
        for item in recommended_jobs:
            data = JobSerializer(item["job"]).data
            data["match_score"] = item["score"]
            recommended_jobs_data.append(data)

        recommended_internships_data = []
        for item in recommended_internships:
            data = InternshipListSerializer(item["internship"]).data
            data["match_score"] = item["score"]
            recommended_internships_data.append(data)

        return Response(
            {
                "profile": StudentProfileSerializer(profile).data,
                "applications": ApplicationSerializer(applications[:5], many=True).data,
                "applications_count": applications.count(),
                "pending_count": pending_count,
                "shortlisted_count": shortlisted_count,
                "rejected_count": rejected_count,
                "accepted_count": accepted_count,
                "monthly_activity": monthly_data,
                "recommended_jobs": recommended_jobs_data,
                "recommended_internships": recommended_internships_data,
            }
        )

    @action(detail=False, methods=["get"])
    def applications(self, request):
        """Get all applications for the current student."""
        applications = Application.objects.filter(student=request.user).order_by(
            "-applied_at"
        )
        page = self.paginate_queryset(applications)
        if page is not None:
            serializer = ApplicationSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = ApplicationSerializer(applications, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def saved_jobs(self, request):
        """Get saved jobs for the current student."""
        saved = (
            SavedJob.objects.filter(user=request.user)
            .select_related("job")
            .order_by("-saved_at")
        )
        jobs = [s.job for s in saved]
        serializer = JobSerializer(jobs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def save_job(self, request):
        """Save a job for the current student."""
        job_id = request.data.get("job_id")
        if not job_id:
            return Response(
                {"error": "job_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        # Validate the job exists (and is open) so a bogus job_id returns a
        # clean 404 instead of a 500 from the FK constraint on SavedJob.
        job = get_object_or_404(Job, id=job_id, is_active=True)
        SavedJob.objects.get_or_create(user=request.user, job=job)
        return Response({"message": "Job saved successfully"})

    @action(detail=False, methods=["post"])
    def unsave_job(self, request):
        """Remove a saved job."""
        job_id = request.data.get("job_id")
        if not job_id:
            return Response(
                {"error": "job_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        SavedJob.objects.filter(user=request.user, job_id=job_id).delete()
        return Response({"message": "Job unsaved"})

    # ------------------------------------------------------------------
    # Resume intelligence
    # ------------------------------------------------------------------

    MAX_RESUME_BYTES = 5 * 1024 * 1024

    @action(
        detail=False,
        methods=["post"],
        parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def parse_resume(self, request):
        """Extract skills and experience signals from a resume.

        Accepts a ``resume`` file upload, or falls back to the resume already
        stored on the profile so a student can re-analyse without re-uploading.

        This endpoint is deliberately READ-ONLY: it returns what it found and
        which items are new, and the client confirms before anything is written
        (see ``apply_parsed_skills``). Silently rewriting someone's skill list
        from a keyword match would be the wrong default.
        """
        profile = self.get_object()
        uploaded = request.FILES.get("resume")

        if uploaded is not None:
            if uploaded.size > self.MAX_RESUME_BYTES:
                return Response(
                    {"error": "Resume must be smaller than 5 MB."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            data = uploaded.read()
            filename = uploaded.name
        elif profile.resume:
            try:
                profile.resume.open("rb")
                data = profile.resume.read()
            except (FileNotFoundError, OSError):
                return Response(
                    {"error": "Your stored resume file is missing. Upload it again."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            finally:
                try:
                    profile.resume.close()
                except Exception:
                    pass
            filename = profile.resume.name
        else:
            return Response(
                {"error": "No resume provided. Upload a file or add one to your profile."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        catalogue = list(Skill.objects.values_list("id", "name"))
        try:
            result = resume_parser.parse(data, filename, catalogue)
        except resume_parser.ResumeTextExtractionError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        existing_ids = set(profile.skills.values_list("id", flat=True))
        for skill in result["skills"]:
            skill["already_on_profile"] = skill["id"] in existing_ids

        new_skills = [s for s in result["skills"] if not s["already_on_profile"]]

        return Response(
            {
                **result,
                "new_skills_count": len(new_skills),
                "filename": filename.rsplit("/", 1)[-1],
            }
        )

    @action(detail=False, methods=["post"])
    def apply_parsed_skills(self, request):
        """Add confirmed skills from a parse to the student's profile.

        Only ids that exist in the catalogue are accepted; unknown ids are
        reported back rather than silently dropped.
        """
        raw_ids = request.data.get("skill_ids")
        if not isinstance(raw_ids, list) or not raw_ids:
            return Response(
                {"error": "skill_ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            wanted = {int(i) for i in raw_ids}
        except (TypeError, ValueError):
            return Response(
                {"error": "skill_ids must be integers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        skills = list(Skill.objects.filter(id__in=wanted))
        found_ids = {s.id for s in skills}
        if not skills:
            return Response(
                {"error": "None of those skills exist."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        profile = self.get_object()
        before = set(profile.skills.values_list("id", flat=True))
        profile.skills.add(*skills)
        added = [s.name for s in skills if s.id not in before]

        return Response(
            {
                "added": added,
                "added_count": len(added),
                "skipped_unknown": sorted(wanted - found_ids),
                "skills": list(profile.skills.values("id", "name").order_by("name")),
            }
        )
