from django.urls import path
from django.views.decorators.cache import cache_page
from .views import InternshipListView, InternshipDetailView

urlpatterns = [
    path("", cache_page(60 * 15)(InternshipListView.as_view()), name="internship_list"),
    path("<int:pk>/", InternshipDetailView.as_view(), name="internship_detail"),
]
