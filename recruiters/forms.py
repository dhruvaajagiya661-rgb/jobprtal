from django import forms
from jobs.models import Job


class JobForm(forms.ModelForm):
    class Meta:
        model = Job
        fields = [
            "title",
            "company",
            "description",
            "requirements",
            "location",
            "salary",
            "job_type",
            "skills_required",
            "experience_required",
            "deadline",
            "openings",
        ]
        widgets = {
            "deadline": forms.DateInput(
                attrs={"type": "date", "class": "form-control"}
            ),
            "description": forms.Textarea(attrs={"rows": 4, "class": "form-control"}),
            "requirements": forms.Textarea(attrs={"rows": 4, "class": "form-control"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields:
            if field != "deadline":
                self.fields[field].widget.attrs.update({"class": "form-control"})
