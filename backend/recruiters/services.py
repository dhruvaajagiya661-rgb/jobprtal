"""
Recruiter Analytics Service.
Provides hiring funnel data, salary trends, time-to-hire metrics, and export functions.
"""

import csv
import io
from datetime import datetime
from collections import Counter, defaultdict
from django.db.models import Q
from django.template.loader import render_to_string
from django.utils import timezone
from applications.models import Application
from jobs.models import Job
from students.models import StudentProfile


class RecruiterAnalyticsService:
    """
    Enterprise-grade analytics for recruiter hiring operations.
    Provides funnel analysis, trend data, salary insights, and exports.
    """

    def __init__(self, recruiter):
        # Analytics report on the company, matching what the dashboard and the
        # applicant list show -- see recruiters/scoping.py.
        from .scoping import application_scope_q, scope_postings

        self.recruiter = recruiter
        self.jobs = scope_postings(Job.objects.all(), recruiter)
        self.applications = Application.objects.filter(
            application_scope_q(recruiter)
        )

    # ─── Hiring Funnel ────────────────────────────────────────

    def get_hiring_funnel(self):
        """
        Get the hiring pipeline breakdown.
        Returns counts at each stage of the funnel.
        """
        total = self.applications.count()
        shortlisted = self.applications.filter(status="Shortlisted").count()
        rejected = self.applications.filter(status="Rejected").count()
        accepted = self.applications.filter(status="Accepted").count()
        pending = self.applications.filter(status="Applied").count()

        # Conversion rates
        shortlist_rate = round((shortlisted / total * 100), 1) if total > 0 else 0
        acceptance_rate = round((accepted / total * 100), 1) if total > 0 else 0
        rejection_rate = round((rejected / total * 100), 1) if total > 0 else 0

        return {
            "total": total,
            "pending": pending,
            "shortlisted": shortlisted,
            "rejected": rejected,
            "accepted": accepted,
            "shortlist_rate": shortlist_rate,
            "acceptance_rate": acceptance_rate,
            "rejection_rate": rejection_rate,
        }

    def get_funnel_by_job(self):
        """Get hiring funnel broken down by each job posting."""
        funnel_data = []
        for job in self.jobs.prefetch_related("applications"):
            apps = job.applications.all()
            total = apps.count()
            if total == 0:
                continue
            funnel_data.append(
                {
                    "job_id": job.id,
                    "job_title": job.title,
                    "total": total,
                    "shortlisted": apps.filter(status="Shortlisted").count(),
                    "rejected": apps.filter(status="Rejected").count(),
                    "accepted": apps.filter(status="Accepted").count(),
                    "pending": apps.filter(status="Applied").count(),
                }
            )
        return funnel_data

    def get_monthly_trends(self, months=12):
        """Get monthly application trends for the last N months."""
        now = timezone.now()
        monthly_data = []

        for i in range(months - 1, -1, -1):
            m = now.month - i
            yr = now.year
            if m <= 0:
                m += 12
                yr -= 1

            month_start = timezone.make_aware(datetime(yr, m, 1))
            if m == 12:
                month_end = timezone.make_aware(datetime(yr + 1, 1, 1))
            else:
                month_end = timezone.make_aware(datetime(yr, m + 1, 1))

            apps_month = self.applications.filter(
                applied_at__gte=month_start, applied_at__lt=month_end
            )
            shortlisted = apps_month.filter(status="Shortlisted").count()
            accepted = apps_month.filter(status="Accepted").count()

            monthly_data.append(
                {
                    "month": month_start.strftime("%b %Y"),
                    "month_short": month_start.strftime("%b"),
                    "applications": apps_month.count(),
                    "shortlisted": shortlisted,
                    "accepted": accepted,
                }
            )

        return monthly_data

    # ─── Salary Analytics ─────────────────────────────────────

    def get_salary_analytics(self):
        """Analyze salary trends across the recruiter's jobs."""
        salary_data = []
        for job in self.jobs.filter(is_active=True):
            # Parse salary range
            salary_str = job.salary
            salary_min = None
            salary_max = None
            try:
                if "-" in salary_str:
                    parts = (
                        salary_str.replace("$", "")
                        .replace("K", "")
                        .replace(",", "")
                        .split("-")
                    )
                    salary_min = (
                        int(parts[0].strip()) if parts[0].strip().isdigit() else None
                    )
                    salary_max = (
                        int(parts[1].strip())
                        if len(parts) > 1 and parts[1].strip().isdigit()
                        else None
                    )
                else:
                    # Single value
                    val = (
                        salary_str.replace("$", "")
                        .replace("K", "")
                        .replace(",", "")
                        .strip()
                    )
                    if val.isdigit():
                        salary_min = int(val)
                        salary_max = salary_min
            except (ValueError, IndexError):
                pass

            salary_data.append(
                {
                    "title": job.title,
                    "salary": job.salary,
                    "salary_min": salary_min,
                    "salary_max": salary_max,
                    "job_type": job.job_type,
                    "location": job.location,
                    "applicants": job.applications.count(),
                }
            )

        # Compute benchmarks
        valid_salaries = [s for s in salary_data if s["salary_min"] and s["salary_max"]]
        avg_min = (
            sum(s["salary_min"] for s in valid_salaries) / len(valid_salaries)
            if valid_salaries
            else 0
        )
        avg_max = (
            sum(s["salary_max"] for s in valid_salaries) / len(valid_salaries)
            if valid_salaries
            else 0
        )

        # By job type
        by_type = defaultdict(list)
        for s in salary_data:
            if s["salary_min"]:
                by_type[s["job_type"]].append(s["salary_min"])

        type_averages = {}
        for jt, vals in by_type.items():
            type_averages[jt] = {
                "avg": round(sum(vals) / len(vals)),
                "min": min(vals),
                "max": max(vals),
                "count": len(vals),
            }

        return {
            "jobs": salary_data,
            "avg_min": round(avg_min),
            "avg_max": round(avg_max),
            "total_salary_jobs": len(valid_salaries),
            "by_type": type_averages,
            "highest_paying": (
                max(valid_salaries, key=lambda s: s["salary_max"])
                if valid_salaries
                else None
            ),
            "lowest_paying": (
                min(valid_salaries, key=lambda s: s["salary_min"])
                if valid_salaries
                else None
            ),
        }

    # ─── Time Analytics ───────────────────────────────────────

    def get_time_analytics(self):
        """Analyze time-to-hire and response times."""
        now = timezone.now()

        # Average time applications have been pending
        pending_apps = self.applications.filter(status="Applied")
        if pending_apps.exists():
            avg_pending_days = (
                sum((now - app.applied_at).days for app in pending_apps)
                / pending_apps.count()
            )
        else:
            avg_pending_days = 0

        # Response rate (how many got a status change)
        total = self.applications.count()
        responded = self.applications.exclude(status="Applied").count()
        response_rate = round((responded / total * 100), 1) if total > 0 else 0

        # Applications by day of week
        day_names = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]
        day_counts = [0] * 7
        for app in self.applications.all():
            day_counts[app.applied_at.weekday()] += 1

        return {
            "avg_pending_days": round(avg_pending_days, 1),
            "response_rate": response_rate,
            "responded": responded,
            "total": total,
            "day_distribution": [
                {"day": day_names[i], "count": day_counts[i]} for i in range(7)
            ],
            "peak_day": (
                day_names[day_counts.index(max(day_counts))]
                if max(day_counts) > 0
                else "N/A"
            ),
        }

    # ─── Applicant Demographics ───────────────────────────────

    def get_applicant_demographics(self):
        """Analyze applicant skills and backgrounds."""
        # Skill distribution among applicants
        skill_counter = Counter()
        for app in self.applications.select_related("student").prefetch_related(
            "student__student_profile__skills"
        ):
            try:
                skills = app.student.student_profile.skills.values_list(
                    "name", flat=True
                )
                skill_counter.update(skills)
            except AttributeError:
                pass

        top_skills = [
            {"name": name, "count": count}
            for name, count in skill_counter.most_common(15)
        ]

        # Profile completeness
        profiles = StudentProfile.objects.filter(
            user__in=self.applications.values("student")
        )
        with_resume = profiles.exclude(resume="").count()
        with_github = (
            profiles.exclude(github_username__isnull=True)
            .exclude(github_username="")
            .count()
        )

        return {
            "top_skills": top_skills,
            "total_skills": len(skill_counter),
            "with_resume": with_resume,
            "with_github": with_github,
            "total_profiles": profiles.count(),
            "resume_rate": (
                round(with_resume / profiles.count() * 100, 1)
                if profiles.count() > 0
                else 0
            ),
        }

    # ─── Export Functions ─────────────────────────────────────

    def export_applications_csv(self):
        """Export all applications as CSV."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Job Title",
                "Candidate Email",
                "Applied Date",
                "Status",
                "Updated Date",
                "Skills",
                "Resume",
            ]
        )

        for app in self.applications.select_related(
            "job", "student", "job__company"
        ).prefetch_related("student__student_profile__skills"):
            skills_list = (
                list(app.student.student_profile.skills.values_list("name", flat=True))
                if hasattr(app.student, "student_profile")
                else []
            )
            writer.writerow(
                [
                    (
                        app.job.title
                        if app.job
                        else app.internship.title if app.internship else "N/A"
                    ),
                    app.student.email,
                    app.applied_at.strftime("%Y-%m-%d"),
                    app.status,
                    app.updated_at.strftime("%Y-%m-%d"),
                    ", ".join(skills_list),
                    f"{app.resume.url if app.resume else 'N/A'}",
                ]
            )

        return output.getvalue()

    def export_jobs_csv(self):
        """Export all jobs with stats as CSV."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "Job Title",
                "Type",
                "Location",
                "Salary",
                "Status",
                "Applicants",
                "Shortlisted",
                "Accepted",
                "Created Date",
                "Deadline",
            ]
        )

        for job in self.jobs.prefetch_related("applications"):
            apps = job.applications.all()
            writer.writerow(
                [
                    job.title,
                    job.job_type,
                    job.location,
                    job.salary,
                    "Active" if job.is_active else "Inactive",
                    apps.count(),
                    apps.filter(status="Shortlisted").count(),
                    apps.filter(status="Accepted").count(),
                    job.created_at.strftime("%Y-%m-%d"),
                    job.deadline.strftime("%Y-%m-%d"),
                ]
            )

        return output.getvalue()

    def generate_report_html(self):
        """Generate a full HTML report for PDF printing."""
        funnel = self.get_hiring_funnel()
        salary = self.get_salary_analytics()
        trends = self.get_monthly_trends(6)
        time_analytics = self.get_time_analytics()
        demographics = self.get_applicant_demographics()

        jobs_count = self.jobs.count()
        report_date = timezone.now().strftime("%B %d, %Y")

        html = render_to_string(
            "recruiters/report_template.html",
            {
                "funnel": funnel,
                "salary": salary,
                "trends": trends,
                "time_analytics": time_analytics,
                "demographics": demographics,
                "jobs_count": jobs_count,
                "report_date": report_date,
                "recruiter": self.recruiter,
            },
        )
        return html

    def get_all_analytics(self):
        """Get all analytics data in one call."""
        return {
            "funnel": self.get_hiring_funnel(),
            "funnel_by_job": self.get_funnel_by_job(),
            "monthly_trends": self.get_monthly_trends(12),
            "salary": self.get_salary_analytics(),
            "time_analytics": self.get_time_analytics(),
            "demographics": self.get_applicant_demographics(),
            "jobs_count": self.jobs.count(),
        }
