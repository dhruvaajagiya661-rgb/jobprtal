from django.views.generic import ListView, DetailView
from .models import Job


class JobListView(ListView):
    model = Job
    template_name = "jobs/job_list.html"
    context_object_name = "jobs"
    paginate_by = 10

    def get_queryset(self):
        queryset = (
            Job.objects.filter(is_active=True)
            .select_related("company", "category")
            .prefetch_related("skills_required")
            .order_by("-created_at")
        )
        q = self.request.GET.get("q")
        if q:
            queryset = queryset.filter(title__icontains=q)

        # Job Type filter (supports comma-separated values)
        job_types = []
        for value in self.request.GET.getlist("job_type"):
            job_types.extend(t.strip() for t in value.split(",") if t.strip())
        if job_types:
            queryset = queryset.filter(job_type__in=job_types)

        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.request.user.is_authenticated and self.request.user.is_student:
            from applications.models import Application

            user_applications = Application.objects.filter(
                student=self.request.user
            ).values_list("job_id", flat=True)
            context["applied_job_ids"] = list(user_applications)
        return context


class JobDetailView(DetailView):
    model = Job
    template_name = "jobs/job_detail.html"
    context_object_name = "job"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.request.user.is_authenticated and self.request.user.is_student:
            from applications.models import Application

            context["has_applied"] = Application.objects.filter(
                job=self.object, student=self.request.user
            ).exists()
        return context
