from django.urls import path
from .views import apply_job, apply_internship

urlpatterns = [
    path("apply/<int:job_id>/", apply_job, name="apply_job"),
    path(
        "apply-internship/<int:internship_id>/",
        apply_internship,
        name="apply_internship",
    ),
]
