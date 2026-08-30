from .models import Job, Category
from django.db import transaction
from django.db.models import Q


class JobService:
    @staticmethod
    @transaction.atomic
    def create_job(recruiter, data, mandatory_skills=None, preferred_skills=None):
        """
        Production-grade service to create a job with atomic transaction and validation.
        """
        category_id = data.pop("category", None)
        if category_id:
            data["category"] = Category.objects.get(id=category_id)

        job = Job.objects.create(recruiter=recruiter, **data)

        if mandatory_skills:
            job.skills_required.set(mandatory_skills)
        if preferred_skills:
            job.preferred_skills.set(preferred_skills)

        return job

    @staticmethod
    def get_active_jobs(filters=None):
        queryset = (
            Job.objects.filter(is_active=True)
            .select_related("company", "category")
            .prefetch_related("skills_required", "preferred_skills")
        )
        if filters:
            if "q" in filters:
                # Search title, company and location so the query matches what
                # the UI promises ("title, company, or location") and mirrors
                # the internships endpoint. Title-only silently dropped every
                # company/location search (e.g. "Remote" returned nothing).
                q = filters["q"]
                queryset = queryset.filter(
                    Q(title__icontains=q)
                    | Q(company__name__icontains=q)
                    | Q(location__icontains=q)
                )
            if "job_type" in filters:
                job_types = filters["job_type"]
                if job_types:
                    queryset = queryset.filter(job_type__in=job_types)
        return queryset.order_by("-created_at")
