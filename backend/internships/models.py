from django.db import models
from django.conf import settings


class Internship(models.Model):
    INTERNSHIP_TYPE_CHOICES = (
        ("Full-time", "Full-time"),
        ("Part-time", "Part-time"),
        ("Remote", "Remote"),
        ("On-site", "On-site"),
    )
    title = models.CharField(max_length=255)
    company = models.ForeignKey("recruiters.Company", on_delete=models.CASCADE)
    recruiter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    description = models.TextField()
    requirements = models.TextField()
    location = models.CharField(max_length=255)
    stipend = models.CharField(max_length=100)
    duration = models.CharField(max_length=100)  # e.g., "3 months"
    internship_type = models.CharField(max_length=50, choices=INTERNSHIP_TYPE_CHOICES)
    category = models.ForeignKey(
        "jobs.Category", on_delete=models.SET_NULL, null=True, blank=True
    )
    skills_required = models.ManyToManyField(
        "jobs.Skill", related_name="mandatory_internships"
    )
    preferred_skills = models.ManyToManyField(
        "jobs.Skill", related_name="preferred_internships", blank=True
    )
    deadline = models.DateField()
    openings = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.title} at {self.company.name}"
