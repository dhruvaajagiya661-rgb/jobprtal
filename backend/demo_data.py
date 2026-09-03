#!/usr/bin/env python
"""Make the database look like a live product, not a fresh install.

    python demo_data.py            # clean + enrich
    python demo_data.py --clean    # only remove test artefacts
    python demo_data.py --enrich   # only add demo content

`seed_data.py` creates the catalogue (companies, jobs, internships, users).
This script is the layer on top: it removes the debris that automated test
runs leave behind, and fills in the things that make the UI feel inhabited —
a populated activity feed, a real professional network, endorsements, and
applications spread across twelve months so the dashboard chart has a shape
instead of a flat line.

Safe to run repeatedly: every step is idempotent.
"""

from __future__ import annotations

import argparse
import os
import random
from datetime import timedelta

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "portal.settings")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from django.db.models import Q  # noqa: E402
from django.utils import timezone  # noqa: E402

from applications.models import Application  # noqa: E402
from feed.models import Post  # noqa: E402
from internships.models import Internship  # noqa: E402
from jobs.models import Job, Skill  # noqa: E402
from chat.models import Message  # noqa: E402
from network.models import Connection, SkillEndorsement  # noqa: E402
from recruiters.models import Company  # noqa: E402
from students.models import StudentProfile  # noqa: E402

User = get_user_model()

# Deterministic output so a demo looks the same every time it's rebuilt.
RNG = random.Random(20260821)

# Debris left behind by the QA suites and manual probing.
JUNK_JOB_TITLES = ["QA Smoke Test Job", "Verify Job", "Test Job", "Smoke Test"]
JUNK_COMPANY_NAMES = ["Verify Corp", "Test Corp", "Probe Inc"]
JUNK_SKILL_NAMES = ["py"]
JUNK_EMAIL_PATTERNS = ["qa_", "probe_", "smoke_", "burst", "@nope.test", "@test.local"]

POST_TEMPLATES = [
    ("achievement", "Just accepted an offer as {role} at {company}. Six months of "
                    "grinding LeetCode and building side projects finally paid off. "
                    "Happy to share notes with anyone prepping right now."),
    ("text", "Unpopular opinion: your README matters more than your framework choice. "
             "Half the recruiters I spoke to opened the repo and read that first."),
    ("achievement", "Finished the {skill} track on my skill-gap roadmap. Went from "
                    "'heard of it' to shipping it in production in about seven weeks."),
    ("text", "Reviewed 40 student portfolios this month. The ones that stood out all "
             "had the same thing: one project explained deeply, not six explained badly."),
    ("article", "What I learned migrating a monolith to {skill}"),
    ("text", "Reminder for anyone job hunting: rejection at the screening stage is "
             "usually about keyword matching, not your ability. Fix the resume, keep going."),
    ("achievement", "Wrapped up my internship at {company}. Shipped three features to "
                    "production and broke staging exactly once. Growth."),
    ("text", "The best interview prep I did wasn't LeetCode — it was explaining my own "
             "projects out loud until the explanation stopped being messy."),
    ("article", "How I actually use {skill} day to day"),
    ("text", "Applied to 60 roles, heard back from 9, interviewed at 4, offered 1. "
             "Posting the funnel because nobody talks about the top of it."),
    ("achievement", "Hit 100 contributions this quarter. Consistency beats intensity."),
    ("text", "If you're a student reading this: start applying before you feel ready. "
             "The job description is a wish list, not a checklist."),
]

# Enrichment targets. Every builder tops the database *up to* these numbers, so
# running this script twice leaves the same database as running it once.
FEED_TARGET = 26
CONNECTION_TARGET = 120
ENDORSEMENT_TARGET = 60
MESSAGE_TARGET = 140
APPLICATION_TARGET = 90
# The account a reviewer will actually sign in as, so its dashboard has to be
# the fullest one in the database.
SHOWCASE_EMAIL = "profile_test_user@example.com"
SHOWCASE_APPLICATIONS = 16

