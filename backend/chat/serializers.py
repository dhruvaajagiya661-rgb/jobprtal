from rest_framework import serializers
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    receiver_name = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = (
            "id",
            "sender",
            "sender_name",
            "receiver",
            "receiver_name",
            "content",
            "timestamp",
            "is_read",
        )
        read_only_fields = ("sender", "timestamp", "is_read")

    def get_sender_name(self, obj) -> str:
        return obj.sender.get_full_name() or obj.sender.username

    def get_receiver_name(self, obj) -> str:
        return obj.receiver.get_full_name() or obj.receiver.username


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("receiver", "content")
