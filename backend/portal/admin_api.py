"""
Admin-only JSON API for the unique admin dashboard page in the React SPA.

Exposes every record (students, recruiters, jobs, internships, applications,
companies, career content) plus stats and the admin's recent notifications
as JSON, so the frontend /admin/dashboard page can render a single page that
is distinct from the student/recruiter dashboards and from Django admin.
"""

from collections import Counter
from datetime import datetime, timedelta
from calendar import monthrange
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from portal.serializers import EmptySerializer

from accounts.models import CustomUser
from applications.models import Application
from careers.models import (
    CareerPath,
    CareerPathMilestone,
    InterviewQuestion,
    SkillResource,
)
from internships.models import Internship
from jobs.models import Job
from notifications.models import Notification
from recruiters.models import Company, RecruiterProfile
from students.models import StudentProfile


def _student_to_dict(s):
    return {
        "id": s.pk,
        "name": s.user.get_full_name() or s.user.username,
        "email": s.user.email,
        "username": s.user.username,
        "active": s.user.is_active,
        "skills": [skill.name for skill in s.skills.all()[:5]],
        "education": s.education,
        "experience": s.experience,
        "resume": s.resume.url if s.resume else None,
        "portfolio_link": s.portfolio_link,
        "github_username": s.github_username,
        "joined": s.user.date_joined.strftime("%Y-%m-%d") if s.user.date_joined else None,
    }


def _recruiter_to_dict(r):
    company = r.company
    return {
        "id": r.pk,
        "name": r.user.get_full_name() or r.user.username,
        "email": r.user.email,
        "active": r.user.is_active,
        "company": company.name if company else None,
        "industry": company.industry if company else None,
        "size": company.size if company else None,
        "location": company.location if company else None,
        "designation": r.designation,
        "joined": r.user.date_joined.strftime("%Y-%m-%d") if r.user.date_joined else None,
    }


def _job_to_dict(j):
    return {
        "id": j.pk,
        "title": j.title,
        "company": j.company.name,
        "location": j.location,
        "job_type": j.job_type,
        "salary": j.salary,
        "experience_required": j.experience_required,
        "deadline": j.deadline.strftime("%Y-%m-%d") if j.deadline else None,
        "applications_count": j.applications_count,
        "is_active": j.is_active,
    }


def _internship_to_dict(i):
    return {
        "id": i.pk,
        "title": i.title,
        "company": i.company.name,
        "location": i.location,
        "internship_type": i.internship_type,
        "stipend": i.stipend,
        "duration": i.duration,
        "deadline": i.deadline.strftime("%Y-%m-%d") if i.deadline else None,
        "applications_count": i.applications_count,
        "is_active": i.is_active,
    }


def _application_to_dict(a):
    return {
        "id": a.pk,
        "student": a.student.get_full_name() or a.student.username,
        "student_email": a.student.email,
        "position": a.job.title if a.job else (a.internship.title if a.internship else None),
        "type": "Job" if a.job else "Internship",
        "status": a.status,
        "applied_at": a.applied_at.strftime("%Y-%m-%d") if a.applied_at else None,
        "resume": a.resume.url if a.resume else None,
    }


def _company_to_dict(c):
    return {
        "id": c.pk,
        "name": c.name,
        "industry": c.industry,
        "size": c.size,
        "location": c.location,
        "website": c.website,
        "recruiter_count": c.recruiter_count,
    }


def _career_path_to_dict(p):
    return {
        "id": p.pk,
        "name": p.name,
        "description": p.description,
        "avg_salary_min": p.avg_salary_min,
        "avg_salary_max": p.avg_salary_max,
        "growth_outlook": p.growth_outlook,
        "milestones_count": p.milestones_count,
        "is_active": p.is_active,
    }


def _milestone_to_dict(m):
    return {
        "id": m.pk,
        "title": m.title,
        "career_path": m.career_path.name,
        "level": m.get_level_display(),
        "experience_years": m.experience_years,
        "salary_range": m.salary_range,
        "skills": [skill.name for skill in m.skills_required.all()[:3]],
    }


def _question_to_dict(q):
    return {
        "id": q.pk,
        "question": q.question,
        "skill": q.skill.name,
        "career_path": q.career_path.name if q.career_path else None,
        "difficulty": q.get_difficulty_display(),
        "is_behavioral": q.is_behavioral,
        "created_at": q.created_at.strftime("%Y-%m-%d") if q.created_at else None,
    }


def _resource_to_dict(r):
    return {
        "id": r.pk,
        "title": r.title,
        "url": r.url,
        "skill": r.skill.name,
        "resource_type": r.get_resource_type_display(),
        "difficulty": r.get_difficulty_display(),
        "is_free": r.is_free,
        "description": r.description,
        "created_at": r.created_at.strftime("%Y-%m-%d") if r.created_at else None,
    }


