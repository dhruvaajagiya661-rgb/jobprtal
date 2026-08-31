from rest_framework import serializers

from portal.validators import (
    validate_posting_deadline,
    validate_posting_openings,
)
from .models import (
    Company,
    RecruiterProfile,
    CompanyFollower,
    CompanyReview,
    SavedCandidate,
)
from jobs.models import Job
from internships.models import Internship


class CompanySerializer(serializers.ModelSerializer):
    is_following = serializers.SerializerMethodField()
    followers_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Company
        fields = "__all__"

    def get_is_following(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return CompanyFollower.objects.filter(user=request.user, company=obj).exists()
        return False


class CompanyPageSerializer(serializers.ModelSerializer):
    """Rich company page serializer with jobs, reviews, followers."""
    is_following = serializers.SerializerMethodField()
    jobs = serializers.SerializerMethodField()
    reviews = serializers.SerializerMethodField()
    employee_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id", "name", "logo", "cover_photo", "description", "about",
            "industry", "size", "website", "location", "founded_year",
            "specialities", "mission", "culture", "benefits",
            "followers_count", "is_following", "jobs", "reviews", "employee_count",
        ]

    def get_is_following(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return CompanyFollower.objects.filter(user=request.user, company=obj).exists()
        return False

    def get_jobs(self, obj):
        from jobs.serializers import JobSerializer
        jobs = Job.objects.filter(company=obj, is_active=True).order_by("-created_at")[:10]
        return JobSerializer(jobs, many=True).data

    def get_reviews(self, obj):
        reviews = CompanyReview.objects.filter(company=obj).select_related("user")[:10]
        return CompanyReviewSerializer(reviews, many=True).data

    def get_employee_count(self, obj):
        return RecruiterProfile.objects.filter(company=obj).count()


class CompanyReviewSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = CompanyReview
        fields = ["id", "user", "user_email", "user_username", "company", "title", "content", "rating", "pros", "cons", "employment_status", "created_at"]
        read_only_fields = ["id", "created_at"]


class CompanyFollowerSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyFollower
        fields = ["id", "user", "company", "created_at"]
        read_only_fields = ["id", "created_at"]


class RecruiterProfileSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)

    class Meta:
        model = RecruiterProfile
        fields = ("id", "company", "designation")


class JobCreateUpdateSerializer(serializers.ModelSerializer):
    skills_required = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    preferred_skills = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    category_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Job
        fields = (
            "title",
            "description",
            "requirements",
            "location",
            "salary",
            "job_type",
            "category_name",
            "skills_required",
            "preferred_skills",
            "experience_required",
            "deadline",
            "openings",
        )

    validate_openings = validate_posting_openings
    validate_deadline = validate_posting_deadline

    def create(self, validated_data):
        from jobs.models import Skill, Category

        skills_required_names = validated_data.pop("skills_required", [])
        preferred_skills_names = validated_data.pop("preferred_skills", [])
        category_name = validated_data.pop("category_name", None)

        if category_name:
            category, _ = Category.objects.get_or_create(name=category_name)
            validated_data["category"] = category

        validated_data["recruiter"] = self.context["request"].user

        user = self.context["request"].user
        profile = getattr(user, "recruiter_profile", None)
        company = profile.company if profile else None
        if company is None:
            company_name = self.context["request"].data.get("company_name") or (
                f"{user.username}'s Company" if user.username else "Company"
            )
            company = Company.objects.create(
                name=company_name,
                description="",
                location=self.context["request"].data.get("location", ""),
            )
            if profile:
                profile.company = company
                profile.save(update_fields=["company"])
        validated_data["company"] = company

        job = super().create(validated_data)

        for name in skills_required_names:
            skill, _ = Skill.objects.get_or_create(name=name.strip())
            job.skills_required.add(skill)

        for name in preferred_skills_names:
            skill, _ = Skill.objects.get_or_create(name=name.strip())
            job.preferred_skills.add(skill)

        return job


class CompanyUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = (
            "name", "industry", "location", "website", "description", "size", "logo",
            "cover_photo", "founded_year", "specialities", "about", "mission", "culture", "benefits",
        )


