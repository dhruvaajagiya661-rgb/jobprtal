#!/usr/bin/env python
"""Repair postings whose recruiter belongs to a different company.

A recruiter account represents a company, and every recruiter-facing query is
scoped to that company (see recruiters/scoping.py). An earlier version of
seed_data.py created a single recruiter that owned six companies' jobs and
internships, which under company scoping would put rival employers' postings in
one console.

This reassigns each posting to a recruiter who actually belongs to the
posting's company, creating that recruiter if none exists. The posting's
company is treated as the truth and never changed.

Idempotent -- running it twice is a no-op. Dry run by default:

    python repair_recruiter_companies.py           # report only
    python repair_recruiter_companies.py --apply   # make the changes
"""

import argparse
import os
import sys

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "portal.settings")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402
from django.db import transaction  # noqa: E402

from internships.models import Internship  # noqa: E402
from jobs.models import Job  # noqa: E402
from recruiters.models import Company, RecruiterProfile  # noqa: E402

User = get_user_model()


def slug_for(company):
    return "".join(ch for ch in company.name.lower() if ch.isalnum()) or f"co{company.id}"


def recruiter_for_company(company, created_log, apply):
    """An existing recruiter at `company`, or a newly provisioned one."""
    profile = (
        RecruiterProfile.objects.filter(company=company)
        .select_related("user")
        .order_by("id")
        .first()
    )
    if profile:
        return profile.user

    email = f"hiring@{slug_for(company)}.com"
    if not apply:
        # Nothing is written in a dry run, so the lookup above keeps missing --
        # dedupe or the same company is reported once per posting.
        line = f"would create recruiter {email} for {company.name}"
        if line not in created_log:
            created_log.append(line)
        return None

    user, was_created = User.objects.get_or_create(
        email=email,
        defaults={
            "username": f"{slug_for(company)}_recruiter",
            "is_recruiter": True,
            "first_name": company.name,
            "last_name": "Talent",
        },
    )
    if was_created:
        user.set_password("password123")
        user.save()
        created_log.append(f"created recruiter {email} for {company.name}")

    RecruiterProfile.objects.update_or_create(
        user=user,
        defaults={"company": company, "designation": "Senior University Recruiter"},
    )
    return user


def company_of(user, cache):
    if user.id not in cache:
        profile = RecruiterProfile.objects.filter(user=user).first()
        cache[user.id] = profile.company if profile else None
    return cache[user.id]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="write the changes")
    args = parser.parse_args()

    company_cache = {}
    created_log = []
    moves = []

    for model, label in ((Job, "job"), (Internship, "internship")):
        for posting in model.objects.select_related("company", "recruiter"):
            if posting.company is None:
                continue
            current = company_of(posting.recruiter, company_cache)
            if current == posting.company:
                continue
            moves.append((model, label, posting, current))

    if not moves:
        print("Nothing to repair -- every posting's recruiter matches its company.")
        return 0

    print(f"{len(moves)} posting(s) whose recruiter belongs to another company:\n")

    with transaction.atomic():
        for model, label, posting, current in moves:
            target = recruiter_for_company(posting.company, created_log, args.apply)
            old = f"{posting.recruiter.email} ({current.name if current else 'no company'})"
            new = target.email if target else f"hiring@{slug_for(posting.company)}.com"
            print(
                f"  {label} {posting.id:>3} '{posting.title[:34]:34}' "
                f"[{posting.company.name}]\n"
                f"        {old}  ->  {new}"
            )
            if args.apply and target is not None:
                model.objects.filter(pk=posting.pk).update(recruiter=target)

        if not args.apply:
            transaction.set_rollback(True)

    if created_log:
        print("\nRecruiter accounts:")
        for line in created_log:
            print(f"  {line}")

    if args.apply:
        print(f"\nApplied. {len(moves)} posting(s) reassigned.")
    else:
        print(f"\nDry run -- nothing written. Re-run with --apply to make these changes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
