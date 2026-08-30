from django.contrib import admin
from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("sender", "receiver", "content_preview", "is_read", "timestamp")
    list_filter = ("is_read", "timestamp")
    search_fields = ("sender__email", "receiver__email", "content")
    list_select_related = ("sender", "receiver")

    def content_preview(self, obj):
        return obj.content[:80] + ("..." if len(obj.content) > 80 else "")

    content_preview.short_description = "Content"
