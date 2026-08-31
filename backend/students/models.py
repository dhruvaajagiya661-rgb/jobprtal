from django.db import models
from django.conf import settings

from portal.validators import validate_resume_file


class StudentProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="student_profile",
    )
    profile_photo = models.ImageField(
        upload_to="profile_photos/", null=True, blank=True
    )
    resume = models.FileField(
        upload_to="resumes/",
        null=True,
        blank=True,
        validators=[validate_resume_file],
    )
    skills = models.ManyToManyField("jobs.Skill", blank=True)
    education = models.TextField(blank=True)
    experience = models.TextField(blank=True)
    portfolio_link = models.URLField(blank=True, null=True)
    github_link = models.URLField(blank=True, null=True)
    github_username = models.CharField(max_length=100, blank=True, null=True)
    verified_github_data = models.JSONField(null=True, blank=True)
    linkedin_link = models.URLField(blank=True, null=True)
    # Student portfolio projects: list of {"id", "title", "description", "link"}
    projects = models.JSONField(default=list, blank=True)

    def __str__(self):
        return self.user.email
