"""
Celery configuration for PortAL.
Handles async tasks: email sending, notification digests, data processing.
"""

import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "portal.settings")

app = Celery("portal")

# Using Redis as the broker
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks from all registered Django apps
app.autodiscover_tasks()

# Periodic task schedule
app.conf.beat_schedule = {
    "send-daily-job-digests": {
        "task": "chat.tasks.send_daily_job_digests",
        "schedule": crontab(hour=8, minute=0),  # Every day at 8 AM
    },
    "send-weekly-application-digests": {
        "task": "chat.tasks.send_weekly_application_digests",
        "schedule": crontab(
            hour=10, minute=0, day_of_week="monday"
        ),  # Every Monday 10 AM
    },
    "cleanup-old-notifications": {
        "task": "chat.tasks.cleanup_old_notifications",
        "schedule": crontab(hour=3, minute=0, day_of_month="1"),  # 1st of each month
    },
}


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")
