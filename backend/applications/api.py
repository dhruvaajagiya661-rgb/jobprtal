from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
# DRF's get_object_or_404 is the same shortcut but also turns a pk that
# cannot be coerced to the field type (e.g. /courses/abc/) into a 404
# instead of letting the ValueError surface as a 500.
from rest_framework.generics import get_object_or_404

from recruiters.scoping import application_scope_q
from .models import Application
from .serializers import ApplicationSerializer, ApplicationCreateSerializer
from jobs.models import Job
from internships.models import Internship
from notifications.models import Notification
from notifications.services import notify_admins


class ApplicationViewSet(viewsets.GenericViewSet):
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_student:
            return Application.objects.filter(student=self.request.user).order_by(
                "-applied_at"
            )
        elif self.request.user.is_recruiter:
            # Scoped to the recruiter's company, so colleagues share one
            # applicant pipeline and other companies stay invisible.
            return Application.objects.filter(
                application_scope_q(self.request.user)
            ).order_by("-applied_at")
        return Application.objects.none()

    @action(detail=False, methods=["post"])
    def apply(self, request):
        """Apply to a job or internship."""
        if not request.user.is_student:
            return Response(
                {"error": "Only students can apply"}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = ApplicationCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        job_id = serializer.validated_data.get("job_id")
        internship_id = serializer.validated_data.get("internship_id")
        resume = serializer.validated_data["resume"]

        if job_id:
            job = get_object_or_404(Job, id=job_id, is_active=True)
            if Application.objects.filter(job=job, student=request.user).exists():
                return Response(
                    {"error": "Already applied to this job"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            application = Application.objects.create(
                job=job, student=request.user, resume=resume
            )
            Notification.objects.create(
                user=job.recruiter,
                title="New Job Application",
                message=f"{request.user.username} has applied for {job.title}",
            )
            notify_admins(
                "New Job Application",
                f"{request.user.username} ({request.user.email}) has applied for {job.title} at {job.company.name}",
            )
        else:
            internship = get_object_or_404(Internship, id=internship_id, is_active=True)
            if Application.objects.filter(
                internship=internship, student=request.user
            ).exists():
                return Response(
                    {"error": "Already applied to this internship"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            application = Application.objects.create(
                internship=internship, student=request.user, resume=resume
            )
            Notification.objects.create(
                user=internship.recruiter,
                title="New Internship Application",
                message=f"{request.user.username} has applied for {internship.title}",
            )
            notify_admins(
                "New Internship Application",
                f"{request.user.username} ({request.user.email}) has applied for {internship.title} at {internship.company.name}",
            )

        return Response(
            ApplicationSerializer(application).data, status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=["get"])
    def my_applications(self, request):
        """Get the current user's applications."""
        if not request.user.is_student:
            return Response({"error": "Only students have applications"}, status=403)

        applications = self.get_queryset()
        page = self.paginate_queryset(applications)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(applications, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["delete"])
    def withdraw(self, request):
        """Withdraw (delete) one of the current student's applications."""
        if not request.user.is_student:
            return Response(
                {"error": "Only students can withdraw applications"},
                status=status.HTTP_403_FORBIDDEN,
            )
        application_id = request.data.get("application_id")
        if not application_id:
            return Response(
                {"error": "application_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        application = Application.objects.filter(
            id=application_id, student=request.user
        ).first()
        if not application:
            return Response(
                {"error": "Application not found"}, status=status.HTTP_404_NOT_FOUND
            )
        # Only pending applications (Applied / Shortlisted) can be withdrawn.
        if application.status not in ("Applied", "Shortlisted"):
            return Response(
                {
                    "error": "Only pending applications can be withdrawn"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        application.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"])
    def board(self, request):
        """Return applications grouped by status for the Kanban board."""
        if not request.user.is_student:
            return Response(
                {"error": "Only students have a board"},
                status=status.HTTP_403_FORBIDDEN,
            )
        applications = self.get_queryset().select_related(
            "job", "job__company", "internship", "internship__company"
        )
        columns = {}
        for status_choice, _ in Application.STATUS_CHOICES:
            columns[status_choice] = []
        for app in applications:
            columns.setdefault(app.status, [])
            columns[app.status].append(
                ApplicationSerializer(app, context={"request": request}).data
            )
        return Response(
            {
                "columns": columns,
                "total": applications.count(),
            }
        )

    @action(detail=False, methods=["post"], url_path="bulk_update_status")
    def bulk_update_status(self, request):
        """Update the status of one or more applications (drag-and-drop).

        Accepts:
            application_ids: list[int]
            status: str  (one of Applied, Shortlisted, Rejected, Accepted)
        """
        if not request.user.is_student:
            return Response(
                {"error": "Only students can update applications"},
                status=status.HTTP_403_FORBIDDEN,
            )
        ids = request.data.get("application_ids", [])
        new_status = request.data.get("status")
        valid_statuses = [s for s, _ in Application.STATUS_CHOICES]
        if not ids or new_status not in valid_statuses:
            return Response(
                {
                    "error": "application_ids (list) and a valid status are required"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        updated = (
            Application.objects.filter(id__in=ids, student=request.user)
            .update(status=new_status)
        )
        return Response({"updated": updated})
