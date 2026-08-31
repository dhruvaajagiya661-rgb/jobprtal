import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Message

User = get_user_model()


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"]["room_name"]
        self.room_group_name = f"chat_{self.room_name}"

        if self.scope["user"].is_authenticated:
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name, self.channel_name
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message = data["message"]
        receiver_id = data["receiver_id"]

        # Save message to database
        saved_msg = await self.save_message(self.scope["user"], receiver_id, message)

        # Send message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                "type": "chat_message",
                "message": message,
                "sender_email": self.scope["user"].email,
                "message_id": saved_msg.id,
                # ISO-8601 (same format as the REST serializer) so clients can
                # parse WS and REST timestamps identically.
                "timestamp": saved_msg.timestamp.isoformat(),
            },
        )

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "message": event["message"],
                    "sender_email": event["sender_email"],
                    "message_id": event.get("message_id"),
                    "timestamp": event["timestamp"],
                }
            )
        )

    async def chat_message_deleted(self, event):
        await self.send(text_data=json.dumps({"deleted_message_id": event["message_id"]}))

    @database_sync_to_async
    def save_message(self, sender, receiver_id, content):
        receiver = User.objects.get(id=receiver_id)
        return Message.objects.create(sender=sender, receiver=receiver, content=content)
