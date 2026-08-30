from django.db import models
from django.conf import settings


class Post(models.Model):
    """A LinkedIn-style post in the feed."""

    POST_TYPE_CHOICES = (
        ("text", "Text"),
        ("image", "Image"),
        ("article", "Article"),
        ("job_share", "Job Share"),
        ("achievement", "Achievement"),
    )

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts"
    )
    content = models.TextField()
    post_type = models.CharField(max_length=20, choices=POST_TYPE_CHOICES, default="text")
    image = models.ImageField(upload_to="post_images/", null=True, blank=True)
    # For job_share type, reference the job
    shared_job = models.ForeignKey(
        "jobs.Job", on_delete=models.SET_NULL, null=True, blank=True, related_name="shares"
    )
    # For article type, store rich content
    article_title = models.CharField(max_length=300, blank=True)
    article_url = models.URLField(blank=True)
    visibility = models.CharField(
        max_length=20,
        choices=(("public", "Public"), ("connections", "Connections Only"), ("private", "Only Me")),
        default="public",
    )
    likes_count = models.PositiveIntegerField(default=0)
    comments_count = models.PositiveIntegerField(default=0)
    shares_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Post by {self.author.email}: {self.content[:50]}..."


class PostLike(models.Model):
    """A like/reaction on a post."""

    REACTION_CHOICES = (
        ("like", "👍 Like"),
        ("celebrate", "🎉 Celebrate"),
        ("support", "💪 Support"),
        ("love", "❤️ Love"),
        ("insightful", "💡 Insightful"),
        ("funny", "😄 Funny"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_likes"
    )
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    reaction = models.CharField(max_length=20, choices=REACTION_CHOICES, default="like")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "post")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} {self.reaction}d post {self.post_id}"


class PostComment(models.Model):
    """A comment on a post."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_comments"
    )
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies"
    )
    content = models.TextField()
    likes_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment by {self.user.email} on post {self.post_id}"


class CommentLike(models.Model):
    """A like on a comment."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comment_likes"
    )
    comment = models.ForeignKey(PostComment, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "comment")

    def __str__(self):
        return f"{self.user.email} liked comment {self.comment_id}"


class PostSave(models.Model):
    """A user saving/bookmarking a post."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_posts"
    )
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="saves")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "post")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} saved post {self.post_id}"
