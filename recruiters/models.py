from django.db import models
from django.conf import settings


class Company(models.Model):
    name = models.CharField(max_length=255)
    logo = models.ImageField(upload_to="company_logos/", null=True, blank=True)
    description = models.TextField()
    industry = models.CharField(max_length=100, null=True, blank=True)
    size = models.CharField(
        max_length=50, null=True, blank=True
    )  # e.g., "50-100 employees"
    website = models.URLField(null=True, blank=True)
    location = models.CharField(max_length=255)
    # LinkedIn-style company page fields
    cover_photo = models.ImageField(upload_to="company_covers/", null=True, blank=True)
    founded_year = models.PositiveIntegerField(null=True, blank=True)
    specialities = models.JSONField(default=list, blank=True, help_text="List of specialities")
    about = models.TextField(blank=True, help_text="Extended company about section")
    mission = models.TextField(blank=True)
    culture = models.TextField(blank=True)
    benefits = models.JSONField(default=list, blank=True, help_text="List of benefits/perks")
    followers_count = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.name


class RecruiterProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="recruiter_profile",
    )
    company = models.ForeignKey(
        Company, on_delete=models.SET_NULL, null=True, blank=True
    )
    designation = models.CharField(max_length=100)

    def __str__(self):
        return (
            f"{self.user.email} - {self.company.name if self.company else 'No Company'}"
        )


class CompanyFollower(models.Model):
    """Follow a company to get updates."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_follows"
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="followers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "company")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} follows {self.company.name}"


class CompanyReview(models.Model):
    """Employee reviews of a company."""

    RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_reviews"
    )
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="reviews")
    title = models.CharField(max_length=200)
    content = models.TextField()
    rating = models.PositiveIntegerField(choices=RATING_CHOICES)
    pros = models.TextField(blank=True)
    cons = models.TextField(blank=True)
    employment_status = models.CharField(
        max_length=50,
        choices=(("current", "Current Employee"), ("former", "Former Employee")),
        default="current",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} review of {self.company.name}"


class SavedCandidate(models.Model):
    """A student a recruiter has bookmarked into their private talent pool.

    Recruiters lose good candidates between postings: someone strong applies
    to a role that is already filled and there is nowhere to keep them. This
    is that shortlist - scoped to the recruiter, not the company, and
    independent of any application's status.
    """

    recruiter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_candidates",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="saved_by_recruiters",
    )
    saved_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ("recruiter", "student")
        ordering = ["-saved_at"]

    def __str__(self):
        return f"{self.recruiter.email} saved {self.student.email}"
