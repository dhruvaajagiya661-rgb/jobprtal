"""Public site endpoints: platform statistics and the contact form.

These back the marketing surface of the site (home page counters, the
/contact page). Everything here is deliberately unauthenticated, so each
endpoint is either cached or throttled.
"""

import logging

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

STATS_CACHE_KEY = "portal:platform_stats:v1"
STATS_CACHE_SECONDS = 300


class PlatformStatsAPIView(APIView):
    """Real counts for the public site — never hardcoded marketing numbers.

    Cached for five minutes: the home page hits this on every visit and the
    numbers only need to be approximately fresh.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        cached = cache.get(STATS_CACHE_KEY)
        if cached is not None:
            return Response(cached)

        from django.contrib.auth import get_user_model
        from internships.models import Internship
        from jobs.models import Job
        from recruiters.models import Company

        User = get_user_model()
        today = timezone.now().date()
        open_jobs = Job.objects.filter(is_active=True, deadline__gte=today)
        open_internships = Internship.objects.filter(
            is_active=True, deadline__gte=today
        )

        categories = list(
            open_jobs.filter(category__isnull=False)
            .values("category__id", "category__name")
            .annotate(count=Count("id"))
            .order_by("-count")[:8]
        )

        payload = {
            "jobs": open_jobs.count(),
            "internships": open_internships.count(),
            "companies": Company.objects.filter(
                Q(job__is_active=True) | Q(internship__is_active=True)
            )
            .distinct()
            .count(),
            "students": User.objects.filter(is_student=True, is_active=True).count(),
            "recruiters": User.objects.filter(
                is_recruiter=True, is_active=True
            ).count(),
            "categories": [
                {
                    "id": row["category__id"],
                    "name": row["category__name"],
                    "count": row["count"],
                }
                for row in categories
            ],
            "generated_at": timezone.now().isoformat(),
        }

        cache.set(STATS_CACHE_KEY, payload, STATS_CACHE_SECONDS)
        return Response(payload)


class ContactAPIView(APIView):
    """Accept a message from the public contact form and email it to support.

    Throttled per IP (the `contact` scope) because it is unauthenticated and
    sends mail. Delivery failures are logged and surfaced as a 502 rather than
    silently swallowed, so the form never claims success it did not achieve.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "contact"

    MAX_LENGTHS = {"name": 120, "email": 254, "subject": 150, "message": 5000}

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        cleaned, errors = {}, {}

        for field, limit in self.MAX_LENGTHS.items():
            value = str(data.get(field, "") or "").strip()
            if not value:
                errors[field] = "This field is required."
            elif len(value) > limit:
                errors[field] = f"Keep this under {limit} characters."
            else:
                cleaned[field] = value

        if "email" in cleaned:
            try:
                validate_email(cleaned["email"])
            except ValidationError:
                errors["email"] = "Enter a valid email address."

        if errors:
            return Response(
                {"detail": "Please correct the highlighted fields.", "errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        body = (
            f"New contact message from {settings.SITE_URL}\n\n"
            f"Name:    {cleaned['name']}\n"
            f"Email:   {cleaned['email']}\n"
            f"Subject: {cleaned['subject']}\n\n"
            f"{cleaned['message']}\n"
        )

        try:
            send_mail(
                subject=f"[PortAL contact] {cleaned['subject']}",
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.CONTACT_EMAIL],
                fail_silently=False,
            )
        except Exception:
            logger.exception("Contact form delivery failed")
            return Response(
                {
                    "detail": "We could not send your message right now. "
                    f"Please email us directly at {settings.CONTACT_EMAIL}."
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

        logger.info("Contact message received from %s", cleaned["email"])
        return Response(
            {"detail": "Thanks — your message is on its way. We reply within 2 business days."},
            status=status.HTTP_201_CREATED,
        )
