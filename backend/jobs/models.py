from django.db import models
from django.conf import settings


class Job(models.Model):
    JOB_TYPE_CHOICES = (
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
    salary = models.CharField(max_length=100)
    job_type = models.CharField(max_length=50, choices=JOB_TYPE_CHOICES)
    category = models.ForeignKey(
        "jobs.Category", on_delete=models.SET_NULL, null=True, blank=True
    )
    skills_required = models.ManyToManyField(
        "jobs.Skill", related_name="mandatory_jobs"
    )
    preferred_skills = models.ManyToManyField(
        "jobs.Skill", related_name="preferred_jobs", blank=True
    )
    experience_required = models.CharField(max_length=100)
    deadline = models.DateField()
    openings = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    # Easy apply: one-click apply with profile resume
    easy_apply = models.BooleanField(default=False)
    applicants_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.title} at {self.company.name}"


class Skill(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class SavedJob(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_jobs"
    )
    job = models.ForeignKey(Job, on_delete=models.CASCADE)
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "job")

    def __str__(self):
        return f"{self.user.email} saved {self.job.title}"


class JobAlert(models.Model):
    """Alert for new jobs matching certain criteria."""

    FREQUENCY_CHOICES = (
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("instant", "Instant"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="job_alerts"
    )
    title = models.CharField(max_length=200, blank=True, help_text="Custom name for this alert")
    keywords = models.CharField(max_length=300, blank=True, help_text="Search keywords")
    location = models.CharField(max_length=255, blank=True)
    job_type = models.CharField(max_length=50, blank=True)
    category = models.ForeignKey(
        "jobs.Category", on_delete=models.SET_NULL, null=True, blank=True
    )
    skills = models.ManyToManyField("jobs.Skill", blank=True)
    min_salary = models.PositiveIntegerField(null=True, blank=True)
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default="daily")
    is_active = models.BooleanField(default=True)
    last_sent = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Alert for {self.user.email}: {self.title or self.keywords}"
