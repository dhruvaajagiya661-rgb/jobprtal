from django.urls import path
from .views import student_dashboard, edit_student_profile, my_applications, saved_jobs

urlpatterns = [
    path("dashboard/", student_dashboard, name="student_dashboard"),
    path("profile/edit/", edit_student_profile, name="edit_student_profile"),
    path("applications/", my_applications, name="my_applications"),
    path("saved-jobs/", saved_jobs, name="saved_jobs"),
]
