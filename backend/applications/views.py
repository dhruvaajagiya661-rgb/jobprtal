from django.shortcuts import render, redirect, get_object_or_404
from django.http import Http404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from jobs.models import Job
from internships.models import Internship
from .models import Application
from .forms import ApplicationForm

from notifications.models import Notification
from notifications.services import notify_admins


@login_required
def apply_job(request, job_id):
    if not request.user.is_student:
        messages.error(request, "Only students can apply for jobs.")
        return redirect("job_list")

    try:
        job = get_object_or_404(Job, id=job_id)
    except Http404:
        messages.warning(request, "This job opportunity is no longer available.")
        return redirect("job_list")

    # Check if already applied
    if Application.objects.filter(job=job, student=request.user).exists():
        messages.info(request, "Already Applied")
        return redirect("job_detail", pk=job_id)

    if request.method == "POST":
        form = ApplicationForm(request.POST, request.FILES)
        if form.is_valid():
            application = form.save(commit=False)
            application.job = job
            application.student = request.user
            application.save()

            # Create notification for recruiter
            Notification.objects.create(
                user=job.recruiter,
                title="New Job Application",
                message=f"{request.user.username} has applied for {job.title}",
            )
            notify_admins(
                "New Job Application",
                f"{request.user.username} ({request.user.email}) has applied for {job.title} at {job.company.name}",
            )

            messages.success(request, f"Successfully applied for {job.title}!")
            return redirect("student_dashboard")
    else:
        form = ApplicationForm()

    return render(request, "applications/apply.html", {"form": form, "job": job})


@login_required
def apply_internship(request, internship_id):
    if not request.user.is_student:
        messages.error(request, "Only students can apply for internships.")
        return redirect("internship_list")

    try:
        internship = get_object_or_404(Internship, id=internship_id)
    except Http404:
        messages.warning(request, "This internship opportunity is no longer available.")
        return redirect("internship_list")

    # Check if already applied
    if Application.objects.filter(internship=internship, student=request.user).exists():
        messages.info(request, "Already Applied")
        return redirect("internship_detail", pk=internship_id)

    if request.method == "POST":
        form = ApplicationForm(request.POST, request.FILES)
        if form.is_valid():
            application = form.save(commit=False)
            application.internship = internship
            application.student = request.user
            application.save()

            # Create notification for recruiter
            Notification.objects.create(
                user=internship.recruiter,
                title="New Internship Application",
                message=f"{request.user.username} has applied for {internship.title}",
            )
            notify_admins(
                "New Internship Application",
                f"{request.user.username} ({request.user.email}) has applied for {internship.title} at {internship.company.name}",
            )

            messages.success(request, f"Successfully applied for {internship.title}!")
            return redirect("student_dashboard")
    else:
        form = ApplicationForm()

    return render(
        request, "applications/apply.html", {"form": form, "internship": internship}
    )
