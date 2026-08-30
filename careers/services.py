from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from jobs.models import Job, Skill
from internships.models import Internship
from applications.models import Application
from .models import (
    CareerPath,
    InterviewQuestion,
    SkillResource,
    QuestionAttempt,
    QuestionBookmark,
    SkillLearningStatus,
)


class JobMatchingService:
    """
    AI-powered job matching engine.
    Scores jobs based on student's skills, experience, and preferences.
    """

    # Relative importance of each scoring component. Kept as a class
    # attribute so the score and its explanation always use the same numbers.
    WEIGHTS = {
        "skills": 0.50,
        "experience": 0.20,
        "category": 0.15,
        "location": 0.15,
    }

    @staticmethod
    def get_match_score(student_profile, job):
        """
        Calculate a comprehensive match score (0-100) between a student and a job.

        Thin wrapper over :meth:`get_match_breakdown` so the number shown on a
        job card and the explanation shown on the job page can never disagree.
        """
        return JobMatchingService.get_match_breakdown(student_profile, job)["score"]

    @staticmethod
    def get_match_breakdown(student_profile, job):
        """
        Score a student against a job *and* explain the result.

        Returns the score plus the evidence behind it: which required skills
        the student already has, which are missing, and how many points each
        component contributed. The UI uses this to turn an opaque "72% match"
        into actionable advice ("you're missing Kubernetes").

        Performs lazy per-instance caching so scoring a whole job page doesn't
        re-query the same student skills for every job:
        - Student skills are cached on the profile instance (``_skill_name_cache``).
        - Job skills use ``.all()`` instead of ``.values_list()`` so prefetched
          M2M relations are reused (``values_list`` ignores the prefetch cache
          and hits the DB once per job).
        """
        score = 0.0
        weights = JobMatchingService.WEIGHTS
        components = []

        # 1. SKILL MATCH (50%)
        if not hasattr(student_profile, "_skill_name_cache"):
            student_profile._skill_name_cache = set(
                student_profile.skills.values_list("name", flat=True)
            )
        student_skills = student_profile._skill_name_cache
        required_skills = {s.name for s in job.skills_required.all()}
        preferred_skills = {s.name for s in job.preferred_skills.all()}

        matched_required = student_skills & required_skills
        missing_required = required_skills - student_skills
        matched_preferred = student_skills & preferred_skills
        missing_preferred = preferred_skills - student_skills

        if required_skills:
            required_ratio = len(matched_required) / len(required_skills)
        else:
            required_ratio = 0.5  # No required skills = neutral

        preferred_ratio = (
            len(matched_preferred) / len(preferred_skills) if preferred_skills else 0.0
        )

        # Bonus for having all required skills
        skill_score = required_ratio * 0.7 + preferred_ratio * 0.3
        skill_points = weights["skills"] * 100 * skill_score
        score += skill_points
        components.append(
            {
                "label": "Skills",
                "max_points": round(weights["skills"] * 100, 1),
                "points": round(skill_points, 1),
                "detail": (
                    f"{len(matched_required)} of {len(required_skills)} required skills"
                    if required_skills
                    else "No specific skills required"
                ),
            }
        )

        # 2. EXPERIENCE MATCH (20%)
        student_exp = (
            len(student_profile.experience) if student_profile.experience else 0
        )
        if student_exp > 50:  # Has meaningful experience
            exp_factor, exp_detail = 80, "Detailed experience on your profile"
        elif student_exp > 0:
            exp_factor, exp_detail = 40, "Some experience listed"
        else:
            exp_factor, exp_detail = 10, "Add experience to your profile to score higher"
        exp_points = weights["experience"] * exp_factor
        score += exp_points
        components.append(
            {
                "label": "Experience",
                "max_points": round(weights["experience"] * 100, 1),
                "points": round(exp_points, 1),
                "detail": exp_detail,
            }
        )

        # 3. CATEGORY PREFERENCE (15%)
        category_points = 0.0
        category_detail = "No category overlap detected"
        if job.category and student_skills:
            # If student has skills matching the job category, bonus. Cached per
            # category id on the profile so a job page doesn't re-run this query.
            category_cache = getattr(student_profile, "_category_skill_cache", {})
            if job.category_id not in category_cache:
                category_cache[job.category_id] = set(
                    Skill.objects.filter(
                        mandatory_jobs__category=job.category
                    ).values_list("name", flat=True)
                )
                student_profile._category_skill_cache = category_cache
            if student_skills & category_cache[job.category_id]:
                category_points = weights["category"] * 100
                category_detail = f"Your skills fit the {job.category.name} field"
        score += category_points
        components.append(
            {
                "label": "Field fit",
                "max_points": round(weights["category"] * 100, 1),
                "points": round(category_points, 1),
                "detail": category_detail,
            }
        )

        # 4. LOCATION PREFERENCE (15%) - default neutral
        location_points = weights["location"] * 50
        score += location_points
        components.append(
            {
                "label": "Location",
                "max_points": round(weights["location"] * 100, 1),
                "points": round(location_points, 1),
                "detail": job.location or "Location not specified",
            }
        )

        final_score = min(100, round(score, 1))

        if final_score >= 70:
            verdict = "Strong match"
        elif final_score >= 40:
            verdict = "Possible match"
        else:
            verdict = "Stretch role"

        return {
            "score": final_score,
            "verdict": verdict,
            "matched_skills": sorted(matched_required),
            "missing_skills": sorted(missing_required),
            "matched_preferred_skills": sorted(matched_preferred),
            "missing_preferred_skills": sorted(missing_preferred),
            "components": components,
        }

    @staticmethod
    def get_recommended_jobs(student_profile, limit=6):
        """
        Get top N job recommendations for a student, ranked by match score.
        """
        active_jobs = (
            Job.objects.filter(is_active=True)
            .select_related("company", "category")
            .prefetch_related("skills_required", "preferred_skills")
        )

        scored_jobs = []
        for job in active_jobs:
            # Check if already applied
            already_applied = Application.objects.filter(
                student=student_profile.user, job=job
            ).exists()
            if not already_applied:
                score = JobMatchingService.get_match_score(student_profile, job)
                if score > 20:  # Only recommend if score > 20%
                    scored_jobs.append((score, job))

        scored_jobs.sort(key=lambda x: x[0], reverse=True)
        return [{"job": job, "score": score} for score, job in scored_jobs[:limit]]

    @staticmethod
    def get_recommended_internships(student_profile, limit=4):
        """Get top N internship recommendations."""
        active_internships = (
            Internship.objects.filter(is_active=True)
            .select_related("company", "category")
            .prefetch_related("skills_required", "preferred_skills")
        )

        scored = []
        for intern in active_internships:
            already_applied = Application.objects.filter(
                student=student_profile.user, internship=intern
            ).exists()
            if not already_applied:
                score = JobMatchingService.get_match_score(student_profile, intern)
                if score > 20:
                    scored.append((score, intern))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            {"internship": intern, "score": score} for score, intern in scored[:limit]
        ]


