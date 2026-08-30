from django.db import models
from django.conf import settings


class CareerPath(models.Model):
    """Represents a career track like Frontend Developer, Data Scientist, etc."""

    name = models.CharField(max_length=200, unique=True)
    description = models.TextField()
    icon = models.CharField(max_length=50, default="fa-code")  # Font Awesome icon
    color = models.CharField(max_length=20, default="#2563eb")  # Hex color
    avg_salary_min = models.IntegerField(
        default=0, help_text="Minimum average salary in USD"
    )
    avg_salary_max = models.IntegerField(
        default=0, help_text="Maximum average salary in USD"
    )
    growth_outlook = models.CharField(
        max_length=100, blank=True, help_text="e.g., 'Growing 22% annually'"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class CareerPathMilestone(models.Model):
    """A milestone/level within a career path (e.g., Junior → Senior → Lead)."""

    LEVEL_CHOICES = (
        ("entry", "Entry Level"),
        ("mid", "Mid Level"),
        ("senior", "Senior"),
        ("lead", "Lead / Manager"),
        ("principal", "Principal / Architect"),
    )
    career_path = models.ForeignKey(
        CareerPath, on_delete=models.CASCADE, related_name="milestones"
    )
    title = models.CharField(max_length=200)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    description = models.TextField()
    order = models.IntegerField(default=0)
    skills_required = models.ManyToManyField(
        "jobs.Skill", blank=True, related_name="milestones"
    )
    experience_years = models.CharField(max_length=50, default="0-2 years")
    salary_range = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["career_path", "order"]

    def __str__(self):
        return f"{self.career_path.name} - {self.title}"


class InterviewQuestion(models.Model):
    """Interview prep questions organized by skill and difficulty."""

    DIFFICULTY_CHOICES = (
        ("beginner", "Beginner"),
        ("intermediate", "Intermediate"),
        ("advanced", "Advanced"),
    )
    skill = models.ForeignKey(
        "jobs.Skill", on_delete=models.CASCADE, related_name="interview_questions"
    )
    question = models.TextField()
    answer = models.TextField(blank=True, help_text="Model answer for reference")
    difficulty = models.CharField(
        max_length=20, choices=DIFFICULTY_CHOICES, default="intermediate"
    )
    career_path = models.ForeignKey(
        CareerPath,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="questions",
    )
    is_behavioral = models.BooleanField(
        default=False, help_text="Is this a behavioral question?"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["skill", "difficulty"]

    def __str__(self):
        return f"[{self.get_difficulty_display()}] {self.skill.name}: {self.question[:60]}..."


class SkillResource(models.Model):
    """Learning resources for skills (courses, tutorials, articles)."""

    RESOURCE_TYPE_CHOICES = (
        ("course", "Online Course"),
        ("tutorial", "Tutorial"),
        ("article", "Article"),
        ("video", "Video"),
        ("book", "Book"),
        ("documentation", "Documentation"),
    )
    skill = models.ForeignKey(
        "jobs.Skill", on_delete=models.CASCADE, related_name="learning_resources"
    )
    title = models.CharField(max_length=300)
    url = models.URLField()
    resource_type = models.CharField(
        max_length=20, choices=RESOURCE_TYPE_CHOICES, default="tutorial"
    )
    description = models.TextField(blank=True)
    difficulty = models.CharField(
        max_length=20, choices=InterviewQuestion.DIFFICULTY_CHOICES, default="beginner"
    )
    is_free = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["skill", "difficulty"]

    def __str__(self):
        return f"{self.title} ({self.get_resource_type_display()})"


class QuestionBookmark(models.Model):
    """A question a student bookmarked for later review."""

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="question_bookmarks",
    )
    question = models.ForeignKey(
        InterviewQuestion, on_delete=models.CASCADE, related_name="bookmarks"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("student", "question")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student.email} bookmarked Q{self.question_id}"


class QuestionAttempt(models.Model):
    """A single quiz/practice attempt recorded for progress tracking."""

    MODE_CHOICES = (
        ("quiz", "Quiz"),
        ("mock", "Mock Interview"),
        ("practice", "Practice"),
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="question_attempts",
    )
    question = models.ForeignKey(
        InterviewQuestion, on_delete=models.CASCADE, related_name="attempts"
    )
    correct = models.BooleanField(default=False)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default="practice")
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-answered_at"]

    def __str__(self):
        return f"{self.student.email} Q{self.question_id} {'✓' if self.correct else '✗'}"


class SkillLearningStatus(models.Model):
    """Tracks a student's progress on a skill they are developing."""

    STATUS_CHOICES = (
        ("not_started", "Not Started"),
        ("in_progress", "In Progress"),
        ("learned", "Learned"),
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="skill_learning_status",
    )
    skill = models.ForeignKey(
        "jobs.Skill", on_delete=models.CASCADE, related_name="learning_statuses"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="not_started"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("student", "skill")
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.student.email} - {self.skill.name}: {self.status}"
