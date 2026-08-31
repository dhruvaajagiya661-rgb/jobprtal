from django.contrib import admin
from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ("email", "username", "is_student", "is_recruiter", "is_staff")
    list_filter = ("is_student", "is_recruiter", "is_staff", "is_active")
    search_fields = ("email", "username")
    ordering = ("email",)
