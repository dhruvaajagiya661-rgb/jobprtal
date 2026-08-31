from django.db import models
from django.conf import settings

from portal.validators import validate_resume_file


class Application(models.Model):
    STATUS_CHOICES = (
        ("Applied", "Applied"),
        ("Shortlisted", "Shortlisted"),
        ("Rejected", "Rejected"),
        ("Accepted", "Accepted"),
    )
    job = models.ForeignKey(
        "jobs.Job",
        on_delete=models.CASCADE,
        related_name="applications",
        null=True,
        blank=True,
    )
    internship = models.ForeignKey(
        "internships.Internship",
        on_delete=models.CASCADE,
        related_name="applications",
        null=True,
        blank=True,
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="job_applications",
    )
    resume = models.FileField(
        upload_to="application_resumes/", validators=[validate_resume_file]
    )
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default="Applied")
    applied_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        title = self.job.title if self.job else self.internship.title
        return f"{self.student.email} applied for {title}"
