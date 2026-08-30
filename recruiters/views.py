from django.shortcuts import render, redirect, get_object_or_404
from django.views.generic import CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from django.db.models import Q
from jobs.models import Job
from .forms import JobForm
from accounts.decorators import recruiter_required
from accounts.mixins import RecruiterRequiredMixin
from django.contrib import messages
from notifications.models import Notification
from notifications.services import notify_admins
from analytics.utils import log_action

from applications.models import Application
from .scoping import application_scope_q, posting_scope_kwargs, scope_postings


@recruiter_required
def recruiter_dashboard(request):
    jobs = scope_postings(Job.objects.all(), request.user).order_by("-created_at")

    my_applications = Application.objects.filter(
        application_scope_q(request.user)
    )

    # Get total applicants count for all jobs and internships
    total_applicants = my_applications.count()
    shortlisted_count = my_applications.filter(status="Shortlisted").count()
    accepted_count = my_applications.filter(status="Accepted").count()

    context = {
        "jobs": jobs,
        "jobs_count": jobs.count(),
        "total_applicants": total_applicants,
        "shortlisted_count": shortlisted_count,
        "accepted_count": accepted_count,
    }
    return render(request, "recruiters/dashboard.html", context)


@recruiter_required
def view_applicants(request, job_id=None):
    if job_id:
        job = get_object_or_404(Job, id=job_id, **posting_scope_kwargs(request.user))
        applicants = Application.objects.filter(job=job).order_by("-applied_at")
        return render(
            request,
            "recruiters/applicants.html",
            {"job": job, "applicants": applicants},
        )
    else:
        # Global view for all applicants to this recruiter's jobs and internships
        applicants = Application.objects.filter(
            application_scope_q(request.user)
        ).order_by("-applied_at")
        return render(
            request,
            "recruiters/applicants.html",
            {"applicants": applicants, "is_global": True},
        )


@recruiter_required
def manage_jobs(request):
    jobs = scope_postings(Job.objects.all(), request.user).order_by("-created_at")
    return render(request, "recruiters/manage_jobs.html", {"jobs": jobs})


@recruiter_required
def company_profile(request):
    profile = request.user.recruiter_profile
    company = profile.company

    if request.method == "POST":
        # Simple update logic for company details
        if company:
            company.name = request.POST.get("name")
            company.industry = request.POST.get("industry")
            company.location = request.POST.get("location")
            company.website = request.POST.get("website")
            company.description = request.POST.get("description")
            company.size = request.POST.get("size")
            if "logo" in request.FILES:
                company.logo = request.FILES["logo"]
            company.save()
            messages.success(request, "Company profile updated successfully!")
            return redirect("company_profile")

    return render(
        request,
        "recruiters/company_profile.html",
        {"company": company, "profile": profile},
    )


@recruiter_required
def update_application_status(request, app_id, status):
    application = get_object_or_404(
        Application,
        application_scope_q(request.user),
        id=app_id,
    )
    application.status = status
    application.save()

    title = application.job.title if application.job else application.internship.title
    # Create notification for student
    Notification.objects.create(
        user=application.student,
        title="Application Status Updated",
        message=f"Your application for {title} has been updated to: {status}",
    )
    notify_admins(
        "Application Status Updated",
        f"Application by {application.student.email} for {title} was set to: {status}",
    )

    messages.success(request, f"Application status updated to {status}")
    if application.job:
        return redirect("view_applicants", job_id=application.job.id)
    return redirect("all_applicants")


class JobCreateView(RecruiterRequiredMixin, CreateView):
    model = Job
    form_class = JobForm
    template_name = "recruiters/post_job.html"
    success_url = reverse_lazy("recruiter_dashboard")

    def form_valid(self, form):
        form.instance.recruiter = self.request.user
        response = super().form_valid(form)
        log_action(self.request, "Job Created", details={"title": form.instance.title})
        return response


class JobUpdateView(RecruiterRequiredMixin, UpdateView):
    model = Job
    form_class = JobForm
    template_name = "recruiters/post_job.html"
    success_url = reverse_lazy("recruiter_dashboard")

    def get_queryset(self):
        return scope_postings(Job.objects.all(), self.request.user)

    def form_valid(self, form):
        messages.success(self.request, "Job updated successfully!")
        log_action(self.request, "Job Updated", details={"title": form.instance.title})
        return super().form_valid(form)


class JobDeleteView(RecruiterRequiredMixin, DeleteView):
    model = Job
    success_url = reverse_lazy("recruiter_dashboard")

    def get_queryset(self):
        return scope_postings(Job.objects.all(), self.request.user)

    def delete(self, request, *args, **kwargs):
        job = self.get_object()
        log_action(self.request, "Job Deleted", details={"title": job.title})
        messages.success(self.request, "Job deleted successfully!")
        return super().delete(request, *args, **kwargs)
