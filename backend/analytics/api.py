from rest_framework import viewsets, permissions

from portal.serializers import EmptySerializer
from rest_framework.decorators import action
from rest_framework.response import Response

from applications.models import Application
from jobs.models import Job
from accounts.models import CustomUser


class AnalyticsViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAdminUser]
    # Ad-hoc dict responses; named empty serializer keeps these actions in the OpenAPI schema.
    serializer_class = EmptySerializer

    @action(detail=False, methods=["get"])
    def overview(self, request):
        """Get platform-wide analytics (admin only)."""
        total_users = CustomUser.objects.count()
        total_jobs = Job.objects.count()
        total_applications = Application.objects.count()
        total_recruiters = CustomUser.objects.filter(is_recruiter=True).count()
        total_students = CustomUser.objects.filter(is_student=True).count()

        # Application stats
        applied_count = Application.objects.filter(status="Applied").count()
        shortlisted_count = Application.objects.filter(status="Shortlisted").count()
        accepted_count = Application.objects.filter(status="Accepted").count()
        rejected_count = Application.objects.filter(status="Rejected").count()

        return Response(
            {
                "total_users": total_users,
                "total_jobs": total_jobs,
                "total_applications": total_applications,
                "total_recruiters": total_recruiters,
                "total_students": total_students,
                "application_statuses": {
                    "applied": applied_count,
                    "shortlisted": shortlisted_count,
                    "accepted": accepted_count,
                    "rejected": rejected_count,
                },
            }
        )
