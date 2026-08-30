"""QA smoke test: exercises key API flows against the running server."""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8000"


def call(method, path, data=None, token=None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(BASE + path, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:300]


results = []
def record(name, status, ok):
    results.append((name, status, ok))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  ->  HTTP {status}")


# 1. Health endpoints
for ep in ["/health/", "/ready/", "/alive/"]:
    try:
        s, b = call("GET", ep)
        record(f"GET {ep}", s, s == 200)
    except Exception as e:
        record(f"GET {ep}", 0, False)
        print("   ", e)

# 2. Public list endpoints
for ep in ["/api/v1/jobs/", "/api/v1/internships/", "/api/v1/skills/"]:
    s, b = call("GET", ep)
    record(f"GET {ep}", s, s == 200)

# 3. Admin login + admin dashboard
s, b = call("POST", "/api/auth/login/", {"email": "admin@portal.com", "password": "admin"})
admin_token = (b or {}).get("access") or (b or {}).get("token")
record("login admin", s, s == 200 and bool(admin_token))
if admin_token:
    s, b = call("GET", "/api/v1/admin/dashboard/", token=admin_token)
    record("GET /api/v1/admin/dashboard/ (admin)", s, s == 200)
    s, b = call("GET", "/api/accounts/me/", token=admin_token)
    record("GET me (admin)", s, s == 200 or s == 404)

# 4. Recruiter login (seed password) + recruiter endpoints
s, b = call("POST", "/api/auth/login/", {"email": "hiring@toptech.com", "password": "password123"})
rec_token = (b or {}).get("access") or (b or {}).get("token")
record("login recruiter (seed)", s, s == 200 and bool(rec_token))
if rec_token:
    s, b = call("GET", "/api/v1/recruiters/me/", token=rec_token)
    record("GET /api/v1/recruiters/me/", s, s == 200)
    s, b = call("GET", "/api/v1/recruiters/company/", token=rec_token)
    record("GET /api/v1/recruiters/company/", s, s in (200, 404))
    # Previously-broken: create_job without company -> should be 201
    s, b = call(
        "POST",
        "/api/v1/recruiters/create_job/",
        {
            "title": "QA Smoke Test Job",
            "description": "Temp job created by QA smoke test",
            "requirements": "Python",
            "location": "Remote",
            "salary": "100000",
            "job_type": "Full-time",
            "experience_required": "2-3 years",
            "deadline": "2027-01-01",
        },
        token=rec_token,
    )
    record("POST create_job (no company_id)", s, s == 201)
    if s == 201 and isinstance(b, dict):
        print("      created job id:", b.get("id"), "| company:", b.get("company"))

# 5. Register fresh student -> login -> interview-prep flows
import uuid
email = f"qa_student_{uuid.uuid4().hex[:8]}@test.com"
s, b = call("POST", "/api/auth/register/", {"email": email, "password": "QaPass!234", "user_type": "student"})
record("register student", s, s in (200, 201))
s, b = call("POST", "/api/auth/login/", {"email": email, "password": "QaPass!234"})
st_token = (b or {}).get("access") or (b or {}).get("token")
record("login student", s, s == 200 and bool(st_token))
if st_token:
    s, b = call("GET", "/api/v1/interview-prep/hub/", token=st_token)
    record("GET interview-prep/hub", s, s == 200)
    qs = None
    if isinstance(b, dict):
        qs = (b.get("recent_questions") or [])
    qid = qs[0]["id"] if qs else None
    if qid:
        # Previously-broken: record_attempt -> should be 200
        s, b = call(
            "POST",
            "/api/v1/interview-prep/record_attempt/",
            {"question_id": qid, "correct": True, "mode": "practice"},
            token=st_token,
        )
        record("POST record_attempt (serialization fix)", s, s == 200)
        s, b = call("GET", "/api/v1/interview-prep/progress/", token=st_token)
        record("GET interview-prep/progress", s, s == 200)
    else:
        print("   (no questions in hub; skipping record_attempt)")
    s, b = call("GET", "/api/v1/students/dashboard/", token=st_token)
    record("GET students/dashboard", s, s in (200, 404))

print("\n==== SUMMARY ====")
failed = [r for r in results if not r[2]]
print(f"{len(results) - len(failed)}/{len(results)} checks passed")
for name, status, ok in failed:
    print("  FAILED:", name, "HTTP", status)
