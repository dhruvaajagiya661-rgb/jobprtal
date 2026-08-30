from django.contrib import admin
from .models import Company, RecruiterProfile


class RecruiterProfileInline(admin.TabularInline):
    model = RecruiterProfile
    extra = 0
    fields = ("user_email", "designation")
    readonly_fields = ("user_email",)

    def user_email(self, obj):
        return obj.user.email

    user_email.short_description = "Email"


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "industry",
        "location",
        "size",
        "recruiters_count",
        "website_link",
    )
    list_filter = ("industry", "size")
    search_fields = ("name", "industry", "location", "description")
    inlines = [RecruiterProfileInline]

    def recruiters_count(self, obj):
        return obj.recruiterprofile_set.count()

    recruiters_count.short_description = "Recruiters"

    def website_link(self, obj):
        if obj.website:
            return obj.website[:50] + "..." if len(obj.website) > 50 else obj.website
        return "—"

    website_link.short_description = "Website"


@admin.register(RecruiterProfile)
class RecruiterProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user_email",
        "user_username",
        "company_name",
        "designation",
        "is_active_user",
    )
    list_filter = ("company__name", "designation", "user__is_active")
    search_fields = ("user__email", "user__username", "company__name", "designation")
    list_select_related = ("user", "company")
    list_per_page = 25

    fieldsets = (
        ("User Info", {"fields": ("user",)}),
        ("Company & Role", {"fields": ("company", "designation")}),
    )

    def user_email(self, obj):
        return obj.user.email

    user_email.short_description = "Email"
    user_email.admin_order_field = "user__email"

    def user_username(self, obj):
        return obj.user.username

    user_username.short_description = "Username"
    user_username.admin_order_field = "user__username"

    def company_name(self, obj):
        return obj.company.name if obj.company else "—"

    company_name.short_description = "Company"
    company_name.admin_order_field = "company__name"

    def is_active_user(self, obj):
        return obj.user.is_active

    is_active_user.short_description = "Active"
    is_active_user.boolean = True
