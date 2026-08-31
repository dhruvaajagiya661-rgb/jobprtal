from rest_framework import serializers
from .models import Post, PostLike, PostComment, CommentLike, PostSave


class PostAuthorSerializer(serializers.Serializer):
    """Minimal author info for posts.

    The feed list/retrieve endpoints are deliberately readable by anonymous
    visitors (public posts only), so the author's email is withheld unless the
    caller is signed in -- otherwise every poster's address is harvestable
    without an account. Clients only ever use it as a display fallback behind
    ``username``, which is always populated.
    """

    id = serializers.IntegerField()
    email = serializers.SerializerMethodField()
    username = serializers.CharField()

    def get_email(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return obj.email
        return ""


class PostCommentSerializer(serializers.ModelSerializer):
    user = PostAuthorSerializer(read_only=True)
    replies_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()

    class Meta:
        model = PostComment
        fields = ["id", "user", "post", "parent", "content", "likes_count", "replies_count", "is_liked", "created_at"]
        read_only_fields = ["id", "likes_count", "created_at"]

    def get_replies_count(self, obj):
        return obj.replies.count()

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return CommentLike.objects.filter(user=request.user, comment=obj).exists()
        return False


class PostSerializer(serializers.ModelSerializer):
    author = PostAuthorSerializer(read_only=True)
    comments = PostCommentSerializer(many=True, read_only=True)
    is_liked = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    shared_job_title = serializers.CharField(source="shared_job.title", read_only=True, default=None)
    shared_job_company = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id", "author", "content", "post_type", "image", "shared_job",
            "shared_job_title", "shared_job_company", "article_title", "article_url",
            "visibility", "likes_count", "comments_count", "shares_count",
            "is_liked", "user_reaction", "is_saved", "comments", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "likes_count", "comments_count", "shares_count", "created_at", "updated_at"]

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return PostLike.objects.filter(user=request.user, post=obj).exists()
        return False

    def get_user_reaction(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            like = PostLike.objects.filter(user=request.user, post=obj).first()
            return like.reaction if like else None
        return None

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return PostSave.objects.filter(user=request.user, post=obj).exists()
        return False

    def get_shared_job_company(self, obj):
        if obj.shared_job:
            return obj.shared_job.company.name if obj.shared_job.company else None
        return None


class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ["content", "post_type", "image", "shared_job", "article_title", "article_url", "visibility"]
