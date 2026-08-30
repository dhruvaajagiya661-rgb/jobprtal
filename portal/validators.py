"""Shared upload validators.

Resume uploads were previously unrestricted ``FileField``s: any extension and
any size was accepted and written under ``MEDIA_ROOT``. That let a student
attach an ``.exe`` or an ``.html`` file (which is then served back from
``/media/``) as a "resume", and let a single request write an arbitrarily large
file to disk. These validators are the single place both resume fields agree on
what is acceptable.
"""

from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.deconstruct import deconstructible
from rest_framework import serializers as drf_serializers


def validate_posting_openings(self, value):
    """Reject nonsensical vacancy counts on a job/internship posting.

    ``openings`` is a plain IntegerField on both models, so without this a
    posting could be created with 0 or a negative number of seats. Written with
    a ``self`` first argument so it can be attached directly to a serializer as
    ``validate_openings``.
    """
    if value is not None and value < 1:
        raise drf_serializers.ValidationError("Openings must be at least 1.")
    return value


def validate_posting_deadline(self, value):
    """Reject a deadline that has already passed.

    Every job and internship listing filters on ``deadline__gte=today``, so a
    posting saved with a past deadline is accepted and then never appears
    anywhere -- the recruiter sees a success response and no listing.
    """
    if value and value < timezone.localdate():
        raise drf_serializers.ValidationError("Deadline cannot be in the past.")
    return value

# Formats students.resume_parser can actually read. Keeping the two in sync
# means an accepted upload is always a parseable one.
ALLOWED_RESUME_EXTENSIONS = (".pdf", ".docx", ".txt", ".md")

MAX_RESUME_BYTES = 5 * 1024 * 1024  # 5 MB


@deconstructible
class ResumeFileValidator:
    """Restrict a resume upload to a readable document of a sane size.

    Implemented as a deconstructible class rather than a plain function so it
    serialises cleanly into migrations and compares equal across runs (a bare
    lambda or closure would make ``makemigrations`` emit a new migration every
    time).
    """

    def __init__(self, extensions=ALLOWED_RESUME_EXTENSIONS, max_bytes=MAX_RESUME_BYTES):
        self.extensions = tuple(extensions)
        self.max_bytes = max_bytes

    def __call__(self, value):
        name = (getattr(value, "name", "") or "").lower()
        if not name.endswith(self.extensions):
            raise ValidationError(
                "Unsupported resume format. Upload one of: %s."
                % ", ".join(self.extensions)
            )
        size = getattr(value, "size", None)
        if size is not None and size > self.max_bytes:
            raise ValidationError(
                "Resume is too large (%.1f MB). Maximum size is %d MB."
                % (size / (1024 * 1024), self.max_bytes // (1024 * 1024))
            )

    def __eq__(self, other):
        return (
            isinstance(other, ResumeFileValidator)
            and self.extensions == other.extensions
            and self.max_bytes == other.max_bytes
        )

    def __hash__(self):
        return hash((self.extensions, self.max_bytes))


validate_resume_file = ResumeFileValidator()
