from rest_framework import viewsets, permissions, status

from portal.serializers import EmptySerializer
from rest_framework.decorators import action
from rest_framework.response import Response
from portal.query_utils import filter_by_id
from django.db.models import Count, Q
# DRF's get_object_or_404 is the same shortcut but also turns a pk that
# cannot be coerced to the field type (e.g. /courses/abc/) into a 404
# instead of letting the ValueError surface as a 500.
from rest_framework.generics import get_object_or_404
from django.utils import timezone
from calendar import monthrange
from collections import Counter
from datetime import datetime, timedelta

from .serializers import (
    CompanySerializer,
    CompanyUpdateSerializer,
    CompanyPageSerializer,
    CompanyReviewSerializer,
    CompanyFollowerSerializer,
    RecruiterProfileSerializer,
    JobCreateUpdateSerializer,
    InternshipCreateUpdateSerializer,
    SavedCandidateSerializer,
)
from .models import Company, CompanyFollower, CompanyReview, SavedCandidate
from .scoping import (
    application_scope_q,
    posting_scope_kwargs,
    recruiter_company,
    scope_postings,
)
from jobs.models import Job, JobAlert
from jobs.serializers import JobSerializer, JobDetailSerializer, JobAlertSerializer
from internships.models import Internship
from internships.serializers import (
    InternshipListSerializer,
    InternshipDetailSerializer,
)
from applications.models import Application
from applications.serializers import ApplicationSerializer
from notifications.models import Notification
from notifications.services import notify_admins
from chat.tasks import run_email_task, send_application_status_email
from chat.tasks import send_job_alerts_for_new_job

VALID_APPLICATION_STATUSES = {c[0] for c in Application.STATUS_CHOICES}


class IsRecruiter(permissions.BasePermission):
    """Allow access only to recruiter users.

    Every action on RecruiterViewSet already scopes to the caller's company
    (see recruiters/scoping.py), but IsAuthenticated alone let a student call
    them: reads returned an empty shell of the recruiter console, and
    ``create_job`` actually created a Job (plus an auto-provisioned Company)
    owned by the student. Role is enforced here, at the door.
    """

    message = "This endpoint is available to recruiter accounts only."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_recruiter
        )


class RecruiterViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated, IsRecruiter]
    # Actions build their own serializers; named empty default keeps schema generation working.
    serializer_class = EmptySerializer

    @action(detail=False, methods=["get"])
    def me(self, request):
        """Get recruiter profile."""
        profile = getattr(request.user, "recruiter_profile", None)
        if not profile:
            return Response({"error": "Recruiter profile not found"}, status=404)
        serializer = RecruiterProfileSerializer(profile)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def dashboard(self, request):
        """Company hiring overview.

        This is the employer's side of the marketplace, so it answers different
        questions than the student dashboard: not "what am I waiting on" but
        "who is waiting on me". Hence the review queue (applications still in
        Applied, oldest first) and the per-role breakdown, rather than a
        chronological feed of the recruiter's own posts.
        """
        company = recruiter_company(request.user)

        jobs = scope_postings(Job.objects.all(), request.user)
        internships = scope_postings(Internship.objects.all(), request.user)
        my_applications = Application.objects.filter(
            application_scope_q(request.user)
        )

        # One pass for the funnel instead of a COUNT per status.
        totals = my_applications.aggregate(
            total=Count("id"),
            new=Count("id", filter=Q(status="Applied")),
            shortlisted=Count("id", filter=Q(status="Shortlisted")),
            accepted=Count("id", filter=Q(status="Accepted")),
            rejected=Count("id", filter=Q(status="Rejected")),
        )

        today = timezone.localdate()

        def role_rows(queryset, kind, type_field):
            """Annotate a job/internship queryset with its own funnel.

            Job.applicants_count exists on the model but nothing has ever
            incremented it, so it is always 0 - these counts come from the
            applications relation instead.
            """
            annotated = queryset.annotate(
                applicants=Count("applications", distinct=True),
                new_applicants=Count(
                    "applications",
                    filter=Q(applications__status="Applied"),
                    distinct=True,
                ),
                shortlisted=Count(
                    "applications",
                    filter=Q(applications__status="Shortlisted"),
                    distinct=True,
                ),
                accepted=Count(
                    "applications",
                    filter=Q(applications__status="Accepted"),
                    distinct=True,
                ),
            ).order_by("-created_at")

            rows = []
            for role in annotated:
                days_left = (role.deadline - today).days if role.deadline else None
                rows.append(
                    {
                        "id": role.id,
                        "kind": kind,
                        "title": role.title,
                        "location": role.location,
                        "type": getattr(role, type_field, ""),
                        "is_active": role.is_active,
                        "openings": role.openings,
                        "deadline": role.deadline,
                        "days_left": days_left,
                        # A role past its deadline but still flagged active is
                        # the single most common thing recruiters miss.
                        "expired": days_left is not None and days_left < 0,
                        "applicants": role.applicants,
                        "new_applicants": role.new_applicants,
                        "shortlisted": role.shortlisted,
                        "accepted": role.accepted,
                        "created_at": role.created_at,
                    }
                )
            return rows

        roles = role_rows(jobs, "job", "job_type") + role_rows(
            internships, "internship", "internship_type"
        )
        # Busiest first, and unreviewed applicants outrank raw volume - that is
        # the order the recruiter should work down the list in.
        roles.sort(key=lambda r: (r["new_applicants"], r["applicants"]), reverse=True)

        # Applications nobody has triaged yet, longest-waiting first.
        pending = (
            my_applications.filter(status="Applied")
            .select_related("student", "job", "internship")
            .order_by("applied_at")[:8]
        )
        needs_review = []
        for app in pending:
            role = app.job or app.internship
            needs_review.append(
                {
                    "id": app.id,
                    "student": app.student.username or app.student.email,
                    "student_email": app.student.email,
                    "position": role.title if role else None,
                    "kind": "job" if app.job else "internship",
                    "applied_at": app.applied_at,
                    "days_waiting": (timezone.now() - app.applied_at).days,
                    "resume": app.resume.url if app.resume else None,
                }
            )

        # Applicants received per month, last 12 months. Mirrors the student
        # dashboard's monthly_activity so both charts read the same way.
        now = timezone.now()
        monthly_applicants = []
        for i in range(11, -1, -1):
            m = now.month - i
            yr = now.year
            if m <= 0:
                m += 12
                yr -= 1
            _, days_in_month = monthrange(yr, m)
            month_start = timezone.make_aware(datetime(yr, m, 1))
            month_end = month_start + timedelta(days=days_in_month)
            monthly_applicants.append(
                {
                    "month": month_start.strftime("%b"),
                    "count": my_applications.filter(
                        applied_at__gte=month_start, applied_at__lt=month_end
                    ).count(),
                }
            )

        return Response(
            {
                "company": CompanySerializer(
                    company, context={"request": request}
                ).data
                if company
                else None,
                "jobs_count": jobs.count(),
                "internships_count": internships.count(),
                "active_roles": jobs.filter(is_active=True).count()
                + internships.filter(is_active=True).count(),
                "total_applicants": totals["total"],
                "new_count": totals["new"],
                "shortlisted_count": totals["shortlisted"],
                "accepted_count": totals["accepted"],
                "rejected_count": totals["rejected"],
                "monthly_applicants": monthly_applicants,
                "needs_review": needs_review,
                "roles": roles,
            }
        )

    @action(detail=False, methods=["get", "patch"])
    def company(self, request):
        """
        Get or update company profile.

        Recruiters who signed up without a company (or whose company was
        never set) previously got a 404 here and a 500 when posting jobs.
        Instead, GET returns an empty template the UI can edit, and PATCH
        creates the company on demand and links it to the recruiter.
        """
        profile = getattr(request.user, "recruiter_profile", None)
        if not profile:
            return Response(
                {"error": "Recruiter profile not found"}, status=404
            )

        company = profile.company
        if request.method == "GET":
            if company is None:
                return Response(
                    {
                        "id": None,
                        "name": "",
                        "industry": "",
                        "location": "",
                        "website": "",
                        "description": "",
                        "size": "",
                        "logo": None,
                    }
                )
            serializer = CompanySerializer(company)
            return Response(serializer.data)
        else:  # PATCH
            created_on_demand = False
            if company is None:
                # Create with the required fields so we can validate against a
                # real instance; only attach it to the recruiter after a
                # successful save so a failed validation doesn't leave a
                # half-created company behind.
                company = Company.objects.create(
                    name=request.data.get("name")
                    or f"{request.user.username}'s Company",
                    description=request.data.get("description", ""),
                    location=request.data.get("location", ""),
                )
                created_on_demand = True
            serializer = CompanyUpdateSerializer(
                company, data=request.data, partial=True
            )
            if serializer.is_valid():
                serializer.save()
                if created_on_demand:
                    profile.company = company
                    profile.save(update_fields=["company"])
                return Response(CompanySerializer(company).data)
            if created_on_demand:
                company.delete()
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def jobs(self, request):
        """Every job posted by this recruiter's company."""
        jobs = scope_postings(Job.objects.all(), request.user).order_by("-created_at")
        serializer = JobSerializer(jobs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def internships(self, request):
        """Every internship posted by this recruiter's company."""
        internships = scope_postings(
            Internship.objects.all(), request.user
        ).order_by("-created_at")
        serializer = InternshipListSerializer(internships, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def create_job(self, request):
        """Create a new job posting."""
        serializer = JobCreateUpdateSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            job = serializer.save()
            notify_admins(
                "New Job Posted",
                f"{request.user.username} ({request.user.email}) posted a new job: {job.title}",
            )
            # Job alerts to matching students (async when Redis is configured,
            # in-process otherwise; never blocks or fails the request).
            send_job_alerts_for_new_job(job)
            return Response(JobSerializer(job).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["patch"])
    def update_job(self, request):
        """Update a job posting."""
        job = get_object_or_404(
            Job, pk=request.data.get("job_id"), **posting_scope_kwargs(request.user)
        )
        serializer = JobSerializer(job, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["delete"])
    def delete_job(self, request):
        """Delete a job posting."""
        job_id = request.data.get("job_id")
        if not job_id:
            return Response({"error": "job_id is required"}, status=400)
        job = get_object_or_404(
            Job, pk=job_id, **posting_scope_kwargs(request.user)
        )
        job.delete()
        return Response({"message": "Job deleted"}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], url_path="job_detail")
    def job_detail(self, request):
        """Full detail for one of the recruiter's own jobs.

        The public /jobs/{id}/ endpoint only serves active postings, so a
        closed job could not be read back for editing or duplication. This
        one is scoped by ownership instead of by is_active.
        """
        job_id = request.query_params.get("job_id")
        if not job_id:
            return Response({"error": "job_id is required"}, status=400)
        job = get_object_or_404(
            Job, pk=job_id, **posting_scope_kwargs(request.user)
        )
        return Response(
            JobDetailSerializer(job, context={"request": request}).data
        )

    @action(detail=False, methods=["get"], url_path="internship_detail")
    def internship_detail(self, request):
        """Full detail for one of the recruiter's own internships."""
        internship_id = request.query_params.get("internship_id")
        if not internship_id:
            return Response({"error": "internship_id is required"}, status=400)
        internship = get_object_or_404(
            Internship, pk=internship_id, **posting_scope_kwargs(request.user)
        )
        return Response(
            InternshipDetailSerializer(
                internship, context={"request": request}
            ).data
        )

    @action(detail=False, methods=["post"])
    def create_internship(self, request):
        """Create a new internship posting."""
        serializer = InternshipCreateUpdateSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            internship = serializer.save()
            notify_admins(
                "New Internship Posted",
                f"{request.user.username} ({request.user.email}) posted a new "
                f"internship: {internship.title}",
            )
            return Response(
                InternshipDetailSerializer(
                    internship, context={"request": request}
                ).data,
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["patch"])
    def update_internship(self, request):
        """Update an internship posting."""
        internship = get_object_or_404(
            Internship,
            pk=request.data.get("internship_id"),
            **posting_scope_kwargs(request.user),
        )
        serializer = InternshipCreateUpdateSerializer(
            internship, data=request.data, partial=True, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(
                InternshipDetailSerializer(
                    internship, context={"request": request}
                ).data
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["delete"])
    def delete_internship(self, request):
        """Delete an internship posting."""
        internship_id = request.data.get("internship_id")
        if not internship_id:
            return Response({"error": "internship_id is required"}, status=400)
        internship = get_object_or_404(
            Internship, pk=internship_id, **posting_scope_kwargs(request.user)
        )
        internship.delete()
        return Response(
            {"message": "Internship deleted"}, status=status.HTTP_204_NO_CONTENT
        )

    # ---- Talent pool -------------------------------------------------

    @action(detail=False, methods=["get"])
    def saved_candidates(self, request):
        """The recruiter's private shortlist of students."""
        qs = (
            SavedCandidate.objects.filter(recruiter=request.user)
            .select_related("student", "student__student_profile")
            .prefetch_related("student__student_profile__skills")
        )
        serializer = SavedCandidateSerializer(
            qs, many=True, context={"request": request}
        )
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def save_candidate(self, request):
        """Add a student to the talent pool (idempotent).

        Re-posting for an already-saved student updates the note rather than
        erroring, so the "Save candidate" button can double as "edit note".
        """
        student_id = request.data.get("student_id")
        if not student_id:
            return Response({"error": "student_id is required"}, status=400)

        from django.contrib.auth import get_user_model

        student = get_object_or_404(
            get_user_model(), pk=student_id, is_student=True, is_active=True
        )
        saved, created = SavedCandidate.objects.get_or_create(
            recruiter=request.user,
            student=student,
            defaults={"notes": request.data.get("notes", "")},
        )
        if not created and "notes" in request.data:
            saved.notes = request.data.get("notes") or ""
            saved.save(update_fields=["notes"])

        return Response(
            {
                "saved": True,
                "created": created,
                "candidate": SavedCandidateSerializer(
                    saved, context={"request": request}
                ).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["delete"])
    def unsave_candidate(self, request):
        """Remove a student from the talent pool."""
        student_id = request.data.get("student_id")
        if not student_id:
            return Response({"error": "student_id is required"}, status=400)
        deleted, _ = SavedCandidate.objects.filter(
            recruiter=request.user, student_id=student_id
        ).delete()
        if not deleted:
            return Response({"error": "Candidate is not saved"}, status=404)
        return Response({"saved": False})

    # ---- Analytics ---------------------------------------------------

    @action(detail=False, methods=["get"])
    def analytics(self, request):
        """Hiring analytics beyond the dashboard's headline counts.

        Everything here is derived from the recruiter's own postings and the
        applications against them; nothing is precomputed or cached, so the
        numbers always match what /dashboard shows.
        """
        jobs = scope_postings(Job.objects.all(), request.user)
        internships = scope_postings(Internship.objects.all(), request.user)
        applications = Application.objects.filter(
            application_scope_q(request.user)
        )

        totals = applications.aggregate(
            applied=Count("id"),
            shortlisted=Count("id", filter=Q(status="Shortlisted")),
            accepted=Count("id", filter=Q(status="Accepted")),
            rejected=Count("id", filter=Q(status="Rejected")),
        )

        # A candidate who was accepted necessarily passed through shortlisting,
        # and everyone in the system applied - so each funnel stage counts the
        # applications that reached *at least* that far, which is what makes
        # the stages monotonically decreasing.
        applied = totals["applied"]
        reached_shortlist = totals["shortlisted"] + totals["accepted"]
        reached_accept = totals["accepted"]

        def pct(part, whole):
            return round(part / whole * 100, 1) if whole else 0.0

        funnel = [
            {
                "stage": "Applied",
                "count": applied,
                "percent": 100.0 if applied else 0.0,
                "drop_off": None,
            },
            {
                "stage": "Shortlisted",
                "count": reached_shortlist,
                "percent": pct(reached_shortlist, applied),
                "drop_off": applied - reached_shortlist,
            },
            {
                "stage": "Accepted",
                "count": reached_accept,
                "percent": pct(reached_accept, applied),
                "drop_off": reached_shortlist - reached_accept,
            },
        ]

        # ---- Time to fill ----
        # Days from the posting going live to its first acceptance. Only roles
        # that actually produced a hire can contribute; averaging over open
        # roles would make a slow month look fast.
        filled = (
            applications.filter(status="Accepted")
            .select_related("job", "internship")
            .order_by("updated_at")
        )
        seen_roles = set()
        fill_times = []
        for app in filled:
            role = app.job or app.internship
            if role is None:
                continue
            key = ("job" if app.job else "internship", role.id)
            if key in seen_roles:
                continue
            seen_roles.add(key)
            days = (app.updated_at - role.created_at).days
            fill_times.append(
                {
                    "role": role.title,
                    "kind": key[0],
                    "id": role.id,
                    "days": max(days, 0),
                }
            )

        avg_time_to_fill = (
            round(sum(f["days"] for f in fill_times) / len(fill_times), 1)
            if fill_times
            else None
        )
        fastest = min(fill_times, key=lambda f: f["days"]) if fill_times else None
        slowest = max(fill_times, key=lambda f: f["days"]) if fill_times else None

        # ---- Top performing listings ----
        def listing_rows(queryset, kind):
            annotated = queryset.annotate(
                applicants=Count("applications", distinct=True),
                shortlisted=Count(
                    "applications",
                    filter=Q(applications__status="Shortlisted"),
                    distinct=True,
                ),
                accepted=Count(
                    "applications",
                    filter=Q(applications__status="Accepted"),
                    distinct=True,
                ),
            )
            return [
                {
                    "id": row.id,
                    "kind": kind,
                    "title": row.title,
                    "location": row.location,
                    "is_active": row.is_active,
                    "applicants": row.applicants,
                    "shortlisted": row.shortlisted,
                    "accepted": row.accepted,
                    "created_at": row.created_at,
                }
                for row in annotated
            ]

        listings = listing_rows(jobs, "job") + listing_rows(internships, "internship")
        listings.sort(key=lambda r: (r["applicants"], r["accepted"]), reverse=True)
        top_listings = listings[:5]

        # ---- Skills most asked for across the recruiter's own listings ----
        skill_counts = Counter()
        for names in (
            jobs.values_list("skills_required__name", flat=True),
            internships.values_list("skills_required__name", flat=True),
        ):
            skill_counts.update(name for name in names if name)
        listings_total = len(listings)
        top_skills = [
            {
                "skill": name,
                "count": count,
                "percent": pct(count, listings_total),
            }
            for name, count in skill_counts.most_common(8)
        ]

        # ---- Month over month ----
        now = timezone.now()
        this_month_start = timezone.make_aware(datetime(now.year, now.month, 1))
        prev_year = now.year if now.month > 1 else now.year - 1
        prev_month = now.month - 1 if now.month > 1 else 12
        last_month_start = timezone.make_aware(datetime(prev_year, prev_month, 1))

        this_month = applications.filter(applied_at__gte=this_month_start).count()
        last_month = applications.filter(
            applied_at__gte=last_month_start, applied_at__lt=this_month_start
        ).count()
        if last_month:
            change = round((this_month - last_month) / last_month * 100, 1)
        else:
            # No baseline to divide by: any applicants at all is "new", none
            # is flat - reporting +100% off a zero month would be misleading.
            change = 100.0 if this_month else 0.0

        return Response(
            {
                "funnel": funnel,
                "shortlist_rate": pct(reached_shortlist, applied),
                "offer_rate": pct(reached_accept, applied),
                "time_to_fill": {
                    "average_days": avg_time_to_fill,
                    "roles_filled": len(fill_times),
                    "fastest": fastest,
                    "slowest": slowest,
                },
                "top_listings": top_listings,
                "top_skills": top_skills,
                "month_over_month": {
                    "this_month": this_month,
                    "last_month": last_month,
                    "change_percent": change,
                    "this_month_label": this_month_start.strftime("%B %Y"),
                    "last_month_label": last_month_start.strftime("%B %Y"),
                },
            }
        )

    # ---- Public recruiter profile ------------------------------------

    @action(
        detail=False,
        methods=["get"],
        url_path=r"public/(?P<recruiter_id>[^/.]+)",
        permission_classes=[permissions.AllowAny],
    )
    def public(self, request, recruiter_id=None):
        """Public-facing profile for a recruiter, by user id.

        Signed out visitors land here from a job listing, so it is AllowAny
        and deliberately narrow: who this person is, who they hire for, and
        what they currently have open. Only active postings are listed - a
        closed role is internal bookkeeping, not a public advert.
        """
        try:
            user_id = int(recruiter_id)
        except (TypeError, ValueError):
            return Response({"error": "Invalid recruiter id"}, status=400)

        from django.contrib.auth import get_user_model

        user = (
            get_user_model()
            .objects.filter(id=user_id, is_recruiter=True, is_active=True)
            .select_related("recruiter_profile__company")
            .first()
        )
        if user is None:
            return Response({"error": "Recruiter not found"}, status=404)

        profile = getattr(user, "recruiter_profile", None)
        company = profile.company if profile else None

        open_jobs = (
            Job.objects.filter(recruiter=user, is_active=True)
            .select_related("company", "category")
            .prefetch_related("skills_required")
            .order_by("-created_at")[:20]
        )
        open_internships = (
            Internship.objects.filter(recruiter=user, is_active=True)
            .select_related("company", "category")
            .prefetch_related("skills_required")
            .order_by("-created_at")[:20]
        )

        reviews = []
        if company is not None:
            reviews = CompanyReviewSerializer(
                CompanyReview.objects.filter(company=company).select_related("user")[
                    :10
                ],
                many=True,
            ).data

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.get_full_name() or user.username,
                "designation": profile.designation if profile else "",
                "company": CompanySerializer(
                    company, context={"request": request}
                ).data
                if company
                else None,
                # Company followers, not personal ones: candidates follow the
                # employer brand, and that is the number worth showing here.
                "followers_count": company.followers_count if company else 0,
                "reviews": reviews,
                "average_rating": round(
                    sum(r["rating"] for r in reviews) / len(reviews), 1
                )
                if reviews
                else None,
                "jobs": JobSerializer(
                    open_jobs, many=True, context={"request": request}
                ).data,
                "internships": InternshipListSerializer(
                    open_internships, many=True, context={"request": request}
                ).data,
            }
        )

    @action(detail=False, methods=["get"])
    def applicants(self, request):
        """Get all applicants for this recruiter's jobs and internships.

        Optional query params, all combinable:
          - job_id / internship_id: scope to one posting
          - search: match student name (first/last/username) or email
          - skill: match students whose profile lists the skill
          - status: exact application status
        """
        qs = Application.objects.filter(application_scope_q(request.user))
        job_id = request.query_params.get("job_id")
        internship_id = request.query_params.get("internship_id")
        if job_id:
            qs, invalid = filter_by_id(qs, job_id=job_id)
        elif internship_id:
            qs, invalid = filter_by_id(qs, internship_id=internship_id)
        else:
            invalid = []
        if invalid:
            return Response(
                {"error": f"{', '.join(invalid)} must be a number"}, status=400
            )

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
                | Q(student__username__icontains=search)
                | Q(student__email__icontains=search)
            )

        skill = request.query_params.get("skill", "").strip()
        if skill:
            qs = qs.filter(
                Q(student__student_profile__skills__name__icontains=skill)
            )

        status_val = request.query_params.get("status", "").strip()
        if status_val:
            qs = qs.filter(status=status_val)

        # Prefetch student profile + skills so serializing student_skills
        # doesn't run 2 extra queries per applicant (N+1).
        qs = qs.select_related(
            "student", "student__student_profile"
        ).prefetch_related("student__student_profile__skills")

        serializer = ApplicationSerializer(
            # .distinct() de-duplicates rows when the skill filter joins the
            # M2M skills table (one row per matching skill).
            qs.distinct().order_by("-applied_at"),
            many=True,
        )
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def update_application_status(self, request):
        """Update the status of an application."""
        app_id = request.data.get("application_id")
        status_val = request.data.get("status")

        if not app_id or not status_val:
            return Response(
                {"error": "application_id and status are required"}, status=400
            )

        if status_val not in VALID_APPLICATION_STATUSES:
            return Response(
                {
                    "error": "Invalid status. Choose from: "
                    + ", ".join(sorted(VALID_APPLICATION_STATUSES))
                },
                status=400,
            )

        application = get_object_or_404(
            Application,
            application_scope_q(request.user),
            id=app_id,
        )
        application.status = status_val
        application.save()

        title = (
            application.job.title
            if application.job
            else application.internship.title
        )
        # Create notification
        Notification.objects.create(
            user=application.student,
            title="Application Status Updated",
            message=f"Your application for {title} has been updated to: {status_val}",
        )
        notify_admins(
            "Application Status Updated",
            f"Application by {application.student.email} for {title} was set to: {status_val}",
        )

        # Status-change email to the applicant (never blocks or raises).
        run_email_task(send_application_status_email, application.id)

        return Response(
            {
                "message": f"Status updated to {status_val}",
                "application": ApplicationSerializer(application).data,
            }
        )


