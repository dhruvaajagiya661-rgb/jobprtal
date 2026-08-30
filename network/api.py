from django.db.models import Q
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from portal.query_utils import parse_id
# DRF's get_object_or_404 is the same shortcut but also turns a pk that
# cannot be coerced to the field type (e.g. /courses/abc/) into a 404
# instead of letting the ValueError surface as a 500.
from rest_framework.generics import get_object_or_404

from .models import Connection, SkillEndorsement, Recommendation, ProfileView, UserFollow
from .serializers import (
    ConnectionSerializer, SkillEndorsementSerializer,
    RecommendationSerializer, ProfileViewSerializer, UserFollowSerializer,
)


class ConnectionViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConnectionSerializer

    def get_queryset(self):
        user = self.request.user
        return Connection.objects.filter(Q(from_user=user) | Q(to_user=user))

    @action(detail=False, methods=["get"])
    def list_connections(self, request):
        """Get all accepted connections."""
        connections = Connection.objects.filter(
            Q(from_user=request.user, status="accepted") | Q(to_user=request.user, status="accepted")
        ).select_related("from_user", "to_user")
        serializer = ConnectionSerializer(connections, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def pending(self, request):
        """Get pending connection requests (received)."""
        connections = Connection.objects.filter(
            to_user=request.user, status="pending"
        ).select_related("from_user", "to_user")
        serializer = ConnectionSerializer(connections, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def sent(self, request):
        """Get pending connection requests (sent)."""
        connections = Connection.objects.filter(
            from_user=request.user, status="pending"
        ).select_related("from_user", "to_user")
        serializer = ConnectionSerializer(connections, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def send_request(self, request):
        """Send a connection request."""
        to_user_id = request.data.get("to_user_id")
        message = request.data.get("message", "")

        if not to_user_id:
            return Response({"error": "to_user_id is required"}, status=400)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        to_user = get_object_or_404(User, id=to_user_id)

        if to_user == request.user:
            return Response({"error": "Cannot connect with yourself"}, status=400)

        # Check if connection already exists
        existing = Connection.objects.filter(
            Q(from_user=request.user, to_user=to_user) | Q(from_user=to_user, to_user=request.user)
        ).first()

        if existing:
            if existing.status == "accepted":
                return Response({"error": "Already connected"}, status=400)
            elif existing.status == "pending":
                return Response({"error": "Connection request already pending"}, status=400)
            else:
                # Rejected before - allow new request
                existing.delete()

        connection = Connection.objects.create(
            from_user=request.user, to_user=to_user, message=message
        )
        return Response(ConnectionSerializer(connection, context={"request": request}).data, status=201)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        """Accept a connection request."""
        connection = get_object_or_404(Connection, pk=pk, to_user=request.user, status="pending")
        connection.status = "accepted"
        connection.save(update_fields=["status", "updated_at"])
        return Response(ConnectionSerializer(connection, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Reject a connection request."""
        connection = get_object_or_404(Connection, pk=pk, to_user=request.user, status="pending")
        connection.status = "rejected"
        connection.save(update_fields=["status", "updated_at"])
        return Response(ConnectionSerializer(connection, context={"request": request}).data)

    @action(detail=True, methods=["delete"])
    def remove(self, request, pk=None):
        """Remove an existing connection."""
        connection = get_object_or_404(
            Connection,
            Q(from_user=request.user) | Q(to_user=request.user),
            pk=pk, status="accepted",
        )
        connection.delete()
        return Response(status=204)

    @action(detail=False, methods=["get"])
    def suggestions(self, request):
        """Get connection suggestions: users not yet connected."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        # Exclude both sides of every existing connection, whichever direction it
        # was sent in - otherwise people the user already requested keep showing up.
        connected_ids = {request.user.id}
        for from_id, to_id in Connection.objects.filter(
            Q(from_user=request.user) | Q(to_user=request.user)
        ).values_list("from_user_id", "to_user_id"):
            connected_ids.add(from_id)
            connected_ids.add(to_id)

        suggestions = User.objects.exclude(id__in=connected_ids).select_related("student_profile", "recruiter_profile")[:20]

        # No email here: these are strangers, not connections. Emails stay on
        # ConnectionSerializer, where a mutual relationship justifies them.
        data = []
        for user in suggestions:
            headline = ""
            recruiter = getattr(user, "recruiter_profile", None)
            student = getattr(user, "student_profile", None)
            if recruiter is not None:
                company = getattr(recruiter.company, "name", "")
                headline = " at ".join(x for x in (recruiter.designation, company) if x)
            elif student is not None:
                headline = (student.education or "").splitlines()[:1]
                headline = headline[0][:80] if headline else ""
            data.append({
                "id": user.id,
                "username": user.username,
                "full_name": user.get_full_name().strip() or user.username,
                "headline": headline,
                "is_student": user.is_student,
                "is_recruiter": user.is_recruiter,
            })
        return Response(data)


class EndorsementViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SkillEndorsementSerializer

    @action(detail=False, methods=["post"])
    def endorse(self, request):
        """Endorse a user for a skill."""
        endorsee_id = request.data.get("endorsee_id")
        skill_id = request.data.get("skill_id")

        if not endorsee_id or not skill_id:
            return Response({"error": "endorsee_id and skill_id are required"}, status=400)

        from django.contrib.auth import get_user_model
        from jobs.models import Skill
        User = get_user_model()
        endorsee = get_object_or_404(User, id=endorsee_id)
        skill = get_object_or_404(Skill, id=skill_id)

        if endorsee == request.user:
            return Response({"error": "Cannot endorse yourself"}, status=400)

        endorsement, created = SkillEndorsement.objects.get_or_create(
            endorser=request.user, endorsee=endorsee, skill=skill
        )
        if not created:
            endorsement.delete()
            return Response({"endorsed": False})

        return Response({"endorsed": True, "skill_name": skill.name}, status=201)

    @action(detail=False, methods=["get"])
    def user_endorsements(self, request):
        """Get endorsements received by a user."""
        user_id = parse_id(request.query_params.get("user_id", request.user.id))
        if user_id is None:
            return Response({"error": "Invalid user_id"}, status=400)
        endorsements = SkillEndorsement.objects.filter(endorsee_id=user_id).select_related("endorser", "skill")

        # Group by skill
        result = {}
        for e in endorsements:
            skill_name = e.skill.name
            if skill_name not in result:
                result[skill_name] = {"skill": skill_name, "skill_id": e.skill.id, "count": 0, "endorsers": []}
            result[skill_name]["count"] += 1
            result[skill_name]["endorsers"].append({
                "id": e.endorser.id,
                "email": e.endorser.email,
                "username": e.endorser.username,
            })

        return Response(list(result.values()))


class RecommendationViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = RecommendationSerializer

    @action(detail=False, methods=["post"])
    def request_recommendation(self, request):
        """Request a recommendation from someone."""
        recommendee_id = request.data.get("recommendee_id")
        relationship = request.data.get("relationship", "")

        if not recommendee_id:
            return Response({"error": "recommendee_id is required"}, status=400)

        from django.contrib.auth import get_user_model
        from notifications.models import Notification
        User = get_user_model()
        recommendee = get_object_or_404(User, id=recommendee_id)

        Notification.objects.create(
            user=recommendee,
            title="Recommendation Request",
            message=f"{request.user.username} is requesting a recommendation from you.",
        )
        return Response({"status": "request_sent"})

    @action(detail=False, methods=["post"])
    def give(self, request):
        """Give a recommendation."""
        recommendee_id = request.data.get("recommendee_id")
        relationship = request.data.get("relationship", "")
        content = request.data.get("content", "")

        if not recommendee_id or not content:
            return Response({"error": "recommendee_id and content are required"}, status=400)

        from django.contrib.auth import get_user_model
        User = get_user_model()
        recommendee = get_object_or_404(User, id=recommendee_id)

        rec = Recommendation.objects.create(
            recommender=request.user, recommendee=recommendee,
            relationship=relationship, content=content,
        )
        return Response(RecommendationSerializer(rec).data, status=201)

    @action(detail=False, methods=["get"])
    def user_recommendations(self, request):
        """Get recommendations received by a user."""
        user_id = parse_id(request.query_params.get("user_id", request.user.id))
        if user_id is None:
            return Response({"error": "Invalid user_id"}, status=400)
        recs = Recommendation.objects.filter(recommendee_id=user_id).select_related("recommender")
        serializer = RecommendationSerializer(recs, many=True)
        return Response(serializer.data)


class ProfileViewSet(viewsets.GenericViewSet):
    # record_view opts back down to AllowAny; the listing below must not,
    # so the default here is authenticated.
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["get"], url_path="views/(?P<user_id>[^/.]+)")
    def profile_views(self, request, user_id=None):
        """Get who viewed a user's profile.

        "Who looked at me" is private to the profile owner. This was AllowAny,
        so anyone - signed out included - could enumerate any user's visitors
        by walking ids. Owners see their own list; staff see any.
        """
        user_id = parse_id(user_id)
        if user_id is None:
            return Response({"error": "Invalid user_id"}, status=400)
        if user_id != request.user.id and not request.user.is_staff:
            return Response(
                {"error": "You can only see who viewed your own profile"}, status=403
            )
        views = ProfileView.objects.filter(viewed_id=user_id).select_related("viewer")[:50]
        serializer = ProfileViewSerializer(views, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], permission_classes=[permissions.AllowAny])
    def record_view(self, request):
        """Record a profile view."""
        viewed_id = parse_id(request.data.get("viewed_id"))
        if viewed_id is None or not request.user.is_authenticated:
            return Response(status=200)  # Silently skip for anon / bad input
        if viewed_id == request.user.id:
            return Response(status=200)

        from django.contrib.auth import get_user_model
        if not get_user_model().objects.filter(id=viewed_id).exists():
            return Response(status=200)  # Unknown user - nothing to record

        ProfileView.objects.get_or_create(
            viewer=request.user, viewed_id=viewed_id
        )
        return Response(status=200)


def public_profile_payload(user):
    """Public-safe view of any user.

    Deliberately omits everything private: resume file, email, raw GitHub API
    dumps. Anything added to StudentProfile later is excluded by default -
    this is an allow-list, not a blocklist.
    """
    full_name = user.get_full_name().strip()
    data = {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": full_name or user.username,
        "is_student": user.is_student,
        "is_recruiter": user.is_recruiter,
        "date_joined": user.date_joined,
    }

    student = getattr(user, "student_profile", None)
    if student is not None:
        data["student_profile"] = {
            "profile_photo": student.profile_photo.url if student.profile_photo else None,
            "education": student.education,
            "experience": student.experience,
            "portfolio_link": student.portfolio_link,
            "github_link": student.github_link,
            "github_username": student.github_username,
            "linkedin_link": student.linkedin_link,
            "projects": student.projects,
            "skills": [
                {"id": s.id, "name": s.name} for s in student.skills.all()
            ],
        }

    recruiter = getattr(user, "recruiter_profile", None)
    if recruiter is not None:
        company = recruiter.company
        data["recruiter_profile"] = {
            "designation": recruiter.designation,
            "company": {
                "id": company.id,
                "name": company.name,
                "logo": company.logo.url if company.logo else None,
                "industry": company.industry,
                "location": company.location,
            } if company else None,
        }

    return data


class PublicProfileViewSet(viewsets.GenericViewSet):
    """Read-only public profile for any user, by id.

    The SPA had no such endpoint, so /profile/:id fell back to fetching the
    *caller's own* profile and rendering "Profile not found" whenever the id
    did not match - every profile link in the app was a dead end.
    """

    permission_classes = [permissions.IsAuthenticated]

    def retrieve(self, request, pk=None):
        user_id = parse_id(pk)
        if user_id is None:
            return Response({"error": "Invalid user id"}, status=400)

        from django.contrib.auth import get_user_model
        user = (
            get_user_model()
            .objects.filter(id=user_id, is_active=True)
            .select_related("student_profile", "recruiter_profile__company")
            .prefetch_related("student_profile__skills")
            .first()
        )
        if user is None:
            return Response({"error": "Profile not found"}, status=404)

        payload = public_profile_payload(user)

        # Relationship context, so the page can render the right CTA without
        # a second round trip.
        connection = Connection.objects.filter(
            Q(from_user=request.user, to_user=user) | Q(from_user=user, to_user=request.user)
        ).first()
        if connection is None or connection.status == "rejected":
            payload["connection_status"] = "none"
        elif connection.status == "accepted":
            payload["connection_status"] = "connected"
        elif connection.from_user_id == request.user.id:
            payload["connection_status"] = "pending_sent"
        else:
            payload["connection_status"] = "pending_received"
        payload["connection_id"] = connection.id if connection else None
        payload["is_following"] = UserFollow.objects.filter(
            follower=request.user, followed=user
        ).exists()
        payload["is_self"] = user.id == request.user.id

        return Response(payload)


class FollowViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=["post"])
    def toggle(self, request):
        """Follow/unfollow a user."""
        followed_id = parse_id(request.data.get("followed_id"))
        if followed_id is None:
            return Response({"error": "A valid followed_id is required"}, status=400)

        if followed_id == request.user.id:
            return Response({"error": "Cannot follow yourself"}, status=400)

        from django.contrib.auth import get_user_model
        if not get_user_model().objects.filter(id=followed_id).exists():
            return Response({"error": "User not found"}, status=404)

        follow, created = UserFollow.objects.get_or_create(
            follower=request.user, followed_id=followed_id
        )
        if not created:
            follow.delete()
            return Response({"following": False})
        return Response({"following": True})