class SkillGapService:
    """
    Analyzes gaps between a student's current skills and what's required
    for their target jobs/careers.
    """

    @staticmethod
    def analyze_gaps(student_profile, target_job=None):
        """
        Find missing skills for a target job or for all relevant jobs.
        Returns structured gap analysis with learning resource recommendations.
        """
        student_skills = set(student_profile.skills.values_list("name", flat=True))

        if target_job:
            jobs_to_analyze = [target_job]
        else:
            # Analyze against all active jobs the student hasn't applied to
            applied_job_ids = Application.objects.filter(
                student=student_profile.user
            ).values_list("job_id", flat=True)
            jobs_to_analyze = (
                Job.objects.filter(is_active=True)
                .exclude(id__in=applied_job_ids)
                .prefetch_related("skills_required")
            )

        gap_analysis = {
            "missing_skills": {},
            "total_jobs_analyzed": len(jobs_to_analyze),
            "skill_demand": [],
            "recommended_resources": [],
        }

        skill_demand_counter = {}

        for job in jobs_to_analyze:
            required_skills = set(job.skills_required.values_list("name", flat=True))
            missing = required_skills - student_skills

            for skill_name in missing:
                skill_demand_counter[skill_name] = (
                    skill_demand_counter.get(skill_name, 0) + 1
                )

        # Sort by demand (most frequently missing skills first)
        sorted_demands = sorted(
            skill_demand_counter.items(), key=lambda x: x[1], reverse=True
        )

        for skill_name, demand_count in sorted_demands:
            skill = Skill.objects.filter(name=skill_name).first()
            resources = []
            if skill:
                resources = SkillResource.objects.filter(skill=skill).values(
                    "title", "url", "resource_type", "difficulty", "is_free"
                )[:3]

            gap_analysis["missing_skills"][skill_name] = {
                "demand_count": demand_count,
                "demand_percentage": round(
                    (demand_count / max(len(jobs_to_analyze), 1)) * 100, 1
                ),
                "resources": list(resources),
            }

        gap_analysis["skill_demand"] = sorted_demands[:10]
        gap_analysis["student_skill_count"] = len(student_skills)
        gap_analysis["total_missing_skills"] = len(gap_analysis["missing_skills"])

        return gap_analysis

    @staticmethod
    def get_learning_path(skill_name):
        """Get a structured learning path for a specific skill."""
        skill = Skill.objects.filter(name__iexact=skill_name).first()
        if not skill:
            return None

        resources = SkillResource.objects.filter(skill=skill).order_by("difficulty")

        return {
            "skill": skill.name,
            "beginner": resources.filter(difficulty="beginner"),
            "intermediate": resources.filter(difficulty="intermediate"),
            "advanced": resources.filter(difficulty="advanced"),
            "total_resources": resources.count(),
        }

    @staticmethod
    def get_job_breakdown(student_profile, limit=6):
        """Per-job gap breakdown: which skills each recommended job is missing."""
        student_skills = set(student_profile.skills.values_list("name", flat=True))
        recommended = JobMatchingService.get_recommended_jobs(
            student_profile, limit=limit
        )
        breakdown = []
        for item in recommended:
            job = item["job"]
            required = set(job.skills_required.values_list("name", flat=True))
            preferred = set(job.preferred_skills.values_list("name", flat=True))
            breakdown.append(
                {
                    "job_id": job.id,
                    "job_title": job.title,
                    "company": job.company.name if job.company_id else None,
                    "location": job.location,
                    "match_percentage": item["score"],
                    "missing_required": sorted(required - student_skills),
                    "missing_preferred": sorted(preferred - student_skills),
                }
            )
        return breakdown

    @staticmethod
    def get_priority_roadmap(student_profile, limit=10):
        """
        Rank missing skills by impact: job demand (60%) + how many of the
        student's recommended career paths require the skill (40%).
        Attaches the student's current learning status to each skill.
        """
        analysis = SkillGapService.analyze_gaps(student_profile)
        recommended_paths = CareerPathService.get_path_for_student(student_profile)

        path_skill_sets = []
        for item in recommended_paths[:3]:
            path = item["path"]
            skills = set()
            for milestone in path.milestones.all():
                skills.update(
                    milestone.skills_required.values_list("name", flat=True)
                )
            path_skill_sets.append(skills)

        statuses = {
            s.skill.name: s.status
            for s in SkillLearningStatus.objects.filter(student=student_profile.user)
        }

        roadmap = []
        for skill_name, gap in analysis.get("missing_skills", {}).items():
            career_hits = sum(1 for s in path_skill_sets if skill_name in s)
            priority = (gap.get("demand_percentage", 0) * 0.6) + (
                min(career_hits, 1) * 100 * 0.4
            )
            roadmap.append(
                {
                    "skill_name": skill_name,
                    "demand_count": gap.get("demand_count", 0),
                    "demand_percentage": gap.get("demand_percentage", 0),
                    "career_path_count": career_hits,
                    "priority_score": round(priority, 1),
                    "status": statuses.get(skill_name, "not_started"),
                    "resources": gap.get("resources", []),
                }
            )
        roadmap.sort(key=lambda x: x["priority_score"], reverse=True)
        return roadmap[:limit]


