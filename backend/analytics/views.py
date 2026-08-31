from django.shortcuts import render
from django.contrib.auth.decorators import user_passes_test
from accounts.models import CustomUser
from applications.models import Application
from internships.models import Internship
from jobs.models import Job
from recruiters.models import Company, RecruiterProfile
from students.models import StudentProfile


@user_passes_test(lambda u: u.is_superuser, login_url="admin:login")
def admin_analytics_dashboard(request):
    context = {
        "total_users": CustomUser.objects.count(),
        "total_students": StudentProfile.objects.count(),
        "total_recruiters": RecruiterProfile.objects.count(),
        "total_companies": Company.objects.count(),
        "total_jobs": Job.objects.count(),
        "total_internships": Internship.objects.count(),
        "total_applications": Application.objects.count(),
    }
    return render(request, "analytics/dashboard.html", context)
