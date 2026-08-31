from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("user", "action", "ip_address", "timestamp")
    list_filter = ("action", "timestamp")
    search_fields = ("user__email", "action", "ip_address")
    readonly_fields = ("user", "action", "ip_address", "user_agent", "timestamp", "details")
