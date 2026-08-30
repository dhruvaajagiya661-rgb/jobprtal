"""Resume parsing: turn an uploaded CV into structured, evidence-backed signals.

Kept in its own module rather than ``services.py`` because it has no database
dependency beyond the skill catalogue and is worth unit-testing in isolation.

The design goal is *explainability*, matching the rest of the portal: every
detected skill carries the sentence it was found in, so a student can see why
the parser thinks they know something instead of being handed a black-box list.
"""

from __future__ import annotations

import io
import re
import zipfile
from typing import Iterable

# Common ways a skill is written on a CV that don't match the catalogue name.
# Maps an alias -> the canonical Skill.name it should count towards.
SKILL_ALIASES: dict[str, str] = {
    "js": "JavaScript",
    "ecmascript": "JavaScript",
    "ts": "TypeScript",
    "reactjs": "React",
    "react.js": "React",
    "nodejs": "Node.js",
    "node": "Node.js",
    "postgres": "PostgreSQL",
    "psql": "PostgreSQL",
    "k8s": "Kubernetes",
    "tf": "TensorFlow",
    "ml": "Machine Learning",
    "dl": "Deep Learning",
    "cv": "Computer Vision",
    "natural language processing": "NLP",
    "rest api": "REST APIs",
    "restful apis": "REST APIs",
    "restful api": "REST APIs",
    "continuous integration": "CI/CD",
    "ci cd": "CI/CD",
    "ux": "UI/UX Design",
    "ui/ux": "UI/UX Design",
    "unit testing": "Testing",
    "pytest": "Testing",
    "amazon web services": "AWS",
    "gnu/linux": "Linux",
    "shell scripting": "Bash",
}

# Degree keywords, most specific first — "Bachelor of Science" must not be
# reported as a PhD just because "doctor" appears elsewhere in the document.
EDUCATION_LEVELS: list[tuple[str, tuple[str, ...]]] = [
    ("PhD", ("ph.d", "phd", "doctorate", "doctoral")),
    ("Master's", ("master", "m.sc", "msc", "m.tech", "mtech", "mba", "m.e.")),
    ("Bachelor's", ("bachelor", "b.sc", "bsc", "b.tech", "btech", "b.e.", "be.", "undergraduate")),
    ("Diploma", ("diploma", "associate degree")),
]

_YEARS_RE = re.compile(
    r"(\d{1,2})\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional\s+|industry\s+|work\s+)?experience",
    re.IGNORECASE,
)

# A skill token must not be glued to another word/technology character. This is
# what stops "C" matching inside "CSS" and "C++", and "Java" inside "JavaScript".
_LEFT = r"(?<![A-Za-z0-9+#._-])"
_RIGHT = r"(?![A-Za-z0-9+#_-])"


class ResumeTextExtractionError(Exception):
    """Raised when a file cannot be turned into text."""


def _pdf_text(data: bytes) -> tuple[str, int]:
    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise ResumeTextExtractionError(
            "PDF support requires the 'pypdf' package."
        ) from exc

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:
        raise ResumeTextExtractionError("This PDF could not be opened.") from exc

    if getattr(reader, "is_encrypted", False):
        # Many CVs are "protected" with an empty owner password; that decrypts
        # fine. A real user password does not, and we say so plainly.
        try:
            reader.decrypt("")
        except Exception as exc:
            raise ResumeTextExtractionError(
                "This PDF is password protected."
            ) from exc

    parts: list[str] = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            # One unreadable page shouldn't lose the whole document.
            continue
    return "\n".join(parts), len(reader.pages)


