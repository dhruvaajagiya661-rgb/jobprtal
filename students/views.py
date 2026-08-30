from django.shortcuts import render, redirect
from datetime import datetime, timedelta
from calendar import monthrange
from django.utils import timezone
from .models import StudentProfile
from applications.models import Application
from jobs.models import SavedJob
from accounts.decorators import student_required

from django.contrib import messages
from .forms import StudentProfileForm
from careers.services import JobMatchingService


@student_required
def student_dashboard(request):
    profile, created = StudentProfile.objects.get_or_create(user=request.user)
    applications = Application.objects.filter(student=request.user).order_by(
        "-applied_at"
    )

    pending_count = applications.filter(status="Applied").count()
    shortlisted_count = applications.filter(status="Shortlisted").count()
    rejected_count = applications.filter(status="Rejected").count()
    accepted_count = applications.filter(status="Accepted").count()

    # Monthly activity data for chart (last 12 months)
    now = timezone.now()
    monthly_data = []
    for i in range(11, -1, -1):
        m = now.month - i
        yr = now.year
        if m <= 0:
            m += 12
            yr -= 1
        month_start = timezone.make_aware(datetime(yr, m, 1))
        _, days_in_month = monthrange(yr, m)
        month_end = month_start + timedelta(days=days_in_month)
        count = applications.filter(
            applied_at__gte=month_start, applied_at__lt=month_end
        ).count()
        monthly_data.append(count)

    # AI-Powered Job Matching
    recommended_jobs = JobMatchingService.get_recommended_jobs(profile, limit=6)
    recommended_internships = JobMatchingService.get_recommended_internships(
        profile, limit=4
    )

    context = {
        "profile": profile,
        "applications": applications,
        "applications_count": applications.count(),
        "pending_count": pending_count,
        "shortlisted_count": shortlisted_count,
        "rejected_count": rejected_count,
        "accepted_count": accepted_count,
        "monthly_data": monthly_data,
        "recommended_jobs": recommended_jobs,
        "recommended_internships": recommended_internships,
    }
    return render(request, "students/dashboard.html", context)


@student_required
def my_applications(request):
    applications = Application.objects.filter(student=request.user).order_by(
        "-applied_at"
    )
    return render(
        request, "students/my_applications.html", {"applications": applications}
    )


@student_required
def saved_jobs(request):
    saved = SavedJob.objects.filter(user=request.user).order_by("-saved_at")
    return render(request, "students/saved_jobs.html", {"saved_jobs": saved})


@student_required
def edit_student_profile(request):
    profile, created = StudentProfile.objects.get_or_create(user=request.user)

    if request.method == "POST":
        form = StudentProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, "Profile updated successfully!")
            return redirect("student_dashboard")
    else:
        form = StudentProfileForm(instance=profile)

    return render(request, "students/edit_profile.html", {"form": form})
