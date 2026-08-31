import json
from channels.generic.websocket import AsyncWebsocketConsumer


class AnalyticsConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if self.scope["user"].is_staff:
            self.group_name = "admin_analytics"
            await self.channel_layer.group_add(self.group_name, self.channel_name)
            await self.accept()
        else:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def metric_update(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "metric_update",
                    "total_users": event["total_users"],
                    "total_students": event.get("total_students"),
                    "total_recruiters": event.get("total_recruiters"),
                    "total_companies": event.get("total_companies"),
                    "total_jobs": event["total_jobs"],
                    "total_internships": event.get("total_internships"),
                    "total_applications": event["total_applications"],
                }
            )
        )

    async def activity_log(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "activity",
                    "timestamp": event["timestamp"],
                    "message": event["message"],
                }
            )
        )
