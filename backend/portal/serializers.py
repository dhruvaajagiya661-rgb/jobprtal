"""Shared DRF serializer utilities."""

from rest_framework import serializers


class EmptySerializer(serializers.Serializer):
    """Placeholder serializer for viewset actions that build ad-hoc dict
    responses. Gives drf-spectacular a validly named component ("Empty")
    so those endpoints stay in the OpenAPI schema."""
