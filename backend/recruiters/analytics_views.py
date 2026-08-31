"""
Recruiter Analytics Views.
Provides the advanced analytics dashboard with hiring funnels, salary trends,
and CSV/HTML-report export functionality.
"""

import json
from datetime import datetime
from django.http import HttpResponse
from django.shortcuts import render
from accounts.decorators import recruiter_required
from .services import RecruiterAnalyticsService


@recruiter_required
def analytics_dashboard(request):
    """Main analytics dashboard with all visualizations."""
    service = RecruiterAnalyticsService(request.user)
    analytics = service.get_all_analytics()

    context = {
        "funnel": analytics["funnel"],
        "funnel_by_job": analytics["funnel_by_job"],
        "monthly_trends": json.dumps(analytics["monthly_trends"]),
        "salary": analytics["salary"],
        "time_analytics": analytics["time_analytics"],
        "demographics": analytics["demographics"],
        "jobs_count": analytics["jobs_count"],
        "report_date": datetime.now().strftime("%B %d, %Y"),
    }
    return render(request, "recruiters/analytics_dashboard.html", context)


@recruiter_required
def export_applicants_csv(request):
    """Export all applicants as CSV file."""
    service = RecruiterAnalyticsService(request.user)
    csv_data = service.export_applications_csv()

    response = HttpResponse(csv_data, content_type="text/csv")
    response["Content-Disposition"] = (
        f'attachment; filename="applicants_export_{datetime.now().strftime("%Y%m%d")}.csv"'
    )
    return response


@recruiter_required
def export_jobs_csv(request):
    """Export all jobs with stats as CSV file."""
    service = RecruiterAnalyticsService(request.user)
    csv_data = service.export_jobs_csv()

    response = HttpResponse(csv_data, content_type="text/csv")
    response["Content-Disposition"] = (
        f'attachment; filename="jobs_export_{datetime.now().strftime("%Y%m%d")}.csv"'
    )
    return response


@recruiter_required
def export_report_pdf(request):
    """Generate a print-friendly HTML report (save as PDF via browser)."""
    service = RecruiterAnalyticsService(request.user)
    html = service.generate_report_html()

    response = HttpResponse(html, content_type="text/html")
    response["Content-Disposition"] = (
        f'inline; filename="analytics_report_{datetime.now().strftime("%Y%m%d")}.html"'
    )
    return response
