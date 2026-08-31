from django.contrib import admin
from .models import StudentProfile


class StudentProfileAdmin(admin.ModelAdmin):
    list_display = (
        "user_email",
        "user_username",
        "skills_list",
        "education_preview",
        "has_resume",
        "has_portfolio",
        "github_username",
        "created_at",
    )
    list_filter = ("user__is_active", "skills")
    search_fields = (
        "user__email",
        "user__username",
        "education",
        "experience",
        "github_username",
    )
    readonly_fields = ("verified_github_data",)
    filter_horizontal = ("skills",)
    list_select_related = ("user",)
    list_per_page = 25

    fieldsets = (
        ("User Information", {"fields": ("user", "profile_photo")}),
        ("Skills & Education", {"fields": ("skills", "education", "experience")}),
        (
            "Links & Documents",
            {
                "fields": (
                    "resume",
                    "portfolio_link",
                    "github_link",
                    "github_username",
                    "linkedin_link",
                    "verified_github_data",
                )
            },
        ),
    )

    def user_email(self, obj):
        return obj.user.email

    user_email.short_description = "Email"
    user_email.admin_order_field = "user__email"

    def user_username(self, obj):
        return obj.user.username

    user_username.short_description = "Username"
    user_username.admin_order_field = "user__username"

    def skills_list(self, obj):
        skills = obj.skills.all()[:5]
        if skills:
            return ", ".join([s.name for s in skills])
        return "—"

    skills_list.short_description = "Skills"

    def education_preview(self, obj):
        if obj.education:
            return (
                obj.education[:80] + "..." if len(obj.education) > 80 else obj.education
            )
        return "—"

    education_preview.short_description = "Education"

    def has_resume(self, obj):
        return obj.resume is not None

    has_resume.short_description = "Resume"
    has_resume.boolean = True

    def has_portfolio(self, obj):
        return bool(obj.portfolio_link)

    has_portfolio.short_description = "Portfolio"
    has_portfolio.boolean = True

    def created_at(self, obj):
        return obj.user.date_joined.strftime("%b %d, %Y")

    created_at.short_description = "Joined"


admin.site.register(StudentProfile, StudentProfileAdmin)