def _docx_text(data: bytes) -> tuple[str, int]:
    """Read a .docx without a third-party dependency.

    A .docx is a zip archive; the body lives in word/document.xml. Paragraph
    and break tags become newlines so sentence splitting still works, then all
    remaining tags are stripped.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            xml = archive.read("word/document.xml").decode("utf-8", "ignore")
    except (zipfile.BadZipFile, KeyError) as exc:
        raise ResumeTextExtractionError("This DOCX file could not be read.") from exc

    xml = re.sub(r"</w:p>|<w:br[^>]*/>", "\n", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    return _unescape(text), 1


def _unescape(text: str) -> str:
    for entity, char in (
        ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"),
        ("&quot;", '"'), ("&apos;", "'"), ("&#39;", "'"),
    ):
        text = text.replace(entity, char)
    return text


def extract_text(data: bytes, filename: str) -> tuple[str, int]:
    """Return ``(text, page_count)`` for a supported resume file."""
    name = (filename or "").lower()
    if name.endswith(".pdf") or data[:5] == b"%PDF-":
        return _pdf_text(data)
    if name.endswith(".docx"):
        return _docx_text(data)
    if name.endswith((".txt", ".md")):
        return data.decode("utf-8", "ignore"), 1
    if name.endswith(".doc"):
        raise ResumeTextExtractionError(
            "Legacy .doc files aren't supported — please upload a PDF or .docx."
        )
    raise ResumeTextExtractionError(
        "Unsupported file type. Upload a PDF, DOCX or TXT resume."
    )


def _normalise(text: str) -> str:
    """Collapse the whitespace PDF extraction leaves behind."""
    text = text.replace(" ", " ").replace("•", " ")
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _sentences(text: str) -> list[str]:
    raw = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [s.strip() for s in raw if s.strip()]


def _evidence(sentences: list[str], pattern: re.Pattern[str]) -> str:
    """The shortest sentence containing the skill, trimmed for display."""
    hits = [s for s in sentences if pattern.search(s)]
    if not hits:
        return ""
    snippet = min(hits, key=len)
    snippet = re.sub(r"\s+", " ", snippet).strip(" -•|,;")
    return snippet if len(snippet) <= 160 else snippet[:157].rstrip() + "…"


def detect_skills(text: str, catalogue: Iterable[tuple[int, str]]) -> list[dict]:
    """Match catalogue skills against resume text.

    ``catalogue`` is an iterable of ``(skill_id, skill_name)``. Only catalogue
    skills are ever returned, so every result maps to a real Skill row.
    """
    normalised = _normalise(text)
    if not normalised:
        return []

    sentences = _sentences(normalised)

    # Alias -> canonical, restricted to names actually in the catalogue.
    by_name = {name.lower(): (sid, name) for sid, name in catalogue}
    alias_targets: dict[str, list[str]] = {}
    for alias, canonical in SKILL_ALIASES.items():
        if canonical.lower() in by_name:
            alias_targets.setdefault(canonical.lower(), []).append(alias)

    results: list[dict] = []
    for lowered, (sid, name) in by_name.items():
        terms = [name] + alias_targets.get(lowered, [])
        pattern = re.compile(
            _LEFT + "(?:" + "|".join(re.escape(t) for t in terms) + ")" + _RIGHT,
            re.IGNORECASE,
        )
        occurrences = len(pattern.findall(normalised))
        if not occurrences:
            continue
        results.append(
            {
                "id": sid,
                "name": name,
                "occurrences": occurrences,
                "evidence": _evidence(sentences, pattern),
            }
        )

    # Repeated mentions are a stronger signal than a single keyword drop.
    results.sort(key=lambda r: (-r["occurrences"], r["name"].lower()))
    return results


def detect_experience_years(text: str) -> int | None:
    """Largest explicitly stated "N years of experience" claim, if any."""
    matches = [int(m) for m in _YEARS_RE.findall(text)]
    sane = [m for m in matches if 0 < m <= 50]
    return max(sane) if sane else None


def detect_education_level(text: str) -> str | None:
    lowered = text.lower()
    for label, keywords in EDUCATION_LEVELS:
        if any(k in lowered for k in keywords):
            return label
    return None


def parse(data: bytes, filename: str, catalogue: Iterable[tuple[int, str]]) -> dict:
    """Full parse of one resume file into structured signals."""
    text, pages = extract_text(data, filename)
    normalised = _normalise(text)

    if len(normalised) < 40:
        raise ResumeTextExtractionError(
            "We couldn't read any text from this file. If it's a scanned "
            "document, upload a text-based PDF instead."
        )

    return {
        "skills": detect_skills(normalised, catalogue),
        "experience_years": detect_experience_years(normalised),
        "education_level": detect_education_level(normalised),
        "pages": pages,
        "characters": len(normalised),
        "words": len(normalised.split()),
    }
