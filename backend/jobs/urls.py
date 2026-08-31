from django.urls import path
from django.views.decorators.cache import cache_page
from .views import JobListView, JobDetailView

urlpatterns = [
    path("", cache_page(60 * 15)(JobListView.as_view()), name="job_list"),
    path("<int:pk>/", JobDetailView.as_view(), name="job_detail"),
]
