from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "django-insecure-3!nijdpqai3848b1$iw5z85izkpc6pgkx+&qt!d#67axvtptz^"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 3rd party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # local
    "accounts",
    "core",
    "queues",
    "notifications",
    "analytics",
    "opd",
    "abdm",
    "hmis",
    "ot",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Karachi"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Digital AIIMS Queue Management API",
    "DESCRIPTION": "REST API for patient queue management (tokens, counters, displays, notifications).",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# ── Eka Care / ABDM integration ──────────────────────────────────────
# Flip EKA_CARE_MODE to "live" and supply credentials to hit the real gateway.
import os as _os
EKA_CARE_MODE = _os.environ.get("EKA_CARE_MODE", "mock")           # mock | live
EKA_CARE_BASE_URL = _os.environ.get("EKA_CARE_BASE_URL", "https://api.eka.care")
EKA_CARE_CLIENT_ID = _os.environ.get("EKA_CARE_CLIENT_ID", "")
EKA_CARE_CLIENT_SECRET = _os.environ.get("EKA_CARE_CLIENT_SECRET", "")
EKA_CARE_HIP_ID = _os.environ.get("EKA_CARE_HIP_ID", "AIIMS-HIP")
EKA_CARE_HIU_ID = _os.environ.get("EKA_CARE_HIU_ID", "AIIMS-HIU")

# ── HMIS integration ─────────────────────────────────────────────────
# Flip HMIS_MODE to "live" once an HMISProvider is configured with real
# credentials. In mock mode the client returns synthesised responses.
HMIS_MODE = _os.environ.get("HMIS_MODE", "mock")  # mock | live
HMIS_DEFAULT_TIMEOUT = int(_os.environ.get("HMIS_DEFAULT_TIMEOUT", "20"))

# ── MedVantage demo HMIS (UHID lookup for kiosk) ──────────────────────
# GET {URL}?UHID=<uhid>&ClientId=<client>
# Demo endpoint uses a self-signed cert; toggle VERIFY_TLS=false in dev.
MEDVANTAGE_UHID_URL = _os.environ.get(
    "MEDVANTAGE_UHID_URL",
    "https://demo.medvantage.tech:7082/api/v2/PatientPersonalDashboard/GetPatientDetailsByUHID",
)
MEDVANTAGE_CLIENT_ID = _os.environ.get("MEDVANTAGE_CLIENT_ID", "176")
MEDVANTAGE_VERIFY_TLS = _os.environ.get("MEDVANTAGE_VERIFY_TLS", "false")

# ── Localisation ─────────────────────────────────────────────────────
# Supported in the queue UI / announcements. See queues/i18n.py for the
# authoritative translation tables.
LANGUAGES_SUPPORTED = [
    "en", "hi", "bn", "te", "mr", "ta", "ur", "gu", "kn", "ml",
    "or", "pa", "as", "sa", "ne", "ks", "sd", "kok", "mai", "mni",
    "sat", "brx", "doi",
]
