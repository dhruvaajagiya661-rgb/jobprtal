"""
Super-admin dashboard: full visibility into all students & recruiters.

Exposed at /admin/dashboard/ (superuser-only). Follows the same
convention as analytics.views.admin_analytics_dashboard.
"""

from django.contrib import admin
from django.contrib.auth.decorators import user_passes_test
from django.db.models import Q, Count
from django.shortcuts import render

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


def _build_dashboard_context(request):
    """Build the all-records context shared by the dashboard page and the
    Django admin index (so the tables also render on /admin/)."""
    query = request.GET.get("q", "").strip()

    # Non-superuser staff should not trigger the (potentially heavy) record
    # queries; the admin index template hides the tables for them anyway.
    if not request.user.is_superuser:
        return {"query": query}

    students = StudentProfile.objects.select_related("user").prefetch_related("skills")
    recruiters = RecruiterProfile.objects.select_related("user", "company")
    jobs = Job.objects.select_related("company", "category").annotate(
        applications_count=Count("applications", distinct=True)
    )
    internships = Internship.objects.select_related("company", "category").annotate(
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
    interview_questions = InterviewQuestion.objects.select_related(
        "skill", "career_path"
    )
    learning_resources = SkillResource.objects.select_related("skill")

    if query:
        students = students.filter(
            Q(user__email__icontains=query)
            | Q(user__username__icontains=query)
            | Q(user__first_name__icontains=query)
            | Q(user__last_name__icontains=query)
            | Q(skills__name__icontains=query)
            | Q(education__icontains=query)
            | Q(experience__icontains=query)
            | Q(github_username__icontains=query)
        ).distinct()
        recruiters = recruiters.filter(
            Q(user__email__icontains=query)
            | Q(user__username__icontains=query)
            | Q(user__first_name__icontains=query)
            | Q(user__last_name__icontains=query)
            | Q(company__name__icontains=query)
            | Q(designation__icontains=query)
        )
        jobs = jobs.filter(
            Q(title__icontains=query)
            | Q(company__name__icontains=query)
            | Q(location__icontains=query)
            | Q(category__name__icontains=query)
            | Q(job_type__icontains=query)
        )
        internships = internships.filter(
            Q(title__icontains=query)
            | Q(company__name__icontains=query)
            | Q(location__icontains=query)
            | Q(category__name__icontains=query)
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
            Q(title__icontains=query)
            | Q(description__icontains=query)
            | Q(career_path__name__icontains=query)
            | Q(level__icontains=query)
            | Q(skills_required__name__icontains=query)
        ).distinct()
        interview_questions = interview_questions.filter(
            Q(question__icontains=query)
            | Q(skill__name__icontains=query)
            | Q(career_path__name__icontains=query)
            | Q(difficulty__icontains=query)
        )
        learning_resources = learning_resources.filter(
            Q(title__icontains=query)
            | Q(skill__name__icontains=query)
            | Q(resource_type__icontains=query)
        )

    return {
        "query": query,
        "recent_notifications": Notification.objects.filter(
            user=request.user
        ).order_by("-created_at")[:8],
        "unread_notifications_count": Notification.objects.filter(
            user=request.user, is_read=False
        ).count(),
        "students": students,
        "recruiters": recruiters,
        "jobs": jobs,
        "internships": internships,
        "applications": applications,
        "companies": companies,
        "career_paths": career_paths,
        "milestones": milestones,
        "interview_questions": interview_questions,
        "learning_resources": learning_resources,
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
        "total_users": CustomUser.objects.count(),
    }


@user_passes_test(lambda u: u.is_superuser, login_url="admin:login")
def admin_dashboard(request):
    return render(request, "admin/dashboard.html", _build_dashboard_context(request))


# Augment the Django admin home page (/admin/) with the same all-records
# tables, so admins see students/recruiters/jobs/etc. right after login
# instead of only model links. The standard model list and recent-actions
# sidebar remain untouched (rendered by templates/admin/index.html).
_original_admin_index = admin.site.index


def admin_index_with_dashboard(request, extra_context=None):
    context = _build_dashboard_context(request)
    context["is_superuser"] = request.user.is_superuser
    if extra_context:
        context.update(extra_context)
    return _original_admin_index(request, extra_context=context)


# Assign before admin.site.urls is evaluated (portal/urls.py imports this
# module before building urlpatterns), so the wrapped index view is used.
admin.site.index = admin_index_with_dashboard
