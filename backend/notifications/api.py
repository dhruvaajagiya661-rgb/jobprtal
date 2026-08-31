from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from portal.authentication import LenientJWTAuthentication

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by(
            "-created_at"
        )

    @action(detail=False, methods=["get"])
    def list_notifications(self, request):
        """Get all notifications for the current user."""
        notifications = self.get_queryset()
        page = self.paginate_queryset(notifications)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(notifications, many=True)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.AllowAny],
        authentication_classes=[LenientJWTAuthentication],
    )
    def unread_count(self, request):
        """Get count of unread notifications."""
        if not request.user.is_authenticated:
            return Response({"unread_count": 0})
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"unread_count": count})

    @action(detail=False, methods=["post"])
    def mark_read(self, request):
        """Mark a notification as read."""
        notification_id = request.data.get("notification_id")
        if notification_id:
            Notification.objects.filter(id=notification_id, user=request.user).update(
                is_read=True
            )
        else:
            Notification.objects.filter(user=request.user, is_read=False).update(
                is_read=True
            )
        return Response({"message": "Marked as read"})

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.AllowAny],
        authentication_classes=[LenientJWTAuthentication],
    )
    def recent(self, request):
        """
        Get the most recent notifications for the navbar dropdown.

        Returns read + unread items (so the dropdown always has content) with
        is_read intact so the UI can highlight unread ones. The old behaviour
        of returning only unread items left the dropdown empty once everything
        was read.
        """
        if not request.user.is_authenticated:
            return Response([])
        notifications = self.get_queryset()[:8]
        serializer = self.get_serializer(notifications, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["delete"])
    def delete_notification(self, request):
        """Delete one of the current user's notifications."""
        notification_id = request.data.get("notification_id")
        if not notification_id:
            return Response(
                {"error": "notification_id is required"}, status=400
            )
        deleted, _ = Notification.objects.filter(
            id=notification_id, user=request.user
        ).delete()
        if not deleted:
            return Response({"error": "Notification not found"}, status=404)
        return Response(status=204)