class InternshipCreateUpdateSerializer(serializers.ModelSerializer):
    """Write serializer for a recruiter's own internship postings.

    Mirrors JobCreateUpdateSerializer: skills and category arrive as plain
    names (that's what the form collects) and are resolved to rows here, and
    the company is taken from the recruiter's profile rather than trusted
    from the request body.
    """

    skills_required = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    preferred_skills = serializers.ListField(
        child=serializers.CharField(), write_only=True, required=False
    )
    category_name = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = Internship
        fields = (
            "title",
            "description",
            "requirements",
            "location",
            "stipend",
            "duration",
            "internship_type",
            "category_name",
            "skills_required",
            "preferred_skills",
            "deadline",
            "openings",
            "is_active",
        )

    validate_openings = validate_posting_openings
    validate_deadline = validate_posting_deadline

    def _resolve_skills(self, names):
        from jobs.models import Skill

        skills = []
        for name in names:
            cleaned = (name or "").strip()
            if not cleaned:
                continue
            skill, _ = Skill.objects.get_or_create(name=cleaned)
            skills.append(skill)
        return skills

    def _pop_relations(self, validated_data):
        """Pull the write-only name fields off before the model save.

        The `has_*` flags distinguish "the client didn't mention this field"
        (leave the existing M2M alone on a PATCH) from "the client sent an
        empty list" (clear it).
        """
        has_skills = "skills_required" in validated_data
        has_preferred = "preferred_skills" in validated_data
        skills = validated_data.pop("skills_required", [])
        preferred = validated_data.pop("preferred_skills", [])
        category_name = validated_data.pop("category_name", None)

        if category_name:
            from jobs.models import Category

            category, _ = Category.objects.get_or_create(name=category_name.strip())
            validated_data["category"] = category
        return has_skills, skills, has_preferred, preferred

    def create(self, validated_data):
        _, skills, _, preferred = self._pop_relations(validated_data)

        user = self.context["request"].user
        validated_data["recruiter"] = user

        profile = getattr(user, "recruiter_profile", None)
        company = profile.company if profile else None
        if company is None:
            # Same on-demand company creation as create_job: a recruiter who
            # never filled in a company profile can still post, instead of
            # hitting a 500 on the non-nullable FK.
            company_name = self.context["request"].data.get("company_name") or (
                f"{user.username}'s Company" if user.username else "Company"
            )
            company = Company.objects.create(
                name=company_name,
                description="",
                location=self.context["request"].data.get("location", ""),
            )
            if profile:
                profile.company = company
                profile.save(update_fields=["company"])
        validated_data["company"] = company

        internship = super().create(validated_data)
        internship.skills_required.set(self._resolve_skills(skills))
        internship.preferred_skills.set(self._resolve_skills(preferred))
        return internship

    def update(self, instance, validated_data):
        has_skills, skills, has_preferred, preferred = self._pop_relations(
            validated_data
        )
        internship = super().update(instance, validated_data)
        if has_skills:
            internship.skills_required.set(self._resolve_skills(skills))
        if has_preferred:
            internship.preferred_skills.set(self._resolve_skills(preferred))
        return internship


class SavedCandidateSerializer(serializers.ModelSerializer):
    """A talent-pool entry, flattened with everything the card needs.

    The recruiter is browsing people, not join rows, so the student's name,
    skills, education and resume are inlined rather than left behind a second
    request per candidate.
    """

    student_id = serializers.IntegerField(source="student.id", read_only=True)
    student_name = serializers.SerializerMethodField()
    student_email = serializers.EmailField(source="student.email", read_only=True)
    skills = serializers.SerializerMethodField()
    education = serializers.SerializerMethodField()
    experience = serializers.SerializerMethodField()
    resume = serializers.SerializerMethodField()
    profile_photo = serializers.SerializerMethodField()
    portfolio_link = serializers.SerializerMethodField()
    github_link = serializers.SerializerMethodField()
    linkedin_link = serializers.SerializerMethodField()

    class Meta:
        model = SavedCandidate
        fields = (
            "id",
            "student_id",
            "student_name",
            "student_email",
            "skills",
            "education",
            "experience",
            "resume",
            "profile_photo",
            "portfolio_link",
            "github_link",
            "linkedin_link",
            "notes",
            "saved_at",
        )
        read_only_fields = ("id", "saved_at")

    def _profile(self, obj):
        return getattr(obj.student, "student_profile", None)

    def _file_url(self, field):
        if not field:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(field.url) if request else field.url

    def get_student_name(self, obj) -> str:
        return obj.student.get_full_name() or obj.student.username

    def get_skills(self, obj) -> list[str]:
        profile = self._profile(obj)
        if profile is None:
            return []
        return list(profile.skills.order_by("name").values_list("name", flat=True))

    def get_education(self, obj) -> str:
        profile = self._profile(obj)
        return profile.education if profile else ""

    def get_experience(self, obj) -> str:
        profile = self._profile(obj)
        return profile.experience if profile else ""

    def get_resume(self, obj) -> str | None:
        profile = self._profile(obj)
        return self._file_url(profile.resume) if profile else None

    def get_profile_photo(self, obj) -> str | None:
        profile = self._profile(obj)
        return self._file_url(profile.profile_photo) if profile else None

    def get_portfolio_link(self, obj) -> str | None:
        profile = self._profile(obj)
        return profile.portfolio_link if profile else None

    def get_github_link(self, obj) -> str | None:
        profile = self._profile(obj)
        return profile.github_link if profile else None

    def get_linkedin_link(self, obj) -> str | None:
        profile = self._profile(obj)
        return profile.linkedin_link if profile else None