# A realistic funnel: most applications sit unanswered, a few progress.
STATUS_WEIGHTS = [("Applied", 52), ("Rejected", 25), ("Shortlisted", 16), ("Accepted", 7)]

ARTICLE_URLS = [
    "https://engineering.example.com/scaling-notes",
    "https://blog.example.com/from-monolith-to-services",
    "https://example.com/notes/interview-prep",
]


def log(msg: str) -> None:
    print(f"  {msg}")


# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

def clean() -> None:
    print("\nRemoving test artefacts")
    removed = 0

    job_q = Q()
    for title in JUNK_JOB_TITLES:
        job_q |= Q(title__iexact=title)
    jobs = Job.objects.filter(job_q)
    if jobs.exists():
        log(f"jobs: {jobs.count()} removed ({', '.join(sorted(set(jobs.values_list('title', flat=True))))})")
        removed += jobs.count()
        jobs.delete()

    interns = Internship.objects.filter(title__icontains="test")
    if interns.exists():
        log(f"internships: {interns.count()} removed")
        removed += interns.count()
        interns.delete()

    companies = Company.objects.filter(name__in=JUNK_COMPANY_NAMES)
    if companies.exists():
        log(f"companies: {companies.count()} removed")
        removed += companies.count()
        companies.delete()

    skills = Skill.objects.filter(name__in=JUNK_SKILL_NAMES)
    if skills.exists():
        log(f"skills: {skills.count()} removed ({', '.join(skills.values_list('name', flat=True))})")
        removed += skills.count()
        skills.delete()

    user_q = Q()
    for pattern in JUNK_EMAIL_PATTERNS:
        user_q |= Q(email__icontains=pattern)
    # Never delete a superuser, however its address is spelled.
    users = User.objects.filter(user_q).exclude(is_superuser=True)
    if users.exists():
        log(f"users: {users.count()} removed")
        removed += users.count()
        users.delete()

    if not removed:
        log("nothing to clean")


# ---------------------------------------------------------------------------
# Enrich
# ---------------------------------------------------------------------------

def spread_applications() -> None:
    """Backdate applications across 12 months.

    `applied_at` is auto_now_add, so it can't be set on create — it has to be
    written afterwards with an explicit UPDATE. Without this every application
    lands in the current month and the dashboard activity chart is one spike.
    """
    apps = list(Application.objects.all())
    if not apps:
        log("applications: none to spread")
        return

    now = timezone.now()
    updated = 0
    for app in apps:
        # Weight recent months more heavily — a real job hunt ramps up.
        months_ago = RNG.choices(range(0, 12), weights=[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 2])[0]
        when = now - timedelta(days=months_ago * 30 + RNG.randint(0, 27), hours=RNG.randint(0, 23))
        Application.objects.filter(pk=app.pk).update(applied_at=when)
        updated += 1
    log(f"applications: {updated} spread across 12 months")


