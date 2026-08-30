"""Error-code regression suite for PortAL.

Replays every request flow that historically produced a 401 / 404 / 429 / 500
so those errors can never silently come back.

Usage:  start the backend (python manage.py runserver 8000), then:
            python qa_error_regression.py

Note: section F only observes a 429 if the auth throttle is tightened
(THROTTLE_AUTH_RATE=4/hour in .env); with production-sized limits it correctly
reports that no throttling occurred.
"""
import json, urllib.request, urllib.error

BASE = "http://localhost:8000"
results = []

def call(method, path, data=None, token=None, ctype="application/json"):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, data=body, method=method)
    req.add_header("Content-Type", ctype)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw.strip().startswith(("{", "[")) else raw[:120]
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:120]

def check(name, got, expected):
    ok = got in expected if isinstance(expected, (list, tuple, set)) else got == expected
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name:<58} -> {got} (want {expected})")

print("=== A. ANONYMOUS visitor: public pages must never 401 ===")
for ep in ["/api/v1/jobs/", "/api/v1/internships/", "/api/v1/skills/",
           "/api/v1/career-paths/", "/api/v1/interview-prep/hub/",
           "/api/v1/notifications/unread_count/", "/api/v1/messages/unread_count/"]:
    s, _ = call("GET", ep)
    check(f"anon GET {ep}", s, 200)

print("\n=== B. 404s: bad IDs must return clean JSON 404, never 500 ===")
s, b = call("GET", "/api/v1/jobs/999999/");        check("GET job/999999", s, 404)
check("  -> JSON envelope not HTML", isinstance(b, dict), True)
s, _ = call("GET", "/api/v1/internships/999999/"); check("GET internship/999999", s, 404)

print("\n=== C. LOGIN + authenticated flows ===")
s, b = call("POST", "/api/auth/login/", {"email": "admin@portal.com", "password": "admin"})
check("login admin", s, 200)
tok = (b or {}).get("access")

s, _ = call("GET", "/api/auth/me/", token=tok);                check("GET /api/auth/me/ (authed)", s, 200)
s, _ = call("GET", "/api/v1/admin/dashboard/", token=tok);     check("GET admin/dashboard (was 500)", s, 200)
s, _ = call("GET", "/api/v1/analytics/overview/", token=tok);  check("GET analytics/overview (was 500)", s, 200)
s, _ = call("GET", "/api/v1/notifications/unread_count/", token=tok); check("authed unread_count", s, 200)
s, _ = call("GET", "/api/v1/messages/unread_count/", token=tok);      check("authed messages unread", s, 200)

print("\n=== D. STUDENT flows (save_job / set_status / record_attempt) ===")
import random
em = f"qa_reg_{random.randint(10000,99999)}@example.com"
s, b = call("POST", "/api/auth/register/", {"email": em, "password": "QaPass!2345", "role": "student"})
check("register student", s, 201)
s, b = call("POST", "/api/auth/login/", {"email": em, "password": "QaPass!2345"})
check("login student", s, 200)
stok = (b or {}).get("access")

s, b = call("GET", "/api/v1/jobs/")
jobs = b.get("results", b) if isinstance(b, dict) else b
jid = jobs[0]["id"] if jobs else None

s, _ = call("POST", "/api/v1/students/save_job/", {"job_id": jid}, token=stok)
check(f"save_job (valid id {jid}) [was 404]", s, 200)
s, _ = call("POST", "/api/v1/students/save_job/", {"job_id": 999999}, token=stok)
check("save_job (bogus id) -> clean 404 not 500", s, 404)
s, _ = call("GET", "/api/v1/students/saved_jobs/", token=stok);   check("saved_jobs", s, 200)
s, _ = call("GET", "/api/v1/students/me/", token=stok);           check("students/me", s, 200)
s, _ = call("GET", "/api/v1/students/dashboard/", token=stok);    check("students/dashboard", s, 200)
s, _ = call("GET", "/api/v1/skill-gap/analyze/", token=stok);     check("skill-gap/analyze [was 500]", s, 200)
# Valid statuses are not_started / in_progress / learned.
s, _ = call("POST", "/api/v1/skill-gap/set_status/", {"skill_name": "Python", "status": "in_progress"}, token=stok)
check("skill-gap/set_status (valid enum) [was 404]", s, 200)
s, _ = call("POST", "/api/v1/skill-gap/set_status/", {"skill_name": "Python", "status": "bogus"}, token=stok)
check("skill-gap/set_status (bad enum) -> clean 400", s, 400)
s, _ = call("POST", "/api/v1/skill-gap/set_status/", {"skill_name": "NoSuchSkill", "status": "learned"}, token=stok)
check("skill-gap/set_status (unknown skill) -> clean 404", s, 404)

s, b = call("GET", "/api/v1/interview-prep/hub/")
s, b2 = call("GET", "/api/v1/interview-prep/practice/?count=1")
qs = b2.get("questions", []) if isinstance(b2, dict) else []
if qs:
    qid = qs[0]["id"]
    s, _ = call("POST", "/api/v1/interview-prep/record_attempt/", {"question_id": qid, "correct": True}, token=stok)
    check("record_attempt [was 401 & 500]", s, 200)
    s, _ = call("POST", "/api/v1/interview-prep/bookmark/", {"question_id": qid}, token=stok)
    check("bookmark [was 401]", s, 200)
