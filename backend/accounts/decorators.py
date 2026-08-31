from django.shortcuts import redirect
from django.contrib import messages


def student_required(view_func):
    def wrapper(request, *args, **kwargs):
        if request.user.is_authenticated and request.user.is_student:
            return view_func(request, *args, **kwargs)
        messages.error(request, "Access denied. Student account required.")
        return redirect("home")

    return wrapper


def recruiter_required(view_func):
    def wrapper(request, *args, **kwargs):
        if request.user.is_authenticated and request.user.is_recruiter:
            return view_func(request, *args, **kwargs)
        messages.error(request, "Access denied. Recruiter account required.")
        return redirect("home")

    return wrapper
