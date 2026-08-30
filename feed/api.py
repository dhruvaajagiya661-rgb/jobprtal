from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
# DRF's get_object_or_404 is the same shortcut but also turns a pk that
# cannot be coerced to the field type (e.g. /courses/abc/) into a 404
# instead of letting the ValueError surface as a 500.
from rest_framework.generics import get_object_or_404

from .models import Post, PostLike, PostComment, CommentLike, PostSave
from .serializers import (
    PostSerializer, PostCreateSerializer,
    PostCommentSerializer,
)
from network.models import Connection


class FeedViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PostSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve", "trending"):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def list(self, request):
        """Feed: posts from connections + self, or all public if not connected."""
        user = request.user if request.user.is_authenticated else None
        queryset = Post.objects.select_related("author", "shared_job__company").all()

        if user and user.is_authenticated:
            connected_ids = set(
                Connection.objects.filter(from_user=user, status="accepted").values_list("to_user_id", flat=True)
            )
            connected_ids |= set(
                Connection.objects.filter(to_user=user, status="accepted").values_list("from_user_id", flat=True)
            )
            connected_ids.add(user.id)
            queryset = queryset.filter(Q(author_id__in=connected_ids) | Q(visibility="public"))
        else:
            queryset = queryset.filter(visibility="public")

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = PostSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)

        serializer = PostSerializer(queryset[:50], many=True, context={"request": request})
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        post = get_object_or_404(Post, pk=pk)
        serializer = PostSerializer(post, context={"request": request})
        return Response(serializer.data)

    def create(self, request):
        serializer = PostCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = serializer.save(author=request.user)
        return Response(PostSerializer(post, context={"request": request}).data, status=201)

    def destroy(self, request, pk=None):
        post = get_object_or_404(Post, pk=pk, author=request.user)
        post.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"])
    def like(self, request, pk=None):
        """Toggle like/reaction on a post."""
        post = get_object_or_404(Post, pk=pk)
        reaction = request.data.get("reaction", "like")

        like, created = PostLike.objects.get_or_create(
            user=request.user, post=post, defaults={"reaction": reaction}
        )
        if not created:
            if like.reaction == reaction:
                like.delete()
                post.likes_count = max(0, post.likes_count - 1)
                post.save(update_fields=["likes_count"])
                return Response({"liked": False, "reaction": None})
            else:
                like.reaction = reaction
                like.save(update_fields=["reaction"])
                return Response({"liked": True, "reaction": reaction})
        else:
            post.likes_count += 1
            post.save(update_fields=["likes_count"])
            return Response({"liked": True, "reaction": reaction})

    @action(detail=True, methods=["post"])
    def comment(self, request, pk=None):
        """Add a comment to a post."""
        post = get_object_or_404(Post, pk=pk)
        content = request.data.get("content", "").strip()
        parent_id = request.data.get("parent")

        if not content:
            return Response({"error": "Content is required"}, status=400)

        # A reply's parent must be a real comment on this same post.
        if parent_id is not None:
            try:
                parent_id = int(parent_id)
            except (TypeError, ValueError):
                return Response({"error": "Invalid parent comment id"}, status=400)
            if not PostComment.objects.filter(pk=parent_id, post=post).exists():
                return Response({"error": "Parent comment not found on this post"}, status=400)

        comment = PostComment.objects.create(
            user=request.user, post=post, parent_id=parent_id, content=content,
        )
        post.comments_count += 1
        post.save(update_fields=["comments_count"])

        return Response(PostCommentSerializer(comment, context={"request": request}).data, status=201)

    @action(detail=True, methods=["post"])
    def toggle_save(self, request, pk=None):
        """Save/unsave a post."""
        post = get_object_or_404(Post, pk=pk)
        save, created = PostSave.objects.get_or_create(user=request.user, post=post)
        if not created:
            save.delete()
            return Response({"saved": False})
        return Response({"saved": True})

    @action(detail=False, methods=["get"])
    def trending(self, request):
        """Get trending posts by likes + comments in last 7 days."""
        from django.utils import timezone
        from datetime import timedelta

        week_ago = timezone.now() - timedelta(days=7)
        posts = Post.objects.filter(
            created_at__gte=week_ago, visibility="public"
        ).select_related("author", "shared_job__company").order_by("-likes_count", "-comments_count")[:20]

        serializer = PostSerializer(posts, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def my_posts(self, request):
        """Get current user's posts."""
        posts = Post.objects.filter(author=request.user).select_related("author", "shared_job__company")
        serializer = PostSerializer(posts, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def saved(self, request):
        """Get user's saved posts."""
        posts = Post.objects.filter(saves__user=request.user).select_related("author", "shared_job__company")
        serializer = PostSerializer(posts, many=True, context={"request": request})
        return Response(serializer.data)
