# PortAL - Professional Internship & Job Portal

PortAL is a production-ready, full-stack Internship & Job Portal built with Django and PostgreSQL. It features a modern UI/UX, role-based access control, and a complete hiring pipeline.

## 🚀 Features

- **Authentication System**: Custom User Model with Student and Recruiter roles.
- **Student Features**: Profile management, resume upload, job search with filters, and application tracking.
- **Recruiter Features**: Company profile, job/internship posting, applicant management (Shortlist/Reject/Accept).
- **Advanced Logic**: Real-time in-app notifications for application status updates.
- **Modern UI**: Professional Glassmorphism design, responsive layouts, and smooth animations.
- **API Ready**: Django REST Framework integrated for future mobile app expansion.
- **Explainable Match Score**: Every job shows *why* it matches you — a per-component
  breakdown (skills, experience, field fit, location) plus the exact skills you have
  and the ones to learn, linked straight to the skill-gap planner.
- **Social Layer**: Activity feed, professional network with connection requests and
  suggestions, endorsements, and public profiles.
- **Non-blocking Feedback**: App-wide toast notifications for every success and error.

## 🛠️ Tech Stack & Architecture

- **Backend**: Python 3.10+, Django 5.2 (Service Layer Pattern)
- **Real-Time**: Django Channels, Daphne, WebSockets
- **API**: Django REST Framework (DRF)
- **Database**: PostgreSQL (with JSONB support for Portfolios)
- **Frontend**: Bootstrap 5, Glassmorphism UI
- **Security**: RBAC, Audit Logging, CSRF, Environment isolation

### Architecture Pattern: Service Layer
PortAL implements a **Service Layer** pattern to isolate business logic from Django views and models. This ensures high testability and maintainability, making it a production-ready solution for complex hiring workflows.

## 🚀 Advanced Features for Developers

- **Verified GitHub Portfolios**: Automatically sync and verify skills through public repository analysis.
- **Real-Time Collaboration**: Live chat and instant notifications for application updates.
- **Enterprise RBAC**: Production-grade security mixins and decorators for granular access control.
- **API-First Design**: Fully documented REST endpoints for mobile and third-party integrations.

## 🗺️ Project Roadmap (Next 12 Months)

### Q3 2026: The Intelligence Update
- **AI-Powered Matching**: Advanced ML models to rank candidates based on job requirements.
- **Automated Resume Parsing**: Extract skills and experience directly from uploaded PDFs.

### Q4 2026: Community & Ecosystem
- **OpenAPI/Swagger Documentation**: Comprehensive interactive API docs.
- **Mobile App Beta**: React Native integration with the existing API.

### Q1 2027: Enterprise Scaling
- **Redis Integration**: Distributed caching and channel layers for high-concurrency support.
- **Multi-Tenant Support**: Dedicated spaces for large organizations.

## 🤝 Community & Support

- **Contribution**: See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
- **Code of Conduct**: We follow the Contributor Covenant. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- **Security**: Report vulnerabilities via our security policy.

## ⚙️ Setup Instructions

### 1. Clone & Install
```bash
# Clone the repository
pip install -r requirements.txt
```

### 2. Database Configuration
Create a PostgreSQL database named `portal_db`. Update the `.env` file with your credentials:
```env
DB_NAME=portal_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

### 3. Migrations & Superuser
```bash
python manage.py makemigrations
python manage.py migrate
# Create admin (admin@portal.com / admin)
python manage.py createsuperuser
```

### 4. Run Development Server
```bash
python manage.py runserver
```

## 📁 Folder Structure
- `accounts/`: Auth & User profiles.
- `jobs/`: Job & Skill management.
- `recruiters/`: Company & Hiring tools.
- `students/`: Student profiles & Dashboards.
- `applications/`: Application submission logic.
- `notifications/`: In-app alert system.
- `templates/`: Global and app-specific HTML.
- `static/`: Professional CSS and JS assets.

## ✅ Testing & QA

The project ships with two layers of automated checks:

```bash
# 1. Unit / integration suite (216 tests across 13 apps)
python -m pytest

# 2. Live error-code regression suite (56 checks)
#    Replays every flow that historically returned 401/404/429/500.
python manage.py runserver 8000   # in one terminal
python qa_error_regression.py     # in another
```

The regression suite also guards the search behaviour, the match-score
explanation, and the reachability of every SPA route.

## 🌐 Public Site & SEO

Beyond the product itself, PortAL ships the surface a real website needs:

- **Company & legal pages** — `/about`, `/contact`, `/privacy`, `/terms`, all
  linked from the footer.
- **A working contact form** — `POST /api/v1/platform/contact/` validates,
  rate-limits (10/hour per IP) and emails `CONTACT_EMAIL`. It reports a real
  failure rather than claiming success it did not achieve.
- **Live figures, never invented ones** — the home page and About page read
  `GET /api/v1/platform/stats/` (open jobs, internships, companies hiring,
  registered students), cached for five minutes.
- **Per-page metadata** — `useSeo()` gives every route its own title,
  description and canonical URL, with job and internship pages titled from the
  role and company. Pages behind auth are marked `noindex`.
- **Crawler endpoints** — `/robots.txt` and `/sitemap.xml` are served by Django
  (so they work with or without a built SPA); the sitemap lists every open job
  and internship.
- **Share cards & PWA** — Open Graph / Twitter tags, a 1200×630 share image,
  an SVG favicon, and a web manifest with maskable icons.

## 🚢 Production Deployment

```bash
# 1. Configure the environment (see .env.example for every variable)
cp .env.example .env
python -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
#    -> put that in SECRET_KEY, set DEBUG=False, set SITE_URL and ALLOWED_HOSTS

# 2. Build the SPA. VITE_SITE_URL is baked into the canonical/Open Graph tags,
#    so set it to the real origin or link previews will point at localhost.
cd frontend && VITE_SITE_URL=https://your-domain.com npm ci && npm run build && cd ..

# 3. Migrate and collect static files
python manage.py migrate
python manage.py collectstatic --noinput

# 4. Serve (Daphne handles both HTTP and the chat websockets)
daphne -b 0.0.0.0 -p 8000 portal.asgi:application
```

`docker-compose.yml` and `nginx.conf` wire the same thing up behind nginx, with
`/static/`, `/media/` and the hashed `/assets/` bundles served directly.

**The app refuses to boot with `DEBUG=False` and a placeholder `SECRET_KEY`** —
that is deliberate. Set a real one.

## 🛡️ Security & Quality
- `DEBUG` defaults to `False`, so a missing env var fails closed.
- HSTS, secure cookies, SSL redirect and nosniff switch on automatically
  outside development.
- JWT auth with rotating refresh tokens; role-scoped access on every endpoint.
- Per-IP throttling on auth and on the public contact form.
- Follows PEP8 standards.
- Modular app structure for scalability.
- Secure file handling for resumes and logos.
