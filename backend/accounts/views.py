from django.shortcuts import render, redirect
from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.views import LoginView
from .forms import StudentRegistrationForm, RecruiterRegistrationForm, LoginForm
from analytics.utils import log_action


class UserLoginView(LoginView):
    template_name = "accounts/login.html"
    authentication_form = LoginForm

    def form_valid(self, form):
        response = super().form_valid(form)
        log_action(self.request, "Login Success")
        return response

    def form_invalid(self, form):
        log_action(
            self.request, "Login Failed", details={"email": form.data.get("username")}
        )
        return super().form_invalid(form)

    def get_success_url(self):
        user = self.request.user
        if user.is_student:
            return "/student/dashboard/"
        elif user.is_recruiter:
            return "/recruiter/dashboard/"
        return "/"


def register_student(request):
    if request.method == "POST":
        form = StudentRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            log_action(request, "Student Registration", details={"email": user.email})
            messages.success(
                request, "Registration successful! Please log in with your email and password."
            )
            return redirect("login")
    else:
        form = StudentRegistrationForm()
    return render(request, "accounts/register.html", {"form": form, "role": "Student"})


def register_recruiter(request):
    if request.method == "POST":
        form = RecruiterRegistrationForm(request.POST)
        if form.is_valid():
            user = form.save()
            log_action(request, "Recruiter Registration", details={"email": user.email})
            messages.success(
                request, "Registration successful! Please log in with your email and password."
            )
            return redirect("login")
    else:
        form = RecruiterRegistrationForm()
    return render(
        request, "accounts/register.html", {"form": form, "role": "Recruiter"}
    )


def logout_view(request):
    log_action(request, "Logout")
    logout(request)
    return redirect("home")
