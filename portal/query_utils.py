"""Helpers for safely handling client-supplied identifiers.

Django coerces values in a `filter(fk_id=...)` lookup with `int()`, so passing a
non-numeric string straight from a query parameter raises ValueError and surfaces
as a 500. These helpers turn that into a clean 400 (or a silent skip) instead.
"""


def parse_id(value):
    """Coerce a client-supplied id to int, or None if it isn't a usable id."""
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def filter_by_id(queryset, **lookups):
    """Apply id lookups, ignoring any whose value is absent or non-numeric.

    Returns (queryset, invalid_keys). `invalid_keys` lists the parameters that
    were supplied but malformed, so the caller can choose to 400 on them.
    """
    invalid = []
    for key, raw in lookups.items():
        if raw is None or raw == "":
            continue
        parsed = parse_id(raw)
        if parsed is None:
            invalid.append(key)
            continue
        queryset = queryset.filter(**{key: parsed})
    return queryset, invalid
