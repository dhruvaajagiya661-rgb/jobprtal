from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from portal.query_utils import parse_id
from django.db.models import Q
from django.contrib.auth import get_user_model
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from portal.authentication import LenientJWTAuthentication

from .models import Message
from .serializers import MessageSerializer, MessageCreateSerializer

User = get_user_model()


class MessageViewSet(viewsets.GenericViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Message.objects.filter(
            Q(sender=self.request.user) | Q(receiver=self.request.user)
        ).order_by("-timestamp")

    @action(detail=False, methods=["get"])
    def conversations(self, request):
        """Get list of users the current user has chatted with.

        Newest thread first - the list was previously returned in whatever
        order the database handed back the partner rows, so an active
        conversation could sit below a months-old one.

        Also flattened from 2 queries per partner (last message + unread
        count) down to three queries total.
        """
        user = request.user

        # One pass over this user's messages, newest first: the first time a
        # partner is seen is that thread's last message.
        rows = (
            Message.objects.filter(Q(sender=user) | Q(receiver=user))
            .order_by("-timestamp")
            .values_list("sender_id", "receiver_id", "content", "timestamp", "is_read")
        )

        last_by_partner = {}
        unread_by_partner = {}
        for sender_id, receiver_id, content, timestamp, is_read in rows:
            partner_id = receiver_id if sender_id == user.id else sender_id
            if partner_id not in last_by_partner:
                last_by_partner[partner_id] = (content, timestamp)
            if receiver_id == user.id and not is_read:
                unread_by_partner[partner_id] = unread_by_partner.get(partner_id, 0) + 1

        partners = User.objects.filter(id__in=last_by_partner).only(
            "id", "username", "email", "first_name", "last_name"
        )

        conversations = [
            {
                "partner_id": partner.id,
                "partner_name": partner.get_full_name().strip() or partner.username,
                "partner_email": partner.email,
                "last_message": last_by_partner[partner.id][0],
                "last_timestamp": last_by_partner[partner.id][1],
                "unread_count": unread_by_partner.get(partner.id, 0),
            }
            for partner in partners
        ]
        conversations.sort(key=lambda c: c["last_timestamp"], reverse=True)
        return Response(conversations)

    @action(detail=False, methods=["get"])
    def chat_with(self, request):
        """Get messages exchanged with a specific user."""
        partner_id = request.query_params.get("user_id")
        if not partner_id:
            return Response({"error": "user_id is required"}, status=400)
        partner_id = parse_id(partner_id)
        if partner_id is None:
            return Response({"error": "user_id must be a number"}, status=400)

        messages = Message.objects.filter(
            (Q(sender=request.user) & Q(receiver_id=partner_id))
            | (Q(sender_id=partner_id) & Q(receiver=request.user))
        ).order_by("timestamp")

        # Mark as read
        messages.filter(
            sender_id=partner_id, receiver=request.user, is_read=False
        ).update(is_read=True)

        serializer = self.get_serializer(messages, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def send(self, request):
        """Send a message to another user."""
        serializer = MessageCreateSerializer(data=request.data)
        if serializer.is_valid():
            message = serializer.save(sender=request.user)
            # Broadcast to the room group so the receiver's open WebSocket gets
            # the message in real time (same event shape the consumer emits).
            room_name = (
                f"{min(request.user.id, message.receiver_id)}_"
                f"{max(request.user.id, message.receiver_id)}"
            )
            channel_layer = get_channel_layer()
            if channel_layer is not None:
                async_to_sync(channel_layer.group_send)(
                    f"chat_{room_name}",
                    {
                        "type": "chat_message",
                        "message": message.content,
                        "sender_email": request.user.email,
                        "message_id": message.id,
                        # ISO-8601, matching the REST serializer and the WS consumer.
                        "timestamp": message.timestamp.isoformat(),
                    },
                )
            return Response(
                MessageSerializer(message).data, status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[permissions.AllowAny],
        authentication_classes=[LenientJWTAuthentication],
    )
    def unread_count(self, request):
        """Get count of unread messages."""
        if not request.user.is_authenticated:
            return Response({"unread_count": 0})
        count = Message.objects.filter(receiver=request.user, is_read=False).count()
        return Response({"unread_count": count})

    @action(detail=False, methods=["delete"])
    def delete_message(self, request):
        """Delete one of the current user's own messages."""
        message_id = request.data.get("message_id")
        if not message_id:
            return Response(
                {"error": "message_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        message = Message.objects.filter(id=message_id, sender=request.user).first()
        if not message:
            return Response({"error": "Message not found"}, status=status.HTTP_404_NOT_FOUND)
        room_name = f"{min(message.sender_id, message.receiver_id)}_{max(message.sender_id, message.receiver_id)}"
        message.delete()
        # Broadcast so the other participant's open WebSocket drops the message.
        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(
                f"chat_{room_name}",
                {"type": "chat_message_deleted", "message_id": message_id},
            )
        return Response(status=status.HTTP_204_NO_CONTENT)
