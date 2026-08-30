from django.db import models
from django.conf import settings


class Connection(models.Model):
    """LinkedIn-style connection between two users."""

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("rejected", "Rejected"),
    )

    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="connections_sent"
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="connections_received"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    message = models.TextField(blank=True, help_text="Personal note with connection request")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("from_user", "to_user")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.from_user.email} -> {self.to_user.email} ({self.status})"


class SkillEndorsement(models.Model):
    """Endorse a connection's skill (LinkedIn-style)."""

    endorser = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="skill_endorsements_given"
    )
    endorsee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="skill_endorsements_received"
    )
    skill = models.ForeignKey("jobs.Skill", on_delete=models.CASCADE, related_name="endorsements")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("endorser", "endorsee", "skill")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.endorser.email} endorsed {self.endorsee.email} for {self.skill.name}"


class Recommendation(models.Model):
    """LinkedIn-style recommendation letter."""

    TYPE_CHOICES = (
        ("given", "Given"),
        ("received", "Received"),
    )

    recommender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recommendations_given"
    )
    recommendee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="recommendations_received"
    )
    relationship = models.CharField(max_length=100, help_text="e.g., 'Colleague at Google'")
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recommender.email} recommends {self.recommendee.email}"


class ProfileView(models.Model):
    """Track who viewed whose profile."""

    viewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profiles_viewed"
    )
    viewed = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile_views"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.viewer.email} viewed {self.viewed.email}'s profile"


class UserFollow(models.Model):
    """Follow a user (without mutual connection)."""

    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following"
    )
    followed = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followers"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("follower", "followed")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.follower.email} follows {self.followed.email}"
