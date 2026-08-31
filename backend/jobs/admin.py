from django.contrib import admin
from .models import Job, Skill, Category, SavedJob


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "company", "job_type", "deadline", "is_active")
    list_filter = ("job_type", "is_active", "created_at")
    search_fields = ("title", "company__name", "description")


admin.site.register(Skill)
admin.site.register(Category)


@admin.register(SavedJob)
class SavedJobAdmin(admin.ModelAdmin):
    list_display = ("user", "job", "saved_at")
    list_filter = ("saved_at",)
    search_fields = ("user__email", "job__title")
    list_select_related = ("user", "job")
