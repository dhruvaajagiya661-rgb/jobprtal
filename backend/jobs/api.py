from rest_framework import viewsets, permissions, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from .serializers import (
    JobSerializer,
    JobDetailSerializer,
    SkillSerializer,
)
from .models import Skill
from .services import JobService
from recruiters.scoping import scope_postings


class JobViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint that allows jobs to be viewed.
    """

    serializer_class = JobSerializer
    permission_classes = [permissions.AllowAny]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return JobDetailSerializer
        return JobSerializer

    def get_queryset(self):
        filters = {}
        q = self.request.query_params.get("q")
        if q:
            filters["q"] = q
        job_type = self.request.query_params.getlist("job_type")
        if job_type:
            filters["job_type"] = [
                t.strip()
                for value in job_type
                for t in value.split(",")
                if t.strip()
            ]
        queryset = JobService.get_active_jobs(filters)
        # A recruiter account stands for a company: it sees that company's
        # postings everywhere on the site, and no other company's.
        if self.request.user.is_authenticated and self.request.user.is_recruiter:
            queryset = scope_postings(queryset, self.request.user)
        return queryset

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def featured(self, request):
        """Return featured/recent jobs for the homepage."""
        jobs = self.get_queryset().order_by("-created_at")[:6]
        serializer = self.get_serializer(jobs, many=True, context={"request": request})
        return Response(serializer.data)


class SkillListView(generics.ListAPIView):
    """
    List all known skills (used by the student profile editor).
    """

    queryset = Skill.objects.all().order_by("name")
    serializer_class = SkillSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None
