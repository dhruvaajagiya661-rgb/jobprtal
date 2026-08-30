from django.urls import re_path
from . import consumers, ai_consumer

websocket_urlpatterns = [
    re_path(r"ws/chat/(?P<room_name>\w+)/$", consumers.ChatConsumer.as_asgi()),
    re_path(r"ws/ai-assistant/$", ai_consumer.AIConsumer.as_asgi()),
]