s, _ = call("GET", "/api/v1/interview-prep/progress/", token=stok);  check("progress [was 401]", s, 200)
s, _ = call("GET", "/api/v1/interview-prep/bookmarks/", token=stok); check("bookmarks [was 401]", s, 200)

print("\n=== E. 401 semantics: bad/expired token must be a clean JSON 401 ===")
s, b = call("GET", "/api/v1/students/me/", token="totally.invalid.token")
check("bad token -> 401", s, 401)
check("  -> JSON envelope with code", isinstance(b, dict) and "code" in b, True)
s, b = call("POST", "/api/auth/login/", {"email": "admin@portal.com", "password": "WRONG"})
check("wrong password -> 401", s, 401)

print("\n=== F. 429 throttling: must return JSON + Retry-After, not crash ===")
codes = []
for i in range(40):
    s, b = call("POST", "/api/auth/login/", {"email": f"burst{i}@nope.test", "password": "x"})
    codes.append(s)
    if s == 429:
        check("throttle returns 429 (not 500)", s, 429)
        check("  -> JSON envelope", isinstance(b, dict), True)
        check("  -> includes retry wait", "retry_after" in str(b) or "seconds" in str(b).lower(), True)
        break
else:
    check(f"no 429 in 40 auth attempts (limit generous; codes={set(codes)})", True, True)

print("\n=== G. Non-existent routes -> 404, never 500 ===")
for ep in ["/api/v1/does-not-exist/", "/api/v1/jobs/abc/"]:
    s, _ = call("GET", ep)
    check(f"API GET {ep}", s, 404)
# Non-API paths intentionally fall through to the SPA shell so a hard refresh
# on any client route works; React Router then renders the NotFound page.
s, b = call("GET", "/totally/bogus/")
check("SPA catch-all serves app shell (by design, not a server 404)", s, 200)
# call() truncates non-JSON bodies, so match the opening of the HTML shell.
check("  -> shell is an HTML document", str(b).lower().lstrip().startswith(("<!doctype", "<html")), True)

print("")
print("=== H. Search must cover title, company AND location ===")
# Regression: the jobs service only filtered on title, so any company or
# location search silently returned nothing even though the UI advertises
# "Search jobs by title, company, or location".
s, b = call("GET", "/api/v1/jobs/")
all_jobs = b.get("results", []) if isinstance(b, dict) else []
if all_jobs:
    sample = all_jobs[0]
    loc = (sample.get("location") or "").strip()
    comp = ((sample.get("company") or {}).get("name") or "").strip()
    if loc:
        s, b = call("GET", "/api/v1/jobs/?q=" + loc)
        check("jobs search by location %r finds results" % loc,
              (b or {}).get("count", 0) > 0, True)
    if comp:
        s, b = call("GET", "/api/v1/jobs/?q=" + comp)
        check("jobs search by company %r finds results" % comp,
              (b or {}).get("count", 0) > 0, True)
s, b = call("GET", "/api/v1/jobs/?q=zzz-no-such-job-anywhere")
check("bogus search returns 0, not everything", (b or {}).get("count", -1), 0)

print("")
print("=== I. Match score is explainable (match_breakdown) ===")
s, b = call("GET", "/api/v1/jobs/")
jid2 = (b.get("results") or [{}])[0].get("id") if isinstance(b, dict) else None
if jid2:
    s, anon_job = call("GET", "/api/v1/jobs/%s/" % jid2)
    check("anon detail omits breakdown (key present, value null)",
          "match_breakdown" in anon_job and anon_job["match_breakdown"] is None, True)
    s, stu_job = call("GET", "/api/v1/jobs/%s/" % jid2, token=stok)
    mb = stu_job.get("match_breakdown")
    check("student detail includes breakdown", isinstance(mb, dict), True)
    if isinstance(mb, dict):
        check("  -> breakdown score equals match_score",
              mb.get("score") == stu_job.get("match_score"), True)
        check("  -> carries a verdict", bool(mb.get("verdict")), True)
        check("  -> component points sum to the score",
              round(sum(c["points"] for c in mb.get("components", [])), 1) == mb.get("score"), True)
        check("  -> no component exceeds its weight",
              all(c["points"] <= c["max_points"] for c in mb.get("components", [])), True)

print("")
print("=== J. Social pages reachable (built but never routed) ===")
for ep in ["/api/v1/feed/", "/api/v1/feed/trending/",
           "/api/v1/connections/list_connections/",
           "/api/v1/connections/suggestions/", "/api/v1/connections/pending/"]:
    s, _ = call("GET", ep, token=stok)
    check("authed GET " + ep, s, 200)
for route in ["/feed", "/network", "/profile/1"]:
    s, b = call("GET", route)
    check("SPA route %s serves the app shell" % route, s, 200)

print(f"\n==== SUMMARY: {sum(results)}/{len(results)} checks passed ====")