def _notification_to_dict(n):
    return {
        "id": n.pk,
        "title": n.title,
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at.strftime("%Y-%m-%d %H:%M") if n.created_at else None,
    }


# Shared record-type map for the admin delete/update views.
_ADMIN_MODELS = {
    "student": StudentProfile,
    "recruiter": RecruiterProfile,
    "job": Job,
    "internship": Internship,
    "application": Application,
    "company": Company,
    "career_path": CareerPath,
    "milestone": CareerPathMilestone,
    "question": InterviewQuestion,
    "resource": SkillResource,
}


class AdminDashboardAPIView(APIView):
    # Ad-hoc dict responses; named empty serializer keeps schema generation clean.
    serializer_class = EmptySerializer
    """Full platform overview for superusers. Admin-only."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        query = request.query_params.get("q", "").strip()

        students = StudentProfile.objects.select_related("user").prefetch_related("skills")
        recruiters = RecruiterProfile.objects.select_related("user", "company")
        jobs = Job.objects.select_related("company").annotate(
            applications_count=Count("applications", distinct=True)
        )
        internships = Internship.objects.select_related("company").annotate(
            applications_count=Count("applications", distinct=True)
        )
        applications = Application.objects.select_related("student", "job", "internship")
        companies = Company.objects.annotate(
            recruiter_count=Count("recruiterprofile", distinct=True)
        )
        career_paths = CareerPath.objects.annotate(
            milestones_count=Count("milestones", distinct=True)
        )
        milestones = CareerPathMilestone.objects.select_related("career_path")
        interview_questions = InterviewQuestion.objects.select_related("skill", "career_path")
        learning_resources = SkillResource.objects.select_related("skill")

        if query:
            students = students.filter(
                Q(user__email__icontains=query)
                | Q(user__username__icontains=query)
                | Q(user__first_name__icontains=query)
                | Q(user__last_name__icontains=query)
                | Q(skills__name__icontains=query)
                | Q(education__icontains=query)
            ).distinct()
            recruiters = recruiters.filter(
                Q(user__email__icontains=query)
                | Q(user__username__icontains=query)
                | Q(company__name__icontains=query)
                | Q(designation__icontains=query)
            )
            jobs = jobs.filter(
                Q(title__icontains=query)
                | Q(company__name__icontains=query)
                | Q(location__icontains=query)
                | Q(job_type__icontains=query)
            )
            internships = internships.filter(
                Q(title__icontains=query)
                | Q(company__name__icontains=query)
                | Q(location__icontains=query)
                | Q(internship_type__icontains=query)
            )
            applications = applications.filter(
                Q(student__email__icontains=query)
                | Q(student__username__icontains=query)
                | Q(job__title__icontains=query)
                | Q(internship__title__icontains=query)
                | Q(status__icontains=query)
            )
            companies = companies.filter(
                Q(name__icontains=query)
                | Q(industry__icontains=query)
                | Q(location__icontains=query)
            )
            career_paths = career_paths.filter(
                Q(name__icontains=query) | Q(description__icontains=query)
            )
            milestones = milestones.filter(
                Q(title__icontains=query) | Q(career_path__name__icontains=query)
            )
            interview_questions = interview_questions.filter(
                Q(question__icontains=query) | Q(skill__name__icontains=query)
            )
            learning_resources = learning_resources.filter(
                Q(title__icontains=query) | Q(skill__name__icontains=query)
            )

        notifications = Notification.objects.filter(user=request.user).order_by("-created_at")

        # ── Platform analytics (global, independent of the search query) ──
        now = timezone.now()
        monthly_applications = []
        for i in range(5, -1, -1):
            m = now.month - i
            yr = now.year
            if m <= 0:
                m += 12
                yr -= 1
            month_start = timezone.make_aware(datetime(yr, m, 1))
            month_end = month_start + timedelta(days=monthrange(yr, m)[1])
            monthly_applications.append(
                {
                    "month": month_start.strftime("%b"),
                    "count": Application.objects.filter(
                        applied_at__gte=month_start, applied_at__lt=month_end
                    ).count(),
                }
            )

        company_counter = Counter(
            j.company.name for j in Job.objects.select_related("company")
        )
        skill_counter = Counter(
            s.name
            for j in Job.objects.prefetch_related("skills_required")
            for s in j.skills_required.all()
        )
        total_jobs = Job.objects.count()
        total_internships = Internship.objects.count()
        active_jobs = Job.objects.filter(is_active=True).count()
        active_internships = Internship.objects.filter(is_active=True).count()

        analytics = {
            "application_status": {
                status: Application.objects.filter(status=status).count()
                for status in ["Applied", "Shortlisted", "Rejected", "Accepted"]
            },
            "monthly_applications": monthly_applications,
            "jobs_per_company": [
                {"company": name, "count": count}
                for name, count in company_counter.most_common(8)
            ],
            "top_skills": [
                {"name": name, "count": count}
                for name, count in skill_counter.most_common(8)
            ],
            "active_jobs": active_jobs,
            "closed_jobs": total_jobs - active_jobs,
            "active_internships": active_internships,
            "closed_internships": total_internships - active_internships,
            "active_students": StudentProfile.objects.filter(
                user__is_active=True
            ).count(),
            "active_recruiters": RecruiterProfile.objects.filter(
                user__is_active=True
            ).count(),
            "recent_applications": [
                _application_to_dict(a)
                for a in Application.objects.select_related(
                    "student", "job", "internship"
                ).order_by("-applied_at")[:5]
            ],
        }

        data = {
            "analytics": analytics,
            "query": query,
            "stats": {
                "total_users": CustomUser.objects.count(),
                "total_students": StudentProfile.objects.count(),
                "total_recruiters": RecruiterProfile.objects.count(),
                "total_companies": Company.objects.count(),
                "total_jobs": Job.objects.count(),
                "total_internships": Internship.objects.count(),
                "total_applications": Application.objects.count(),
                "total_career_paths": CareerPath.objects.count(),
                "total_milestones": CareerPathMilestone.objects.count(),
                "total_interview_questions": InterviewQuestion.objects.count(),
                "total_resources": SkillResource.objects.count(),
                "unread_notifications": notifications.filter(is_read=False).count(),
            },
            "notifications": [_notification_to_dict(n) for n in notifications[:8]],
            # No [:N] truncation: admins must see EVERY record, not a sample.
            "students": [_student_to_dict(s) for s in students],
            "recruiters": [_recruiter_to_dict(r) for r in recruiters],
            "jobs": [_job_to_dict(j) for j in jobs],
            "internships": [_internship_to_dict(i) for i in internships],
            "applications": [_application_to_dict(a) for a in applications],
            "companies": [_company_to_dict(c) for c in companies],
            "career_paths": [_career_path_to_dict(p) for p in career_paths],
            "milestones": [_milestone_to_dict(m) for m in milestones],
            "interview_questions": [_question_to_dict(q) for q in interview_questions],
            "learning_resources": [_resource_to_dict(r) for r in learning_resources],
        }
        return Response(data)


class AdminDeleteAPIView(APIView):
    # Ad-hoc dict responses; named empty serializer keeps schema generation clean.
    serializer_class = EmptySerializer
    """Delete a single platform record by type + id. Superuser only.

    Accepts DELETE with a JSON body of {"model": <slug>, "id": <pk>}. The
    "student" / "recruiter" models delete the underlying user account (which
    cascades to their profile and related records); every other model deletes
    the record itself (database-level cascades clean up dependents).
    """

    permission_classes = [permissions.IsAdminUser]

    _MODELS = _ADMIN_MODELS

    def delete(self, request):
        model_name = request.data.get("model")
        record_id = request.data.get("id")

        if model_name not in self._MODELS:
            return Response(
                {"error": f"Unknown model '{model_name}'"}, status=400
            )

        model_cls = self._MODELS[model_name]
        try:
            obj = model_cls.objects.get(pk=record_id)
        except (model_cls.DoesNotExist, TypeError, ValueError):
            return Response(
                {"error": f"{model_name} with id {record_id} not found"},
                status=404,
            )

        label = str(obj)
        # Never let an admin delete their own account from the platform tables.
        if model_name in ("student", "recruiter") and obj.user_id == request.user.id:
            return Response(
                {"error": "You cannot delete your own account."}, status=400
            )
        # Deleting the user account cascades to the profile and any
        # applications/saved records the account owns.
        if model_name in ("student", "recruiter"):
            obj.user.delete()
        else:
            obj.delete()

        return Response({"message": f"Deleted {model_name}: {label}"})


class AdminUpdateAPIView(APIView):
    # Ad-hoc dict responses; named empty serializer keeps schema generation clean.
    serializer_class = EmptySerializer
    """Update allowed fields on a single record. Superuser only.

    Accepts PATCH with {"model": <slug>, "id": <pk>, "fields": {...}}.
    Only whitelisted fields per model are updated; unknown fields are
    rejected, choice fields are validated against the allowed values, and
    booleans/numbers are coerced before assignment. The "active" flag on
    students/recruiters maps through to the underlying user account.
    """

    permission_classes = [permissions.IsAdminUser]

    _MODELS = _ADMIN_MODELS

    # model -> { field_key: (attribute path, type) }
    # "choice:..." types validate the value against a comma-separated allowlist.
    _SCHEMAS = {
        "student": {
            "active": ("user.is_active", "bool"),
            "education": ("education", "text"),
            "experience": ("experience", "text"),
            "github_username": ("github_username", "text"),
            "portfolio_link": ("portfolio_link", "text"),
        },
        "recruiter": {
            "active": ("user.is_active", "bool"),
            "designation": ("designation", "text"),
        },
        "job": {
            "title": ("title", "text"),
            "location": ("location", "text"),
            "job_type": ("job_type", "choice:Full-time,Part-time,Remote,On-site"),
            "salary": ("salary", "text"),
            "experience_required": ("experience_required", "text"),
            "deadline": ("deadline", "date"),
            "is_active": ("is_active", "bool"),
        },
        "internship": {
            "title": ("title", "text"),
            "location": ("location", "text"),
            "internship_type": (
                "internship_type",
                "choice:Full-time,Part-time,Remote,On-site",
            ),
            "stipend": ("stipend", "text"),
            "duration": ("duration", "text"),
            "deadline": ("deadline", "date"),
            "is_active": ("is_active", "bool"),
        },
        "application": {
            "status": ("status", "choice:Applied,Shortlisted,Rejected,Accepted"),
        },
        "company": {
            "name": ("name", "text"),
            "industry": ("industry", "text"),
            "size": ("size", "text"),
            "location": ("location", "text"),
            "website": ("website", "text"),
        },
        "career_path": {
            "name": ("name", "text"),
            "description": ("description", "text"),
            "avg_salary_min": ("avg_salary_min", "number"),
            "avg_salary_max": ("avg_salary_max", "number"),
            "growth_outlook": ("growth_outlook", "text"),
            "is_active": ("is_active", "bool"),
        },
        "milestone": {
            "title": ("title", "text"),
            "level": ("level", "choice:entry,mid,senior,lead,principal"),
            "experience_years": ("experience_years", "text"),
            "salary_range": ("salary_range", "text"),
        },
        "question": {
            "question": ("question", "text"),
            "difficulty": ("difficulty", "choice:beginner,intermediate,advanced"),
            "is_behavioral": ("is_behavioral", "bool"),
        },
        "resource": {
            "title": ("title", "text"),
            "url": ("url", "text"),
            "resource_type": (
                "resource_type",
                "choice:course,tutorial,article,video,book,documentation",
            ),
            "difficulty": ("difficulty", "choice:beginner,intermediate,advanced"),
            "is_free": ("is_free", "bool"),
            "description": ("description", "text"),
        },
    }

    @staticmethod
    def _coerce(ftype, value):
        if ftype == "bool":
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.strip().lower() in ("1", "true", "yes", "on")
            return bool(value)
        if ftype == "number":
            return int(value)
        if ftype.startswith("choice:"):
            allowed = ftype.split(":", 1)[1].split(",")
            if value not in allowed:
                raise ValueError(
                    f"must be one of: {', '.join(allowed)}"
                )
            return value
        return value

    def patch(self, request):
        model_name = request.data.get("model")
        record_id = request.data.get("id")
        fields = request.data.get("fields") or {}

        if model_name not in self._MODELS:
            return Response(
                {"error": f"Unknown model '{model_name}'"}, status=400
            )
        if not isinstance(fields, dict) or not fields:
            return Response({"error": "No fields to update"}, status=400)

        schema = self._SCHEMAS[model_name]
        unknown = set(fields) - set(schema)
        if unknown:
            return Response(
                {
                    "error": f"Unknown fields for '{model_name}': "
                    f"{', '.join(sorted(unknown))}"
                },
                status=400,
            )

        model_cls = self._MODELS[model_name]
        try:
            obj = model_cls.objects.get(pk=record_id)
        except (model_cls.DoesNotExist, TypeError, ValueError):
            return Response(
                {"error": f"{model_name} with id {record_id} not found"},
                status=404,
            )

        user_dirty = False
        for key, value in fields.items():
            path, ftype = schema[key]
            # Date fields keep their existing value when sent as empty.
            if ftype == "date" and value in (None, ""):
                continue
            try:
                coerced = self._coerce(ftype, value)
            except (ValueError, TypeError) as exc:
                return Response(
                    {"error": f"Invalid value for '{key}': {exc}"}, status=400
                )

            # Mirror the delete view: an admin may not deactivate their own
            # account from the platform tables.
            if (
                model_name in ("student", "recruiter")
                and key == "active"
                and obj.user_id == request.user.id
                and not coerced
            ):
                return Response(
                    {"error": "You cannot deactivate your own account."},
                    status=400,
                )

            parts = path.split(".")
            target = obj
            for part in parts[:-1]:
                target = getattr(target, part)
            setattr(target, parts[-1], coerced)
            if parts[0] == "user":
                user_dirty = True

        if user_dirty:
            obj.user.save()
        obj.save()

        return Response({"message": f"Updated {model_name} #{obj.pk}"})
