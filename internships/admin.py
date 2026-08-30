from django.contrib import admin
from .models import Internship


@admin.register(Internship)
class InternshipAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "internship_type", "deadline", "is_active")
    list_filter = ("internship_type", "is_active", "created_at")
    search_fields = ("title", "company__name", "description")
