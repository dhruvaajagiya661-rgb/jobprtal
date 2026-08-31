from django.urls import path
from .views import (
    recruiter_dashboard,
    JobCreateView,
    JobUpdateView,
    JobDeleteView,
    view_applicants,
    update_application_status,
    manage_jobs,
    company_profile,
)
from .analytics_views import (
    analytics_dashboard,
    export_applicants_csv,
    export_jobs_csv,
    export_report_pdf,
)

urlpatterns = [
    path("dashboard/", recruiter_dashboard, name="recruiter_dashboard"),
    path("analytics/", analytics_dashboard, name="recruiter_analytics"),
    path(
        "analytics/export/applicants/",
        export_applicants_csv,
        name="export_applicants_csv",
    ),
    path("analytics/export/jobs/", export_jobs_csv, name="export_jobs_csv"),
    path("analytics/export/report/", export_report_pdf, name="export_report"),
    path("post-job/", JobCreateView.as_view(), name="post_job"),
    path("job/<int:pk>/edit/", JobUpdateView.as_view(), name="edit_job"),
    path("job/<int:pk>/delete/", JobDeleteView.as_view(), name="delete_job"),
    path("manage-jobs/", manage_jobs, name="manage_jobs"),
    path("applicants/", view_applicants, name="all_applicants"),
    path("job/<int:job_id>/applicants/", view_applicants, name="view_applicants"),
    path("company-profile/", company_profile, name="company_profile"),
    path(
        "application/<int:app_id>/status/<str:status>/",
        update_application_status,
        name="update_status",
    ),
]
