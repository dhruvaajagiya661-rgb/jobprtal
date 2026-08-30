"""Tests for the network app (connections, endorsements, follows, profile views)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from .models import Connection, UserFollow, ProfileView

User = get_user_model()


@pytest.fixture
def alice(db):
    return User.objects.create_user(username="alice", email="alice@x.com", password="pw12345!")


@pytest.fixture
def bob(db):
    return User.objects.create_user(username="bob", email="bob@x.com", password="pw12345!")


@pytest.fixture
def client_alice(alice):
    client = APIClient()
    client.force_authenticate(user=alice)
    return client


class TestConnections:
    def test_send_request(self, client_alice, bob):
        response = client_alice.post(
            "/api/v1/connections/send_request/", {"to_user_id": bob.id}, format="json"
        )
        assert response.status_code == 201
        assert Connection.objects.filter(to_user=bob, status="pending").exists()

    def test_cannot_connect_with_self(self, client_alice, alice):
        response = client_alice.post(
            "/api/v1/connections/send_request/", {"to_user_id": alice.id}, format="json"
        )
        assert response.status_code == 400

    def test_duplicate_request_rejected(self, client_alice, alice, bob):
        Connection.objects.create(from_user=alice, to_user=bob, status="pending")
        response = client_alice.post(
            "/api/v1/connections/send_request/", {"to_user_id": bob.id}, format="json"
        )
        assert response.status_code == 400

    def test_accept_request(self, alice, bob):
        connection = Connection.objects.create(from_user=alice, to_user=bob, status="pending")
        client = APIClient()
        client.force_authenticate(user=bob)
        response = client.post(f"/api/v1/connections/{connection.id}/accept/")
        assert response.status_code == 200
        connection.refresh_from_db()
        assert connection.status == "accepted"

    def test_remove_accepted_connection(self, client_alice, alice, bob):
        """Regression: remove() unpacked a set as kwargs and always raised a 500."""
        connection = Connection.objects.create(from_user=alice, to_user=bob, status="accepted")
        response = client_alice.delete(f"/api/v1/connections/{connection.id}/remove/")
        assert response.status_code == 204
        assert not Connection.objects.filter(id=connection.id).exists()

    def test_remove_works_from_receiving_side(self, alice, bob):
        """Either party may remove the connection, not just the sender."""
        connection = Connection.objects.create(from_user=alice, to_user=bob, status="accepted")
        client = APIClient()
        client.force_authenticate(user=bob)
        response = client.delete(f"/api/v1/connections/{connection.id}/remove/")
        assert response.status_code == 204

    def test_cannot_remove_someone_elses_connection(self, client_alice, bob):
        outsider = User.objects.create_user(
            username="carol", email="carol@x.com", password="pw12345!"
        )
        connection = Connection.objects.create(from_user=bob, to_user=outsider, status="accepted")
        response = client_alice.delete(f"/api/v1/connections/{connection.id}/remove/")
        assert response.status_code == 404


class TestSuggestions:
    def test_excludes_self(self, client_alice, alice):
        response = client_alice.get("/api/v1/connections/suggestions/")
        assert response.status_code == 200
        assert alice.id not in [u["id"] for u in response.json()]

    def test_excludes_user_i_sent_a_request_to(self, client_alice, alice, bob):
        """Regression: only from_user_id was collected, so requested users reappeared."""
        Connection.objects.create(from_user=alice, to_user=bob, status="pending")
        response = client_alice.get("/api/v1/connections/suggestions/")
        assert bob.id not in [u["id"] for u in response.json()]

    def test_excludes_user_who_sent_me_a_request(self, client_alice, alice, bob):
        Connection.objects.create(from_user=bob, to_user=alice, status="pending")
        response = client_alice.get("/api/v1/connections/suggestions/")
        assert bob.id not in [u["id"] for u in response.json()]

    def test_includes_unconnected_user(self, client_alice, bob):
        response = client_alice.get("/api/v1/connections/suggestions/")
        assert bob.id in [u["id"] for u in response.json()]


class TestFollows:
    def test_toggle_follow_and_unfollow(self, client_alice, alice, bob):
        response = client_alice.post(
            "/api/v1/follows/toggle/", {"followed_id": bob.id}, format="json"
        )
        assert response.status_code == 200
        assert response.json()["following"] is True
        assert UserFollow.objects.filter(follower=alice, followed=bob).exists()

        response = client_alice.post(
            "/api/v1/follows/toggle/", {"followed_id": bob.id}, format="json"
        )
        assert response.json()["following"] is False
        assert not UserFollow.objects.filter(follower=alice, followed=bob).exists()

    def test_cannot_follow_self(self, client_alice, alice):
        """Regression: following yourself was accepted with a 200."""
        response = client_alice.post(
            "/api/v1/follows/toggle/", {"followed_id": alice.id}, format="json"
        )
        assert response.status_code == 400
        assert not UserFollow.objects.filter(follower=alice, followed=alice).exists()

    def test_unknown_user_returns_404_not_dangling_row(self, client_alice):
        """Regression: an unknown id wrote a row with a dangling foreign key."""
        response = client_alice.post(
            "/api/v1/follows/toggle/", {"followed_id": 999999}, format="json"
        )
        assert response.status_code == 404
        assert not UserFollow.objects.filter(followed_id=999999).exists()

    def test_non_numeric_id_returns_400(self, client_alice):
        response = client_alice.post(
            "/api/v1/follows/toggle/", {"followed_id": "abc"}, format="json"
        )
        assert response.status_code == 400


class TestProfileViews:
    def test_record_view(self, client_alice, alice, bob):
        response = client_alice.post(
            "/api/v1/profile-views/record_view/", {"viewed_id": bob.id}, format="json"
        )
        assert response.status_code == 200
        assert ProfileView.objects.filter(viewer=alice, viewed=bob).exists()

    def test_self_view_not_recorded(self, client_alice, alice):
        client_alice.post(
            "/api/v1/profile-views/record_view/", {"viewed_id": alice.id}, format="json"
        )
        assert not ProfileView.objects.filter(viewer=alice, viewed=alice).exists()

    def test_non_numeric_id_does_not_500(self, client_alice):
        """Regression: int('abc') raised ValueError and surfaced as a 500."""
        response = client_alice.post(
            "/api/v1/profile-views/record_view/", {"viewed_id": "abc"}, format="json"
        )
        assert response.status_code == 200

    def test_unknown_user_not_recorded(self, client_alice):
        """Regression: an unknown id wrote a row with a dangling foreign key."""
        response = client_alice.post(
            "/api/v1/profile-views/record_view/", {"viewed_id": 999999}, format="json"
        )
        assert response.status_code == 200
        assert not ProfileView.objects.filter(viewed_id=999999).exists()

    def test_owner_sees_own_viewer_list(self, client_alice, alice, bob):
        ProfileView.objects.create(viewer=bob, viewed=alice)
        response = client_alice.get(f"/api/v1/profile-views/views/{alice.id}/")
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_cannot_read_another_users_viewer_list(self, client_alice, bob):
        """"Who viewed me" is private to the owner.

        This route was AllowAny, so any caller could walk user ids and
        enumerate anyone's visitors.
        """
        response = client_alice.get(f"/api/v1/profile-views/views/{bob.id}/")
        assert response.status_code == 403

    def test_anonymous_cannot_read_viewer_list(self, bob):
        response = APIClient().get(f"/api/v1/profile-views/views/{bob.id}/")
        assert response.status_code == 401

    def test_staff_can_read_any_viewer_list(self, db, alice, bob):
        """Admins keep full visibility."""
        ProfileView.objects.create(viewer=alice, viewed=bob)
        staff = User.objects.create_user(
            username="root", email="root@x.com", password="pw12345!", is_staff=True
        )
        client = APIClient()
        client.force_authenticate(user=staff)
        response = client.get(f"/api/v1/profile-views/views/{bob.id}/")
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_anonymous_record_view_still_allowed(self, bob):
        """Signed-out visits must not 401; the view silently no-ops."""
        response = APIClient().post(
            "/api/v1/profile-views/record_view/", {"viewed_id": bob.id}, format="json"
        )
        assert response.status_code == 200
        assert not ProfileView.objects.filter(viewed=bob).exists()


class TestEndorsements:
    def test_non_numeric_user_id_returns_400(self, client_alice):
        """Regression: a non-numeric user_id reached the ORM and raised a 500."""
        response = client_alice.get("/api/v1/endorsements/user_endorsements/?user_id=abc")
        assert response.status_code == 400

    def test_recommendations_non_numeric_user_id_returns_400(self, client_alice):
        response = client_alice.get("/api/v1/recommendations/user_recommendations/?user_id=abc")
        assert response.status_code == 400
