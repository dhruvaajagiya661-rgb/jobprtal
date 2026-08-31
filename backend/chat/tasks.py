"""
Async Celery tasks for PortAL.
Handles email sending, notification digests, and maintenance.
"""

import logging
from datetime import timedelta, datetime
from celery import shared_task
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

logger = logging.getLogger(__name__)


# ─── Email Helpers ─────────────────────────────────────────────


def run_email_task(task, *args, **kwargs):
    """Dispatch an email task, never raising.

    - Production (Redis broker configured): enqueue via ``.delay()`` so the
      HTTP request never blocks on SMTP.
    - Dev (no broker/worker): call the Celery ``shared_task`` directly, which
      executes its body in-process with any ``EMAIL_BACKEND`` (the console
      backend prints to the server log).

    Failures are logged so a broken SMTP config can never 500 a request or
    break registration.
    """
    try:
        if getattr(settings, "USE_REDIS", False):
            return task.delay(*args, **kwargs)
        return task(*args, **kwargs)
    except Exception as e:
        logger.error(f"Email task {getattr(task, '__name__', task)} failed: {e}")
        return False


def _send_html_email(subject, template_name, context, recipient_list, from_email=None):
    """Send an HTML email using a template."""
    from_email = from_email or settings.DEFAULT_FROM_EMAIL
    html_message = render_to_string(f"emails/{template_name}.html", context)
    plain_message = strip_tags(html_message)
    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=from_email,
            recipient_list=recipient_list,
            html_message=html_message,
            fail_silently=False,
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_list}: {e}")
        return False


# ─── User Emails ───────────────────────────────────────────────


@shared_task
def send_welcome_email(user_id):
    """Send welcome email to newly registered users."""
    try:
        user = User.objects.get(id=user_id)
        context = {
            "user": user,
            "is_student": user.is_student,
            "is_recruiter": user.is_recruiter,
            "login_url": f"{settings.SITE_URL}/accounts/login/",
        }
        subject = "Welcome to PortAL - Your Career Journey Starts Here!"
        return _send_html_email(subject, "welcome", context, [user.email])
    except User.DoesNotExist:
        logger.error(f"Welcome email: User {user_id} not found")
        return False


@shared_task
def send_application_status_email(application_id):
    """Send email when application status changes."""
    from applications.models import Application

    try:
        app = Application.objects.select_related("student", "job", "internship").get(
            id=application_id
        )

        title = app.job.title if app.job else app.internship.title
        company = app.job.company.name if app.job else app.internship.company.name

        context = {
            "user": app.student,
            "job_title": title,
            "company_name": company,
            "status": app.status,
            "updated_at": app.updated_at,
            "dashboard_url": f"{settings.SITE_URL}/student/dashboard/",
        }
        subject = f"Application Update: {app.status} - {title} at {company}"
        return _send_html_email(
            subject, "application_status", context, [app.student.email]
        )
    except Application.DoesNotExist:
        logger.error(f"Status email: Application {application_id} not found")
        return False


def send_job_alerts_for_new_job(job, threshold=40):
    """Email students whose profiles match a newly posted job.

    Runs synchronously so alerts work even without a Celery worker. For
    production scale, replace the ``run_email_task`` calls with
    ``send_job_alert_email.delay(...)`` and dispatch this whole function via
    Celery instead.
    """
    from students.models import StudentProfile
    from careers.services import JobMatchingService

    profiles = (
        StudentProfile.objects.filter(user__is_student=True)
        .select_related("user")
        .prefetch_related("skills")
    )
    sent_count = 0
    for profile in profiles:
        score = JobMatchingService.get_match_score(profile, job)
        if score >= threshold:
            run_email_task(send_job_alert_email, profile.user.id, [job.id])
            sent_count += 1
    logger.info(f"Job alert: {sent_count} students emailed for '{job.title}'")
    return sent_count


@shared_task
def send_job_alert_email(user_id, job_ids):
    """Send job alert email with matching jobs to a student."""
    from jobs.models import Job

    try:
        user = User.objects.get(id=user_id)
        jobs = Job.objects.filter(id__in=job_ids, is_active=True).select_related(
            "company"
        )[:10]
        if not jobs:
            return False

        context = {
            "user": user,
            "jobs": jobs,
            "job_list_url": f"{settings.SITE_URL}/jobs/",
        }
        subject = f"🔔 {jobs.count()} New Job Matches for You on PortAL!"
        return _send_html_email(subject, "job_alert", context, [user.email])
    except User.DoesNotExist:
        return False


# ─── Digests ──────────────────────────────────────────────────


@shared_task
def send_daily_job_digests():
    """Send daily digest of new jobs to all students with matching skills."""
    from students.models import StudentProfile
    from jobs.models import Job
    from careers.services import JobMatchingService

    yesterday = datetime.now() - timedelta(days=1)
    new_jobs = Job.objects.filter(created_at__gte=yesterday, is_active=True)

    if not new_jobs.exists():
        logger.info("No new jobs today, skipping digest")
        return "No new jobs, skipped"

    profiles = (
        StudentProfile.objects.select_related("user")
        .filter(user__is_student=True)
        .prefetch_related("skills")
        .only("user_id", "user__email")
        .iterator()
    )

    sent_count = 0
    for profile in profiles:
        matched_jobs = []
        for job in new_jobs:
            score = JobMatchingService.get_match_score(profile, job)
            if score > 40:  # Only high matches
                matched_jobs.append(job.id)

        if matched_jobs:
            send_job_alert_email.delay(profile.user.id, matched_jobs)
            sent_count += 1

    logger.info(f"Sent {sent_count} daily digests")
    return f"Sent {sent_count} digests"


@shared_task
def send_weekly_application_digests():
    """Send weekly summary of application statuses to students."""
    from applications.models import Application

    students = User.objects.filter(is_student=True).only("id", "email").iterator()
    sent_count = 0

    for student in students:
        apps = Application.objects.filter(student=student).select_related(
            "job__company"
        )
        if apps.exists():
            context = {
                "user": student,
                "applications": apps,
                "total_apps": apps.count(),
                "shortlisted": apps.filter(status="Shortlisted").count(),
                "accepted": apps.filter(status="Accepted").count(),
                "dashboard_url": f"{settings.SITE_URL}/student/dashboard/",
            }
            subject = (
                f"📊 Weekly Application Summary - {apps.count()} Active Applications"
            )
            try:
                _send_html_email(subject, "weekly_digest", context, [student.email])
                sent_count += 1
            except Exception as e:
                logger.error(f"Weekly digest failed for {student.email}: {e}")

    return f"Sent {sent_count} weekly digests"


# ─── Maintenance ──────────────────────────────────────────────


@shared_task
def cleanup_old_notifications():
    """Delete notifications older than 90 days."""
    from notifications.models import Notification

    cutoff = datetime.now() - timedelta(days=90)
    deleted, _ = Notification.objects.filter(created_at__lt=cutoff).delete()
    logger.info(f"Cleaned up {deleted} old notifications")
    return f"Cleaned {deleted} notifications"
