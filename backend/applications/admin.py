from django.contrib import admin
from .models import Application


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("student", "job", "status", "applied_at")
    list_filter = ("status", "applied_at")
    search_fields = ("student__email", "job__title")
