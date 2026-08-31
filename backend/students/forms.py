from django import forms
from .models import StudentProfile


class StudentProfileForm(forms.ModelForm):
    portfolio_link = forms.URLField(required=False, assume_scheme="https")
    github_link = forms.URLField(required=False, assume_scheme="https")
    linkedin_link = forms.URLField(required=False, assume_scheme="https")

    class Meta:
        model = StudentProfile
        fields = [
            "profile_photo",
            "resume",
            "skills",
            "education",
            "experience",
            "portfolio_link",
            "github_link",
            "linkedin_link",
        ]
        widgets = {
            "education": forms.Textarea(attrs={"rows": 3, "class": "form-control"}),
            "experience": forms.Textarea(attrs={"rows": 3, "class": "form-control"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields:
            if not isinstance(
                self.fields[field].widget,
                (forms.FileInput, forms.CheckboxSelectMultiple),
            ):
                self.fields[field].widget.attrs.update({"class": "form-control"})
