"""Tests for the feed app (posts, likes, comments, saves)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from .models import Post, PostLike, PostComment, PostSave

User = get_user_model()


@pytest.fixture
def alice(db):
    return User.objects.create_user(username="alice", email="alice@x.com", password="pw12345!")


@pytest.fixture
def client_alice(alice):
    client = APIClient()
    client.force_authenticate(user=alice)
    return client


@pytest.fixture
def post(alice):
    return Post.objects.create(author=alice, content="hello world", visibility="public")


class TestPosts:
    def test_anonymous_sees_public_posts(self, post):
        response = APIClient().get("/api/v1/feed/")
        assert response.status_code == 200

    def test_create_post(self, client_alice, alice):
        response = client_alice.post(
            "/api/v1/feed/", {"content": "my first post"}, format="json"
        )
        assert response.status_code == 201
        assert Post.objects.filter(author=alice, content="my first post").exists()

    def test_create_requires_auth(self):
        response = APIClient().post("/api/v1/feed/", {"content": "spam"}, format="json")
        assert response.status_code in (401, 403)

    def test_author_can_delete_own_post(self, client_alice, post):
        response = client_alice.delete(f"/api/v1/feed/{post.id}/")
        assert response.status_code == 204
        assert not Post.objects.filter(id=post.id).exists()

    def test_cannot_delete_another_users_post(self, client_alice):
        other = User.objects.create_user(
            username="bob", email="bob@x.com", password="pw12345!"
        )
        other_post = Post.objects.create(author=other, content="theirs", visibility="public")
        response = client_alice.delete(f"/api/v1/feed/{other_post.id}/")
        assert response.status_code == 404
        assert Post.objects.filter(id=other_post.id).exists()

    def test_missing_post_returns_404(self, client_alice):
        response = client_alice.get("/api/v1/feed/999999/")
        assert response.status_code == 404


class TestLikes:
    def test_like_then_unlike_keeps_count_consistent(self, client_alice, post):
        response = client_alice.post(f"/api/v1/feed/{post.id}/like/", {}, format="json")
        assert response.json()["liked"] is True
        post.refresh_from_db()
        assert post.likes_count == 1

        response = client_alice.post(f"/api/v1/feed/{post.id}/like/", {}, format="json")
        assert response.json()["liked"] is False
        post.refresh_from_db()
        assert post.likes_count == 0
        assert not PostLike.objects.filter(post=post).exists()

    def test_changing_reaction_does_not_double_count(self, client_alice, post):
        client_alice.post(f"/api/v1/feed/{post.id}/like/", {"reaction": "like"}, format="json")
        client_alice.post(
            f"/api/v1/feed/{post.id}/like/", {"reaction": "celebrate"}, format="json"
        )
        post.refresh_from_db()
        assert post.likes_count == 1


class TestComments:
    def test_add_comment_increments_count(self, client_alice, post):
        response = client_alice.post(
            f"/api/v1/feed/{post.id}/comment/", {"content": "nice"}, format="json"
        )
        assert response.status_code == 201
        post.refresh_from_db()
        assert post.comments_count == 1

    def test_empty_comment_rejected(self, client_alice, post):
        response = client_alice.post(
            f"/api/v1/feed/{post.id}/comment/", {"content": "   "}, format="json"
        )
        assert response.status_code == 400

    def test_reply_to_valid_parent(self, client_alice, alice, post):
        parent = PostComment.objects.create(user=alice, post=post, content="parent")
        response = client_alice.post(
            f"/api/v1/feed/{post.id}/comment/",
            {"content": "reply", "parent": parent.id},
            format="json",
        )
        assert response.status_code == 201

    def test_unknown_parent_rejected(self, client_alice, post):
        """Regression: an unknown parent id wrote a row with a dangling foreign key."""
        response = client_alice.post(
            f"/api/v1/feed/{post.id}/comment/",
            {"content": "reply", "parent": 999999},
            format="json",
        )
        assert response.status_code == 400
        assert not PostComment.objects.filter(parent_id=999999).exists()

    def test_non_numeric_parent_rejected(self, client_alice, post):
        response = client_alice.post(
            f"/api/v1/feed/{post.id}/comment/",
            {"content": "reply", "parent": "abc"},
            format="json",
        )
        assert response.status_code == 400

    def test_parent_from_another_post_rejected(self, client_alice, alice, post):
        """A reply must not attach to a comment belonging to a different post."""
        other_post = Post.objects.create(author=alice, content="other", visibility="public")
        foreign_parent = PostComment.objects.create(
            user=alice, post=other_post, content="elsewhere"
        )
        response = client_alice.post(
            f"/api/v1/feed/{post.id}/comment/",
            {"content": "reply", "parent": foreign_parent.id},
            format="json",
        )
        assert response.status_code == 400


class TestSaves:
    def test_toggle_save(self, client_alice, alice, post):
        response = client_alice.post(f"/api/v1/feed/{post.id}/toggle_save/", {}, format="json")
        assert response.json()["saved"] is True
        assert PostSave.objects.filter(user=alice, post=post).exists()

        response = client_alice.post(f"/api/v1/feed/{post.id}/toggle_save/", {}, format="json")
        assert response.json()["saved"] is False
        assert not PostSave.objects.filter(user=alice, post=post).exists()

    def test_saved_list(self, client_alice, alice, post):
        PostSave.objects.create(user=alice, post=post)
        response = client_alice.get("/api/v1/feed/saved/")
        assert response.status_code == 200
        assert len(response.json()) == 1


class TestTrending:
    def test_trending_is_public(self, post):
        response = APIClient().get("/api/v1/feed/trending/")
        assert response.status_code == 200


class TestAuthorEmailPrivacy:
    """The feed is readable anonymously, so author emails must not ride along.

    Regression guard: PostAuthorSerializer used to expose ``email``
    unconditionally, letting an unauthenticated scraper harvest the address of
    every user who had posted publicly.
    """

    def test_anonymous_does_not_receive_author_email(self, post):
        response = APIClient().get("/api/v1/feed/")
        assert response.status_code == 200
        rows = response.data.get("results", response.data)
        assert rows, "expected at least one public post"
        for row in rows:
            assert row["author"]["email"] == ""
            # username is what clients actually display, and must survive
            assert row["author"]["username"]

    def test_authenticated_user_still_receives_author_email(self, client_alice, post):
        response = client_alice.get("/api/v1/feed/")
        assert response.status_code == 200
        rows = response.data.get("results", response.data)
        assert any(r["author"]["email"] == "alice@x.com" for r in rows)
