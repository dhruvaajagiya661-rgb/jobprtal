from rest_framework import viewsets, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from .models import Internship
from .serializers import InternshipListSerializer, InternshipDetailSerializer
from recruiters.scoping import scope_postings


class InternshipViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for viewing internships.
    Provides list with search/filter and detail views.
    """

    serializer_class = InternshipListSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description", "company__name", "location"]
    ordering_fields = ["created_at", "stipend", "title"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return InternshipDetailSerializer
        return InternshipListSerializer

    def get_queryset(self):
        queryset = (
            Internship.objects.filter(is_active=True)
            .select_related("company", "category")
            .prefetch_related("skills_required", "preferred_skills")
        )

        # Text search
        q = self.request.query_params.get("q")
        if q:
            queryset = queryset.filter(
                Q(title__icontains=q)
                | Q(company__name__icontains=q)
                | Q(location__icontains=q)
            )

        # Type filter (supports comma-separated values, e.g. ?type=Part-time,Remote)
        internship_types = []
        for value in self.request.query_params.getlist("type"):
            internship_types.extend(
                t.strip() for t in value.split(",") if t.strip()
            )
        if internship_types:
            queryset = queryset.filter(internship_type__in=internship_types)

        # Stipend filter
        stipend = self.request.query_params.get("stipend")
        if stipend == "paid":
            queryset = queryset.exclude(stipend__icontains="unpaid").exclude(
                stipend="0"
            )
        elif stipend == "unpaid":
            queryset = queryset.filter(stipend__icontains="unpaid")

        # Category filter
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__name__icontains=category)

        # A recruiter account stands for a company: it sees that company's
        # postings everywhere on the site, and no other company's.
        if self.request.user.is_authenticated and self.request.user.is_recruiter:
            queryset = scope_postings(queryset, self.request.user)

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[permissions.AllowAny])
    def featured(self, request):
        """Return featured/random internships for the homepage."""
        internships = self.get_queryset().order_by("-created_at")[:3]
        serializer = InternshipListSerializer(
            internships, many=True, context={"request": request}
        )
        return Response(serializer.data)
