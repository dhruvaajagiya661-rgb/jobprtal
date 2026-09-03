"""
Django settings for portal project.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from datetime import timedelta

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)

# DEBUG defaults to False so that a deployment which forgets to set it fails
# closed rather than exposing tracebacks and settings to the public internet.
DEBUG = os.getenv("DEBUG", "False") == "True"

INSECURE_SECRET_KEY = "django-insecure-default-key"
SECRET_KEY = os.getenv("SECRET_KEY", INSECURE_SECRET_KEY)
if not DEBUG and SECRET_KEY == INSECURE_SECRET_KEY:
    raise ImproperlyConfigured(
        "SECRET_KEY must be set to a unique secret value when DEBUG is False. "
        "Generate one with: python -c \"from django.core.management.utils import "
        'get_random_secret_key as k; print(k())"'
    )

ALLOWED_HOSTS = (
    os.getenv("ALLOWED_HOSTS", "").split(",")
    if os.getenv("ALLOWED_HOSTS")
    else ["localhost", "127.0.0.1"]
)

if not DEBUG:
    # Production always sits behind a TLS-terminating proxy (Render's load
    # balancer/Cloudflare, or nginx), so Django receives plain HTTP plus an
    # X-Forwarded-Proto header. Trust it to learn the real scheme — without
    # this, SECURE_SSL_REDIRECT redirects http -> https to the very same URL
    # forever (a 301 loop), because every request looks like "http" to Django.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    # Opt-in via env, and only safe because of SECURE_PROXY_SSL_HEADER above.
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "False") == "True"
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "0"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
    SECURE_HSTS_PRELOAD = SECURE_HSTS_SECONDS > 0
else:
    SECURE_PROXY_SSL_HEADER = None
    SECURE_SSL_REDIRECT = False
    SECURE_HSTS_SECONDS = 0
    SECURE_HSTS_INCLUDE_SUBDOMAINS = False
    SECURE_HSTS_PRELOAD = False

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
CSRF_TRUSTED_ORIGINS = os.getenv(
    "CSRF_TRUSTED_ORIGINS", "http://localhost:5173,http://localhost:8000"
).split(",")
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# CORS settings
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:8000"
).split(",")
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = DEBUG  # Allow all origins in dev for convenience

ADMIN_URL = os.getenv("ADMIN_URL", "admin/")

LOGIN_URL = "/api/accounts/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "channels",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "drf_spectacular",
    "accounts",
    "jobs",
    "internships",
    "applications",
    "recruiters",
    "students",
    "notifications",
    "chat",
    "analytics",
    "careers",
    "feed",
    "network",
    "learning",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "portal.middleware.RLSContextMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "portal.middleware.CORSCustomHeaders",
    "portal.middleware.RequestLoggingMiddleware",
    "portal.middleware.APIVersionMiddleware",
    "portal.middleware.ErrorHandlingMiddleware",
]

AUTH_USER_MODEL = "accounts.CustomUser"

# Allow login with either email (USERNAME_FIELD) or username.
AUTHENTICATION_BACKENDS = [
    "accounts.backends.EmailOrUsernameModelBackend",
]

ROOT_URLCONF = "portal.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [os.path.join(BASE_DIR, "templates")],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "portal.wsgi.application"
ASGI_APPLICATION = "portal.asgi.application"

SITE_URL = os.getenv("SITE_URL", "http://localhost:8000")

EMAIL_BACKEND = os.getenv(
    # UTF-8 console backend so emoji-rich HTML emails render in the dev log
    # even on Windows (cp1252); override via EMAIL_BACKEND for real SMTP.
    "EMAIL_BACKEND", "portal.email_backends.ConsoleUTF8EmailBackend"
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", 587))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@portal.com")
# Inbox that the public /contact form delivers to.
CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "support@portal.com")

# Celery Configuration
CELERY_BROKER_URL = os.getenv(
    "CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://localhost:6379/0")
)
CELERY_RESULT_BACKEND = os.getenv(
    "CELERY_RESULT_BACKEND", os.getenv("REDIS_URL", "redis://localhost:6379/0")
)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "UTC"
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

USE_REDIS = os.getenv("REDIS_URL") and not DEBUG

if USE_REDIS:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [os.getenv("REDIS_URL")]},
        },
    }
else:
    CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
    }

if USE_REDIS:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": os.getenv("REDIS_URL", "redis://localhost:6379/1"),
            "OPTIONS": {
                "CLIENT_CLASS": "django_redis.client.DefaultClient",
                "CONNECTION_POOL_KWARGS": {"max_connections": 50},
                "IGNORE_EXCEPTIONS": True,
            },
            "KEY_PREFIX": "portal",
            "TIMEOUT": 300,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "unique-snowflake",
        }
    }

# Allow overriding the DB engine via env (use 'django.db.backends.sqlite3' for local dev without PostgreSQL)
DB_ENGINE = os.getenv("DB_ENGINE", "django.db.backends.postgresql")

if DB_ENGINE == "django.db.backends.sqlite3":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": DB_ENGINE,
            "NAME": os.getenv("DB_NAME", "portal_db"),
            "USER": os.getenv("DB_USER", "postgres"),
            "PASSWORD": os.getenv("DB_PASSWORD", "postgres"),
            "HOST": os.getenv("DB_HOST", "localhost"),
            "PORT": os.getenv("DB_PORT", "5432"),
            "OPTIONS": {
                "sslmode": os.getenv("DB_SSL_MODE", "prefer"),
            },
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# REST Framework configuration with JWT
REST_FRAMEWORK = {
    # JWT-only authentication for the API. SessionAuthentication is
    # deliberately excluded: the React SPA authenticates exclusively with
    # Bearer tokens and never sends a CSRF token, so DRF's session-based
    # CSRF enforcement would wrongly reject API calls (403 CSRF Failed)
    # whenever a browser session cookie is present (e.g. after Django admin
    # or template login). Django admin / template auth are unaffected.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
        "rest_framework.parsers.FormParser",
    ],
    "EXCEPTION_HANDLER": "portal.exceptions.custom_exception_handler",
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Rate limiting - high throughput, env-configurable defaults so the app
    # never trips 429s during normal use (raise further via env vars).
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv("THROTTLE_ANON_RATE", "5000/hour"),
        "user": os.getenv("THROTTLE_USER_RATE", "50000/hour"),
        # Auth stays more conservative: it's the only throttle guarding login/
        # register against brute force (per IP + account email).
        "auth": os.getenv("THROTTLE_AUTH_RATE", "300/hour"),
        # Unauthenticated and sends mail, so it stays tight.
        "contact": os.getenv("THROTTLE_CONTACT_RATE", "10/hour"),
    },
}

# SimpleJWT Configuration
# Token lifetimes are env-configurable so sessions can be lengthened for
# many users without redeploys (JWT_ACCESS_HOURS / JWT_REFRESH_DAYS). The
# defaults are deliberately long so users are rarely hit with 401 session
# expiry errors mid-use.
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=int(os.getenv("JWT_ACCESS_HOURS", 24))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", 30))),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    # Only "Bearer" is used by the SPA and API clients; a second header
    # type would also break the OpenAPI bearerFormat definition.
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "PortAL API",
    "DESCRIPTION": "Enterprise Internship & Job Portal API",
    "VERSION": "2.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "DISABLE_ERRORS_AND_WARNINGS": True,
    "SWAGGER_UI_DIST": "https://unpkg.com/swagger-ui-dist@5.17.14",
    "SWAGGER_UI_FAVICON_HREF": "https://unpkg.com/swagger-ui-dist@5.17.14/favicon-32x32.png",
    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "persistAuthorization": True,
        "displayOperationId": True,
        "defaultModelsExpandDepth": 1,
    },
    "REDOC_DIST": "https://cdn.jsdelivr.net/npm/redoc@next/bundles/redoc.standalone.js",
    "COMPONENT_SPLIT_REQUEST": True,
    # Job and Internship share the same type choices; name the shared enum
    # once so the schema doesn't emit collision warnings.
    "ENUM_NAME_OVERRIDES": {
        "JobTypeEnum": "jobs.models.Job.JOB_TYPE_CHOICES",
        "UserTypeEnum": ["student", "recruiter"],
    },
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [os.path.join(BASE_DIR, "static")]
STATIC_ROOT = os.path.join(BASE_DIR, "staticfiles")

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {module} {process:d} {thread:d} {message}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "simple": {"format": "{levelname} {message}", "style": "{"},
    },
    "filters": {
        "require_debug_true": {"()": "django.utils.log.RequireDebugTrue"},
        "require_debug_false": {"()": "django.utils.log.RequireDebugFalse"},
    },
    "handlers": {
        "console": {
            "level": "DEBUG" if DEBUG else "INFO",
            "class": "logging.StreamHandler",
            "formatter": "simple",
            "filters": ["require_debug_true"] if DEBUG else [],
        },
        # SafeRotatingFileHandler closes the stream after every write so
        # rotation never fails on Windows when the Django autoreloader parent
        # and the server child both hold the same log file open.
        "file": {
            "level": "ERROR",
            "class": "portal.logging_utils.SafeRotatingFileHandler",
            "filename": os.path.join(BASE_DIR, "django_errors.log"),
            "maxBytes": 1024 * 1024 * 10,
            "backupCount": 5,
            "formatter": "verbose",
            "delay": True,
        },
        "debug_file": {
            "level": "DEBUG",
            "class": "portal.logging_utils.SafeRotatingFileHandler",
            "filename": os.path.join(BASE_DIR, "django_debug.log"),
            "maxBytes": 1024 * 1024 * 10,
            "backupCount": 3,
            "formatter": "verbose",
            "delay": True,
        },
        "security_file": {
            "level": "INFO",
            "class": "portal.logging_utils.SafeRotatingFileHandler",
            "filename": os.path.join(BASE_DIR, "django_security.log"),
            "maxBytes": 1024 * 1024 * 5,
            "backupCount": 5,
            "formatter": "verbose",
            "delay": True,
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "django.server": {
            "handlers": ["console", "debug_file"],
            "level": "DEBUG" if DEBUG else "WARNING",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console", "debug_file"],
            "level": "DEBUG" if DEBUG else "ERROR",
            "propagate": False,
        },
        "django.db.backends": {
            "handlers": ["debug_file"],
            "level": "DEBUG" if DEBUG else "WARNING",
            "propagate": False,
        },
        "django.security": {
            "handlers": ["security_file"],
            "level": "INFO",
            "propagate": False,
        },
        "accounts": {
            "handlers": ["console", "file"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "jobs": {
            "handlers": ["console", "file"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "chat": {
            "handlers": ["console", "file"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
        "channels": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "portal": {
            "handlers": ["console", "file", "debug_file"],
            "level": "DEBUG" if DEBUG else "INFO",
            "propagate": False,
        },
    },
}
