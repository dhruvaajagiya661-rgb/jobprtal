from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from accounts.models import CustomUser
from applications.models import Application
from internships.models import Internship
from jobs.models import Job
from recruiters.models import Company, RecruiterProfile
from students.models import StudentProfile


def get_current_metrics():
    return {
        "total_users": CustomUser.objects.count(),
        "total_students": StudentProfile.objects.count(),
        "total_recruiters": RecruiterProfile.objects.count(),
        "total_companies": Company.objects.count(),
        "total_jobs": Job.objects.count(),
        "total_internships": Internship.objects.count(),
        "total_applications": Application.objects.count(),
    }


def broadcast_metrics():
    channel_layer = get_channel_layer()
    metrics = get_current_metrics()
    async_to_sync(channel_layer.group_send)(
        "admin_analytics", {"type": "metric_update", **metrics}
    )


def broadcast_activity(message):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "admin_analytics",
        {
            "type": "activity_log",
            "timestamp": timezone.now().strftime("%H:%M:%S"),
            "message": message,
        },
    )


@receiver(post_save, sender=CustomUser)
def user_activity(sender, instance, created, **kwargs):
    if created:
        broadcast_metrics()
        broadcast_activity(f"New user registered: {instance.email}")


@receiver(post_save, sender=Job)
def job_activity(sender, instance, created, **kwargs):
    if created:
        broadcast_metrics()
        broadcast_activity(
            f"New job posted: {instance.title} by {instance.company.name}"
        )


@receiver(post_save, sender=Application)
def application_activity(sender, instance, created, **kwargs):
    if created:
        broadcast_metrics()
        title = "Unknown Opportunity"
        if instance.job:
            title = instance.job.title
        elif instance.internship:
            title = instance.internship.title
        broadcast_activity(f"New application received for {title}")
