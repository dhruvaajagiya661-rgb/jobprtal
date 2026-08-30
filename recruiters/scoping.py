"""Company-level scoping for everything a recruiter can see.

A recruiter account represents a company, not an individual inbox: colleagues
who share a company share its postings, its applicants and its dashboard, and
nobody sees another company's. Every recruiter-facing queryset goes through
this module so the rule is defined once instead of being re-derived (and
eventually mis-derived) at each of the twenty-odd call sites.

The fallback matters. A recruiter whose profile has no company yet -- freshly
registered, or a company that was deleted -- is scoped to their own postings
alone. Scoping them by ``company=None`` would pool every company-less recruiter
into one shared bucket, which is precisely the leak this module exists to
prevent.
"""


def recruiter_company(user):
    """The Company a recruiter acts for, or None if they have not set one up."""
    profile = getattr(user, "recruiter_profile", None)
    return profile.company if profile else None


def scope_postings(queryset, user):
    """Limit a Job/Internship queryset to what `user`'s company may see."""
    company = recruiter_company(user)
    if company is None:
        return queryset.filter(recruiter=user)
    return queryset.filter(company=company)


def posting_scope_kwargs(user):
    """Lookup kwargs for `get_object_or_404(Job, pk=..., **kwargs)`.

    Callers fetch a single posting by id; this keeps that fetch on the same
    rule as the list views, so a colleague's job is editable but another
    company's still 404s.
    """
    company = recruiter_company(user)
    return {"company": company} if company is not None else {"recruiter": user}


def application_scope_q(user):
    """A Q object selecting Applications addressed to `user`'s company."""
    from django.db.models import Q

    company = recruiter_company(user)
    if company is None:
        return Q(job__recruiter=user) | Q(internship__recruiter=user)
    return Q(job__company=company) | Q(internship__company=company)
