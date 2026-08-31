from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from .models import CustomUser


class StudentRegistrationForm(UserCreationForm):
    class Meta:
        model = CustomUser
        fields = ("email",)

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_student = True
        user.username = user.email  # Set username to email
        if commit:
            user.save()
        return user


class RecruiterRegistrationForm(UserCreationForm):
    class Meta:
        model = CustomUser
        fields = ("email",)

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_recruiter = True
        user.username = user.email  # Set username to email
        if commit:
            user.save()
        return user


class LoginForm(AuthenticationForm):
    username = forms.EmailField(
        widget=forms.EmailInput(attrs={"class": "form-control", "placeholder": "Email"})
    )
    password = forms.CharField(
        widget=forms.PasswordInput(
            attrs={"class": "form-control", "placeholder": "Password"}
        )
    )
