from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.contrib import messages
from django.shortcuts import redirect


class StudentRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    def test_func(self):
        return self.request.user.is_authenticated and self.request.user.is_student

    def handle_no_permission(self):
        messages.error(self.request, "Access denied. Student account required.")
        return redirect("home")


class RecruiterRequiredMixin(LoginRequiredMixin, UserPassesTestMixin):
    def test_func(self):
        return self.request.user.is_authenticated and self.request.user.is_recruiter

    def handle_no_permission(self):
        messages.error(self.request, "Access denied. Recruiter account required.")
        return redirect("home")
