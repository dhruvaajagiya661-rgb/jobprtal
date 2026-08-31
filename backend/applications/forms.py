from django import forms
from .models import Application


class ApplicationForm(forms.ModelForm):
    class Meta:
        model = Application
        fields = ["resume"]
        widgets = {
            "resume": forms.FileInput(attrs={"class": "form-control"}),
        }
