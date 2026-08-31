from rest_framework import serializers
from .models import Connection, SkillEndorsement, Recommendation, ProfileView, UserFollow


class ConnectionSerializer(serializers.ModelSerializer):
    from_user_email = serializers.EmailField(source="from_user.email", read_only=True)
    from_user_username = serializers.CharField(source="from_user.username", read_only=True)
    to_user_email = serializers.EmailField(source="to_user.email", read_only=True)
    to_user_username = serializers.CharField(source="to_user.username", read_only=True)

    class Meta:
        model = Connection
        fields = [
            "id", "from_user", "from_user_email", "from_user_username",
            "to_user", "to_user_email", "to_user_username",
            "status", "message", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class SkillEndorsementSerializer(serializers.ModelSerializer):
    endorser_email = serializers.EmailField(source="endorser.email", read_only=True)
    endorsee_email = serializers.EmailField(source="endorsee.email", read_only=True)
    skill_name = serializers.CharField(source="skill.name", read_only=True)

    class Meta:
        model = SkillEndorsement
        fields = ["id", "endorser", "endorser_email", "endorsee", "endorsee_email", "skill", "skill_name", "created_at"]
        read_only_fields = ["id", "created_at"]


class RecommendationSerializer(serializers.ModelSerializer):
    recommender_email = serializers.EmailField(source="recommender.email", read_only=True)
    recommendee_email = serializers.EmailField(source="recommendee.email", read_only=True)

    class Meta:
        model = Recommendation
        fields = [
            "id", "recommender", "recommender_email", "recommendee", "recommendee_email",
            "relationship", "content", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ProfileViewSerializer(serializers.ModelSerializer):
    viewer_email = serializers.EmailField(source="viewer.email", read_only=True)
    viewer_username = serializers.CharField(source="viewer.username", read_only=True)

    class Meta:
        model = ProfileView
        fields = ["id", "viewer", "viewer_email", "viewer_username", "viewed", "created_at"]
        read_only_fields = ["id", "created_at"]


class UserFollowSerializer(serializers.ModelSerializer):
    follower_email = serializers.EmailField(source="follower.email", read_only=True)
    followed_email = serializers.EmailField(source="followed.email", read_only=True)

    class Meta:
        model = UserFollow
        fields = ["id", "follower", "follower_email", "followed", "followed_email", "created_at"]
        read_only_fields = ["id", "created_at"]
