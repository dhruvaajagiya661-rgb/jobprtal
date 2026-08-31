from rest_framework import status
from rest_framework import serializers
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from .serializers import UserSerializer
from .models import CustomUser
from portal.throttling import AuthRateThrottle
from chat.tasks import run_email_task, send_welcome_email

AuthResponseSerializer = inline_serializer(
    name="AuthResponse",
    fields={
        "user": UserSerializer(),
        "access": serializers.CharField(),
        "refresh": serializers.CharField(),
    },
)

ErrorResponseSerializer = inline_serializer(
    name="ErrorResponse",
    fields={"error": serializers.CharField()},
)

MessageResponseSerializer = inline_serializer(
    name="MessageResponse",
    fields={"message": serializers.CharField()},
)

RegisterResponseSerializer = inline_serializer(
    name="RegisterResponse",
    fields={
        "user": UserSerializer(),
        "message": serializers.CharField(),
    },
)


@extend_schema(
    request=inline_serializer(
        name="RegisterRequest",
        fields={
            "email": serializers.EmailField(),
            "password": serializers.CharField(write_only=True),
            "username": serializers.CharField(required=False),
            "role": serializers.ChoiceField(
                choices=["student", "recruiter"], required=False
            ),
            "user_type": serializers.ChoiceField(
                choices=["student", "recruiter"], required=False
            ),
            "company_name": serializers.CharField(required=False, allow_blank=True),
            "location": serializers.CharField(required=False, allow_blank=True),
        },
    ),
    responses={201: RegisterResponseSerializer, 400: ErrorResponseSerializer},
)
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def register(request):
    role = (
        request.data.get("role") or request.data.get("user_type") or "student"
    ).lower()
    if role not in ("student", "recruiter"):
        return Response(
            {"error": "Role must be either 'student' or 'recruiter'"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    email = request.data.get("email")
    password = request.data.get("password")
    username = request.data.get("username") or (email or "").split("@")[0]

    if not email or not password:
        return Response(
            {"error": "Email and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Validate email format early so invalid input returns a clean 400
    # instead of creating broken accounts.
    try:
        validate_email(email)
    except DjangoValidationError:
        return Response(
            {"error": "Please provide a valid email address"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(password) < 8:
        return Response(
            {"error": "Password must be at least 8 characters"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Case-insensitive checks so Foo@Bar.com and foo@bar.com (or the derived
    # usernames) cannot both register, and a taken custom username returns a
    # clean 400 instead of a 500 IntegrityError from the unique constraints.
    if CustomUser.objects.filter(email__iexact=email).exists():
        return Response(
            {"error": "User with this email already exists"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if CustomUser.objects.filter(username__iexact=username).exists():
        return Response(
            {"error": "Username is already taken"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = CustomUser.objects.create_user(
            email=email,
            password=password,
            username=username,
            is_student=(role == "student"),
            is_recruiter=(role == "recruiter"),
        )
    except IntegrityError:
        # Belt-and-suspenders against a race between the checks above and the
        # insert (both email and username have DB-level unique constraints).
        return Response(
            {"error": "Username or email is already in use"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Create student or recruiter profile
    if role == "student":
        from students.models import StudentProfile

        StudentProfile.objects.create(user=user)
    elif role == "recruiter":
        from recruiters.models import RecruiterProfile, Company

        company_name = request.data.get("company_name", "")
        designation = request.data.get("designation", "Recruiter")
        company = None
        if company_name:
            # Always create a fresh company: get_or_create would silently
            # share one Company row across recruiters who register with the
            # same company name (logo, description, industry all overlap).
            company = Company.objects.create(
                name=company_name,
                description="",
                location=request.data.get("location", ""),
            )
        RecruiterProfile.objects.create(
            user=user, company=company, designation=designation
        )

    # Welcome email (fire-and-forget; never blocks or fails the request).
    run_email_task(send_welcome_email, user.id)

    # No tokens on purpose: registration must not auto-login the new
    # account. The client redirects to the login page instead.
    serializer = UserSerializer(user)

    return Response(
        {
            "user": serializer.data,
            "message": "Registration successful. Please log in.",
        },
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    request=inline_serializer(
        name="LoginRequest",
        fields={
            "email": serializers.EmailField(),
            "password": serializers.CharField(write_only=True),
        },
    ),
    responses={
        200: AuthResponseSerializer,
        400: ErrorResponseSerializer,
        401: ErrorResponseSerializer,
    },
)
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def login(request):
    email = request.data.get("email")
    password = request.data.get("password")

    if not email or not password:
        return Response(
            {"error": "Email and password are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, email=email, password=password)

    if user is None:
        return Response(
            {"error": "Invalid email or password"}, status=status.HTTP_401_UNAUTHORIZED
        )

    # Track last_login (UPDATE_LAST_LOGIN only hooks SimpleJWT's own views,
    # so record it here for the custom login the frontend uses).
    CustomUser.objects.filter(pk=user.pk).update(last_login=timezone.now())
    user.refresh_from_db()

    refresh = RefreshToken.for_user(user)
    serializer = UserSerializer(user)

    return Response(
        {
            "user": serializer.data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
    )


@extend_schema(responses={200: UserSerializer})
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    serializer = UserSerializer(request.user)
    data = serializer.data

    # Add profile data
    if request.user.is_student:
        from students.serializers import StudentProfileSerializer
        from students.models import StudentProfile

        profile = StudentProfile.objects.filter(user=request.user).first()
        if profile:
            data["profile"] = StudentProfileSerializer(profile).data
    elif request.user.is_recruiter:
        from recruiters.serializers import RecruiterProfileSerializer

        profile = getattr(request.user, "recruiter_profile", None)
        if profile:
            data["profile"] = RecruiterProfileSerializer(profile).data

    return Response(data)


@extend_schema(
    request=inline_serializer(
        name="LogoutRequest",
        fields={"refresh": serializers.CharField(required=False)},
    ),
    responses={200: MessageResponseSerializer},
)
@api_view(["POST"])
@permission_classes([AllowAny])
@authentication_classes([])
def logout(request):
    """Log out by blacklisting the refresh token.

    Authentication is deliberately disabled for this view: the frontend sends
    the (possibly already-expired) access token in the Authorization header,
    and JWT auth would turn that into an unavoidable 401 before the view runs.
    Only the refresh token in the body is needed here.
    """
    try:
        refresh_token = request.data.get("refresh")
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
        return Response({"message": "Successfully logged out"})
    except Exception:
        return Response({"message": "Logged out"}, status=status.HTTP_200_OK)