def _placeholder_resume() -> str:
    """Every Application requires a resume file. Point them all at one real
    placeholder so the download link resolves instead of 404-ing in a demo."""
    from django.conf import settings

    rel = "application_resumes/demo_resume.txt"
    path = os.path.join(settings.MEDIA_ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(
                "PortAL demo resume\n\n"
                "This placeholder stands in for a real CV in the seeded demo data.\n"
                "Skills: Python, Django, React, TypeScript, PostgreSQL, Docker.\n"
                "3 years of professional experience. Bachelor of Technology.\n"
            )
    return rel


def _pick_status() -> str:
    labels = [s for s, _ in STATUS_WEIGHTS]
    weights = [w for _, w in STATUS_WEIGHTS]
    return RNG.choices(labels, weights=weights)[0]


def _apply(student, target, resume_path, now) -> bool:
    """Create one application, backdated. Returns False if it already exists."""
    is_job = isinstance(target, Job)
    lookup = {"student": student, "job": target} if is_job else {"student": student, "internship": target}
    if Application.objects.filter(**lookup).exists():
        return False

    app = Application.objects.create(resume=resume_path, status=_pick_status(), **lookup)
    months_ago = RNG.choices(range(0, 12), weights=[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 2])[0]
    Application.objects.filter(pk=app.pk).update(
        applied_at=now - timedelta(days=months_ago * 30 + RNG.randint(0, 27), hours=RNG.randint(0, 23))
    )
    return True


def _guarantee_full_funnel(student) -> None:
    """Force at least one application into every stage.

    Random status assignment leaves gaps — an empty "Offers" tile on the
    showcase dashboard reads as a broken feature rather than an unlucky draw.
    """
    minimums = {"Accepted": 1, "Shortlisted": 2, "Rejected": 2}
    for status, wanted in minimums.items():
        have = Application.objects.filter(student=student, status=status).count()
        if have >= wanted:
            continue
        movable = list(
            Application.objects.filter(student=student, status="Applied")
            .order_by("applied_at")[: wanted - have]
        )
        for app in movable:
            Application.objects.filter(pk=app.pk).update(status=status)


def build_applications(students: list, jobs: list, internships: list) -> None:
    if not students or not (jobs or internships):
        log("applications: nothing to apply to")
        return

    resume_path = _placeholder_resume()
    now = timezone.now()
    targets = jobs + internships
    created = 0

    # The showcase account first — its dashboard is the demo.
    showcase = next((s for s in students if s.email == SHOWCASE_EMAIL), None)
    if showcase:
        have = Application.objects.filter(student=showcase).count()
        for target in RNG.sample(targets, min(SHOWCASE_APPLICATIONS, len(targets))):
            if have + created >= SHOWCASE_APPLICATIONS:
                break
            created += _apply(showcase, target, resume_path, now)
        log(f"applications: +{created} for the showcase account ({SHOWCASE_EMAIL})")
        _guarantee_full_funnel(showcase)

    existing = Application.objects.count()
    spread = 0
    for student in students:
        if existing + spread >= APPLICATION_TARGET:
            break
        if student is showcase:
            continue
        for target in RNG.sample(targets, min(RNG.randint(1, 5), len(targets))):
            if existing + spread >= APPLICATION_TARGET:
                break
            spread += _apply(student, target, resume_path, now)

    log(f"applications: +{spread} across other students (now {Application.objects.count()})")


def build_network(students: list) -> None:
    if len(students) < 4:
        log("network: not enough students")
        return

    existing = Connection.objects.count()
    if existing >= CONNECTION_TARGET:
        log(f"connections: {existing} already present, at target")
        return

    made = 0
    pending = 0
    for person in students:
        if existing + made >= CONNECTION_TARGET:
            break
        others = [s for s in students if s.id != person.id]
        for other in RNG.sample(others, min(5, len(others))):
            if existing + made >= CONNECTION_TARGET:
                break
            lo, hi = sorted([person, other], key=lambda u: u.id)
            # unique_together is (from_user, to_user); normalising the direction
            # keeps re-runs from creating the mirrored duplicate.
            if Connection.objects.filter(from_user=lo, to_user=hi).exists():
                continue
            status = "accepted" if RNG.random() < 0.78 else "pending"
            Connection.objects.create(from_user=lo, to_user=hi, status=status)
            made += 1
            pending += status == "pending"
    log(f"connections: +{made} (now {existing + made}, {pending} new left pending)")


def build_endorsements(students: list) -> None:
    existing = SkillEndorsement.objects.count()
    if existing >= ENDORSEMENT_TARGET:
        log(f"endorsements: {existing} already present, at target")
        return

    made = 0
    for person in students:
        if existing + made >= ENDORSEMENT_TARGET:
            break
        profile = StudentProfile.objects.filter(user=person).first()
        if not profile:
            continue
        skills = list(profile.skills.all()[:4])
        if not skills:
            continue
        peers = [s for s in students if s.id != person.id]
        for endorser in RNG.sample(peers, min(3, len(peers))):
            if existing + made >= ENDORSEMENT_TARGET:
                break
            _, created = SkillEndorsement.objects.get_or_create(
                endorser=endorser, endorsee=person, skill=skill_of(skills)
            )
            made += created
    log(f"endorsements: +{made} (now {existing + made})")


def skill_of(skills):
    return RNG.choice(skills)


def dedupe_feed() -> int:
    """Drop posts whose body already exists, keeping the earliest.

    Guards against an older non-idempotent run having doubled the feed.
    """
    seen: set[str] = set()
    dupes: list[int] = []
    for post in Post.objects.order_by("created_at", "id").only("id", "content"):
        key = post.content[:80]
        if key in seen:
            dupes.append(post.pk)
        else:
            seen.add(key)
    if dupes:
        Post.objects.filter(pk__in=dupes).delete()
    return len(dupes)


def build_feed(students: list, jobs: list, skills: list) -> None:
    if not students:
        log("feed: no authors available")
        return

    dropped = dedupe_feed()
    if dropped:
        log(f"feed posts: {dropped} duplicates removed")

    existing = Post.objects.count()
    if existing >= FEED_TARGET:
        log(f"feed posts: {existing} already present, at target")
        return

    companies = list(Company.objects.values_list("name", flat=True)) or ["a great team"]
    roles = ["Backend Engineer", "Data Scientist", "Frontend Engineer",
             "SRE", "Product Analyst", "ML Engineer"]
    skill_names = [s.name for s in skills] or ["Kubernetes"]

    now = timezone.now()
    created = 0
    for index, (post_type, template) in enumerate(POST_TEMPLATES * 3):
        if existing + created >= FEED_TARGET:
            break
        author = RNG.choice(students)
        body = template.format(
            role=RNG.choice(roles),
            company=RNG.choice(companies),
            skill=RNG.choice(skill_names),
        )
        content = body if post_type != "article" else f"Wrote this up after a few people asked. {body}"

        if Post.objects.filter(content__startswith=content[:80]).exists():
            continue

        post = Post.objects.create(
            author=author,
            content=content,
            post_type=post_type,
            article_title=body if post_type == "article" else "",
            article_url=RNG.choice(ARTICLE_URLS) if post_type == "article" else "",
            shared_job=RNG.choice(jobs) if post_type == "job_share" and jobs else None,
            likes_count=RNG.randint(3, 180),
            comments_count=RNG.randint(0, 24),
            shares_count=RNG.randint(0, 12),
        )
        # created_at is auto_now_add — backdate it so the feed reads as a
        # timeline rather than everything being posted this second.
        Post.objects.filter(pk=post.pk).update(
            created_at=now - timedelta(days=index * 2, hours=RNG.randint(0, 23))
        )
        created += 1

    log(f"feed posts: +{created} (now {existing + created})")


def give_students_skills(students: list, skills: list) -> None:
    """A student with no skills gets a 0% match on every job, which makes the
    match score, the skill gap analysis and the recommendations all look broken.
    """
    touched = 0
    for person in students:
        profile = StudentProfile.objects.filter(user=person).first()
        if not profile or profile.skills.exists():
            continue
        profile.skills.add(*RNG.sample(skills, min(RNG.randint(4, 9), len(skills))))
        touched += 1
    log(f"student skill sets: {touched} populated")


CHAT_OPENERS = [
    "Hi! I saw your profile - would love to connect about opportunities.",
    "Thanks for connecting! What are you working on at the moment?",
    "Hey, are you still looking for a summer internship?",
    "Quick question about the role you posted - is it remote friendly?",
    "Congrats on the new position! Well deserved.",
    "Do you have any advice for someone breaking into this field?",
]

CHAT_REPLIES = [
    "Absolutely, happy to chat. What would you like to know?",
    "Thanks for reaching out! Let me get back to you with details.",
    "Yes, still open - I'll send over the description shortly.",
    "Good question. It's hybrid, two days on site.",
    "Appreciate it! It's been a great move so far.",
    "Start with the fundamentals and build something you can demo.",
    "Sounds good, let's set up a call this week.",
]


def build_conversations(students: list) -> None:
    """Seed direct messages between people who are already connected.

    The Messages page had no data at all - Message.objects.count() was 0 - so
    every account saw the same permanently empty inbox. Threads are hung off
    accepted connections so the conversation list matches the network graph.
    """
    existing = Message.objects.count()
    if existing >= MESSAGE_TARGET:
        log(f"messages: {existing} already present, at target")
        return

    pairs = list(
        Connection.objects.filter(status="accepted").select_related("from_user", "to_user")
    )
    if not pairs:
        log("messages: no accepted connections to hang threads off")
        return

    RNG.shuffle(pairs)
    now = timezone.now()
    made = 0
    threads = 0

    for connection in pairs:
        if existing + made >= MESSAGE_TARGET:
            break
        a, b = connection.from_user, connection.to_user
        if Message.objects.filter(
            Q(sender=a, receiver=b) | Q(sender=b, receiver=a)
        ).exists():
            continue

        # A thread is an opener plus a few alternating turns, walking forward
        # in time so ordering and "last message" are meaningful.
        turns = RNG.randint(2, 6)
        stamp = now - timedelta(days=RNG.randint(0, 21), hours=RNG.randint(0, 23))
        speaker, listener = a, b
        for turn in range(turns):
            if existing + made >= MESSAGE_TARGET:
                break
            body = RNG.choice(CHAT_OPENERS if turn == 0 else CHAT_REPLIES)
            message = Message.objects.create(
                sender=speaker,
                receiver=listener,
                content=body,
                # Last inbound message of a thread is sometimes left unread so
                # the badge counts are not uniformly zero.
                is_read=not (turn == turns - 1 and RNG.random() < 0.4),
            )
            # auto_now_add ignores an explicit value; set it after the fact.
            Message.objects.filter(pk=message.pk).update(timestamp=stamp)
            stamp += timedelta(minutes=RNG.randint(3, 240))
            speaker, listener = listener, speaker
            made += 1
        threads += 1

    log(f"messages: +{made} across {threads} threads (now {existing + made})")


def enrich() -> None:
    print("\nEnriching demo content")

    students = list(User.objects.filter(is_student=True).order_by("id"))
    jobs = list(Job.objects.filter(is_active=True))
    skills = list(Skill.objects.all())

    if not skills:
        log("no skills in the catalogue — run seed_data.py first")
        return

    give_students_skills(students, skills)
    build_applications(students, jobs, list(Internship.objects.all()))
    spread_applications()
    build_network(students)
    build_endorsements(students)
    build_conversations(students)
    build_feed(students, jobs, skills)


def summary() -> None:
    print("\nDatabase now holds")
    rows = [
        ("users", User.objects.count()),
        ("students", User.objects.filter(is_student=True).count()),
        ("recruiters", User.objects.filter(is_recruiter=True).count()),
        ("companies", Company.objects.count()),
        ("jobs", Job.objects.count()),
        ("internships", Internship.objects.count()),
        ("applications", Application.objects.count()),
        ("connections", Connection.objects.count()),
        ("endorsements", SkillEndorsement.objects.count()),
        ("messages", Message.objects.count()),
        ("feed posts", Post.objects.count()),
        ("skills", Skill.objects.count()),
    ]
    width = max(len(label) for label, _ in rows)
    for label, count in rows:
        print(f"  {label.rjust(width)}: {count}")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description="Clean and enrich PortAL demo data.")
    parser.add_argument("--clean", action="store_true", help="only remove test artefacts")
    parser.add_argument("--enrich", action="store_true", help="only add demo content")
    args = parser.parse_args()

    do_clean = args.clean or not args.enrich
    do_enrich = args.enrich or not args.clean

    if do_clean:
        clean()
    if do_enrich:
        enrich()
    summary()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
