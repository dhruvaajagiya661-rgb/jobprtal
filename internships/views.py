from django.shortcuts import redirect
from django.views.generic import ListView, DetailView
from django.http import Http404
from django.contrib import messages
from .models import Internship


class InternshipListView(ListView):
    model = Internship
    template_name = "internships/internship_list.html"
    context_object_name = "internships"
    paginate_by = 10

    def get_queryset(self):
        queryset = (
            Internship.objects.filter(is_active=True)
            .select_related("company", "category")
            .prefetch_related("skills_required")
            .order_by("-created_at")
        )

        # Text Search
        q = self.request.GET.get("q")
        if q:
            queryset = queryset.filter(title__icontains=q)

        # Internship Type Filter (supports comma-separated values)
        types = []
        for value in self.request.GET.getlist("type"):
            types.extend(t.strip() for t in value.split(",") if t.strip())
        if types:
            queryset = queryset.filter(internship_type__in=types)

        # Stipend Filter
        stipend = self.request.GET.get("stipend")
        if stipend == "Paid":
            queryset = queryset.exclude(stipend__icontains="unpaid").exclude(
                stipend="0"
            )
        elif stipend == "Unpaid":
            queryset = queryset.filter(stipend__icontains="unpaid")

        return queryset

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.request.user.is_authenticated and self.request.user.is_student:
            from applications.models import Application

            user_applications = Application.objects.filter(
                student=self.request.user
            ).values_list("internship_id", flat=True)
            context["applied_internship_ids"] = list(user_applications)
        return context


class InternshipDetailView(DetailView):
    model = Internship
    template_name = "internships/internship_detail.html"
    context_object_name = "internship"

    def get(self, request, *args, **kwargs):
        try:
            return super().get(request, *args, **kwargs)
        except Http404:
            messages.warning(
                request,
                "The internship opportunity you are looking for no longer exists or has been moved.",
            )
            return redirect("internship_list")

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.request.user.is_authenticated and self.request.user.is_student:
            from applications.models import Application

            context["has_applied"] = Application.objects.filter(
                internship=self.object, student=self.request.user
            ).exists()
        return context