class CompanyPageViewSet(viewsets.GenericViewSet):
    """Public company page endpoints."""
    permission_classes = [permissions.AllowAny]
    serializer_class = CompanyPageSerializer

    def list(self, request):
        """List companies with optional search."""
        queryset = Company.objects.all()
        q = request.query_params.get("q", "").strip()
        industry = request.query_params.get("industry", "").strip()
        if q:
            queryset = queryset.filter(name__icontains=q)
        if industry:
            queryset = queryset.filter(industry__icontains=industry)
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = CompanyPageSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)
        serializer = CompanyPageSerializer(queryset[:50], many=True, context={"request": request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        company = get_object_or_404(Company, pk=pk)
        serializer = CompanyPageSerializer(company, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def follow(self, request, pk=None):
        """Follow/unfollow a company."""
        company = get_object_or_404(Company, pk=pk)
        follow, created = CompanyFollower.objects.get_or_create(
            user=request.user, company=company
        )
        if not created:
            follow.delete()
            company.followers_count = max(0, company.followers_count - 1)
            company.save(update_fields=["followers_count"])
            return Response({"following": False})
        company.followers_count += 1
        company.save(update_fields=["followers_count"])
        return Response({"following": True})

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def review(self, request, pk=None):
        """Add a review to a company."""
        company = get_object_or_404(Company, pk=pk)
        serializer = CompanyReviewSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user, company=company)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=["get"])
    def reviews(self, request, pk=None):
        """Get reviews for a company."""
        company = get_object_or_404(Company, pk=pk)
        reviews = CompanyReview.objects.filter(company=company).select_related("user")
        serializer = CompanyReviewSerializer(reviews, many=True)
        return Response(serializer.data)


class JobAlertViewSet(viewsets.GenericViewSet):
    """Job alerts for students."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = JobAlertSerializer

    def list(self, request):
        alerts = JobAlert.objects.filter(user=request.user)
        serializer = JobAlertSerializer(alerts, many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = JobAlertSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    def destroy(self, request, pk=None):
        alert = get_object_or_404(JobAlert, pk=pk, user=request.user)
        alert.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"])
    def toggle(self, request, pk=None):
        """Toggle alert active status."""
        alert = get_object_or_404(JobAlert, pk=pk, user=request.user)
        alert.is_active = not alert.is_active
        alert.save(update_fields=["is_active"])
        return Response({"is_active": alert.is_active})
