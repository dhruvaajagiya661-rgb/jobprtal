from django.urls import path
from .views import UserLoginView, register_student, register_recruiter, logout_view

urlpatterns = [
    path("login/", UserLoginView.as_view(), name="login"),
    path("register/student/", register_student, name="register_student"),
    path("register/recruiter/", register_recruiter, name="register_recruiter"),
    path("logout/", logout_view, name="logout"),
]