class CareerPathService:
    """
    Provides career path planning and recommendations.
    """

    @staticmethod
    def get_path_for_student(student_profile):
        """
        Recommend career paths based on student's existing skills.
        Always returns list of {'path': CareerPath, 'match_score': float}.
        """
        student_skills = set(student_profile.skills.values_list("name", flat=True))

        paths = CareerPath.objects.filter(is_active=True).prefetch_related(
            "milestones__skills_required"
        )

        scored_paths = []
        for path in paths:
            if student_skills:
                all_path_skills = set()
                for milestone in path.milestones.all():
                    milestone_skills = set(
                        milestone.skills_required.values_list("name", flat=True)
                    )
                    all_path_skills.update(milestone_skills)

                if all_path_skills:
                    overlap = student_skills & all_path_skills
                    score = len(overlap) / len(all_path_skills) * 100
                else:
                    score = 0
            else:
                # No skills to match, assign default score
                score = 50

            scored_paths.append((score, path))

        scored_paths.sort(key=lambda x: x[0], reverse=True)
        return [
            {"path": path, "match_score": round(score, 1)}
            for score, path in scored_paths
        ]

    @staticmethod
    def get_path_detail(path_id):
        """Get full detail for a career path including milestones."""
        path = CareerPath.objects.prefetch_related(
            "milestones__skills_required", "questions"
        ).get(id=path_id)

        milestones = path.milestones.all().order_by("order")
        total_skills = set()
        for milestone in milestones:
            for skill in milestone.skills_required.all():
                total_skills.add(skill.name)

        return {
            "path": path,
            "milestones": milestones,
            "total_skills": len(total_skills),
            "questions_count": path.questions.count(),
        }


class InterviewPrepService:
    """
    Provides interview preparation resources and practice questions.
    """

    @staticmethod
    def get_questions_by_skill(skill_id, difficulty=None):
        """Get interview questions filtered by skill and optionally difficulty."""
        questions = InterviewQuestion.objects.filter(skill_id=skill_id)
        if difficulty:
            questions = questions.filter(difficulty=difficulty)
        return questions.select_related("skill", "career_path").order_by("difficulty")

    @staticmethod
    def get_questions_by_career_path(path_id, difficulty=None):
        """Get interview questions for a specific career path."""
        questions = InterviewQuestion.objects.filter(career_path_id=path_id)
        if difficulty:
            questions = questions.filter(difficulty=difficulty)
        return questions.select_related("skill").order_by("skill__name", "difficulty")

    @staticmethod
    def get_practice_set(skill_ids=None, count=5, difficulty=None):
        """Get a random set of practice questions."""
        questions = InterviewQuestion.objects.all()
        if skill_ids:
            questions = questions.filter(skill_id__in=skill_ids)
        if difficulty:
            questions = questions.filter(difficulty=difficulty)
        return questions.order_by("?")[:count]

    @staticmethod
    def search_questions(q, limit=20):
        """Full-text-ish search over question, answer and skill name."""
        from django.db.models import Q

        return (
            InterviewQuestion.objects.filter(
                Q(question__icontains=q)
                | Q(answer__icontains=q)
                | Q(skill__name__icontains=q)
                | Q(career_path__name__icontains=q)
            )
            .select_related("skill", "career_path")
            .distinct()[:limit]
        )

    @staticmethod
    def get_resources_for_skill(skill_id):
        """Get learning resources for a specific skill."""
        return SkillResource.objects.filter(skill_id=skill_id).order_by("difficulty")


class ProgressService:
    """Aggregates interview practice progress for a student."""

    @staticmethod
    def get_stats(student):
        attempts = QuestionAttempt.objects.filter(student=student)
        total = attempts.count()
        correct = attempts.filter(correct=True).count()

        # Current + best daily streaks
        days = set(
            QuestionAttempt.objects.filter(student=student)
            .annotate(day=TruncDate("answered_at"))
            .values_list("day", flat=True)
        )
        current_streak, best_streak = ProgressService._streaks(days)

        by_difficulty = list(
            attempts.values("question__difficulty")
            .annotate(total=Count("id"), correct=Count("id", filter=Q(correct=True)))
            .order_by("question__difficulty")
        )
        by_difficulty = [
            {
                "difficulty": d["question__difficulty"],
                "total": d["total"],
                "correct": d["correct"],
            }
            for d in by_difficulty
        ]

        return {
            "total_attempts": total,
            "correct": correct,
            "incorrect": total - correct,
            "accuracy": round(correct / total * 100, 1) if total else 0,
            "streak": current_streak,
            "best_streak": best_streak,
            "bookmarked_count": QuestionBookmark.objects.filter(
                student=student
            ).count(),
            "by_difficulty": by_difficulty,
            "recent_attempts": attempts.select_related("question", "question__skill")[
                :10
            ],
        }

    @staticmethod
    def _streaks(days):
        """Return (current_streak, best_streak) from a set of date objects."""
        today = timezone.localdate()
        current = 0
        day = today
        if day not in days:  # allow streaks that ended yesterday
            day -= timedelta(days=1)
        while day in days:
            current += 1
            day -= timedelta(days=1)

        best = cur = 0
        prev = None
        for d in sorted(days):
            if prev is not None and (d - prev).days == 1:
                cur += 1
            else:
                cur = 1
            best = max(best, cur)
            prev = d
        return current, best
