"""Eka Care ABDM API client.

Eka Care acts as the HIP/HIU gateway on top of the ABDM M3 APIs. This client
wraps the endpoints we need for an OPD flow:

  • Gateway auth (client_id + client_secret → access_token)
  • Enrolment by Aadhaar OTP  (create a new ABHA Address)
  • Enrolment by Mobile OTP    (existing ABHA login)
  • Profile fetch
  • ABHA card download
  • Care-context link
  • Share FHIR bundle (HIP data-push)

Modes
─────
EKA_CARE_MODE = "mock" (default) — returns plausible fake responses and
  never touches the network. Perfect for local dev, tests and demos.
EKA_CARE_MODE = "live" — real HTTPS calls to `EKA_CARE_BASE_URL`, using
  credentials read from env / Django settings.

Every call is journalled to `ABDMTransaction` so you can audit the full
Eka Care conversation from the Django admin.

Reference: Eka Care Developer Docs — https://developer.eka.care/
"""
from __future__ import annotations

import base64
import json
import secrets
import string
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone as dtz
from typing import Any

from django.conf import settings
from django.utils import timezone

from .models import ABDMTransaction, ABHAProfile


DEFAULT_BASE_URL = "https://api.eka.care"


# ── Config ──────────────────────────────────────────────────────────

def _cfg(name: str, default: Any = "") -> Any:
    """Read first from Django settings, then from settings.EKA_CARE (dict)."""
    if hasattr(settings, name):
        return getattr(settings, name)
    eka_cfg = getattr(settings, "EKA_CARE", {}) or {}
    return eka_cfg.get(name.replace("EKA_CARE_", "").lower(), default)


def mode() -> str:
    return str(_cfg("EKA_CARE_MODE", "mock")).lower()


def base_url() -> str:
    return _cfg("EKA_CARE_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


# ── HTTP helper ──────────────────────────────────────────────────────

class EkaCareError(RuntimeError):
    def __init__(self, message: str, *, status: int | None = None, body: Any = None):
        super().__init__(message)
        self.status = status
        self.body = body


def _http(method: str, url: str, *, headers: dict | None = None, body: dict | None = None, timeout: int = 20):
    data = None
    hdr = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdr["Content-Type"] = "application/json"
    if headers:
        hdr.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdr, method=method.upper())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8") or "{}"
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace") if hasattr(e, "read") else ""
        try:
            parsed = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw}
        raise EkaCareError(f"HTTP {e.code} from Eka Care", status=e.code, body=parsed) from e
    except urllib.error.URLError as e:
        raise EkaCareError(f"Network error calling Eka Care: {e.reason}") from e


# ── Audit journaling ─────────────────────────────────────────────────

def _journal(kind: str, *, patient=None, endpoint: str = "",
             request_body: dict | None = None, response_body: Any = None,
             http_status: int | None = None, ok: bool = True,
             error: str = "", request_id: str = "") -> ABDMTransaction:
    return ABDMTransaction.objects.create(
        kind=kind, patient=patient,
        endpoint=endpoint,
        request_body=request_body or {},
        response_body=response_body or {},
        http_status=http_status,
        ok=ok, error=error[:500],
        request_id=request_id,
    )


# ── Mock helpers ─────────────────────────────────────────────────────

def _mock_abha_number() -> str:
    g = lambda n: "".join(secrets.choice(string.digits) for _ in range(n))
    return f"{g(2)}-{g(4)}-{g(4)}-{g(4)}"


def _mock_token(label: str) -> str:
    return base64.urlsafe_b64encode(f"{label}:{secrets.token_hex(16)}".encode()).decode().rstrip("=")


def _mock_txn_id() -> str:
    return f"mock-txn-{secrets.token_hex(6)}"


# ── Gateway auth ─────────────────────────────────────────────────────

_ACCESS_TOKEN_CACHE: dict[str, Any] = {"token": None, "expires_at": None}


def gateway_token() -> str:
    """Fetch (or reuse) a gateway access token. Mock-safe."""
    if _ACCESS_TOKEN_CACHE["token"] and _ACCESS_TOKEN_CACHE["expires_at"] and \
            _ACCESS_TOKEN_CACHE["expires_at"] > timezone.now():
        return _ACCESS_TOKEN_CACHE["token"]

    if mode() == "mock":
        tok = _mock_token("gw")
        _ACCESS_TOKEN_CACHE["token"] = tok
        _ACCESS_TOKEN_CACHE["expires_at"] = timezone.now() + timedelta(minutes=50)
        _journal("auth", endpoint="mock://connect/token", response_body={"access_token": tok}, http_status=200)
        return tok

    client_id = _cfg("EKA_CARE_CLIENT_ID")
    client_secret = _cfg("EKA_CARE_CLIENT_SECRET")
    if not (client_id and client_secret):
        raise EkaCareError("EKA_CARE_CLIENT_ID / EKA_CARE_CLIENT_SECRET are not configured.")

    url = f"{base_url()}/connect-auth/v1/account/login"
    body = {"client_id": client_id, "client_secret": client_secret}
    status, resp = _http("POST", url, body=body)
    token = resp.get("access_token") or resp.get("accessToken")
    if not token:
        _journal("auth", endpoint=url, request_body=body, response_body=resp, http_status=status, ok=False,
                 error="no access_token in response")
        raise EkaCareError("Eka Care auth did not return an access_token", body=resp)
    _ACCESS_TOKEN_CACHE["token"] = token
    _ACCESS_TOKEN_CACHE["expires_at"] = timezone.now() + timedelta(seconds=resp.get("expires_in", 3000))
    _journal("auth", endpoint=url, request_body={"client_id": client_id}, response_body={"ok": True}, http_status=status)
    return token


def _authed_headers(extra: dict | None = None) -> dict:
    h = {"Authorization": f"Bearer {gateway_token()}"}
    if extra:
        h.update(extra)
    return h


# ── Aadhaar flow (create ABHA) ───────────────────────────────────────

def request_aadhaar_otp(aadhaar: str, *, patient=None) -> dict:
    """Send OTP to the mobile linked with the given 12-digit Aadhaar.

    Returns: {"txn_id": str, "sent_to": "xxx-xxx-0000"}.
    """
    if len(aadhaar.replace(" ", "")) != 12 or not aadhaar.replace(" ", "").isdigit():
        raise EkaCareError("Aadhaar must be 12 digits.")
    endpoint = f"{base_url()}/abdm/na/v1/registration/aadhaar/generate-otp"

    if mode() == "mock":
        resp = {"txn_id": _mock_txn_id(), "sent_to": "XXX-XXX-" + aadhaar[-4:]}
        _journal("otp_request", patient=patient, endpoint="mock://" + endpoint,
                 request_body={"aadhaar": "***-***-" + aadhaar[-4:]},
                 response_body=resp, http_status=200, request_id=resp["txn_id"])
        return resp

    status, resp = _http("POST", endpoint, headers=_authed_headers(),
                         body={"aadhaar": aadhaar})
    _journal("otp_request", patient=patient, endpoint=endpoint,
             request_body={"aadhaar": "***-***-" + aadhaar[-4:]},
             response_body=resp, http_status=status, ok=200 <= status < 300,
             request_id=resp.get("txn_id", ""))
    return resp


def verify_aadhaar_otp(*, txn_id: str, otp: str, mobile: str = "", patient=None) -> dict:
    """Verify the Aadhaar OTP and (optionally) link a mobile number.

    Returns a profile dict ready to persist into `ABHAProfile`.
    """
    endpoint = f"{base_url()}/abdm/na/v1/registration/aadhaar/verify-otp"

    if mode() == "mock":
        if otp not in {"123456", "000000"}:
            _journal("otp_verify", patient=patient, endpoint="mock://" + endpoint,
                     response_body={"error": "invalid otp"}, http_status=400, ok=False, error="invalid otp")
            raise EkaCareError("Invalid OTP (mock expects 123456).", status=400)
        # fabricate a profile
        first = (patient.full_name.split()[0] if patient else "Demo") if patient else "Demo"
        last = (patient.full_name.split()[-1] if patient and " " in patient.full_name else "User")
        abha_addr = f"{first.lower()}{secrets.randbelow(9999):04d}@abdm"
        resp = {
            "abha_number": _mock_abha_number(),
            "abha_address": abha_addr,
            "first_name": first, "last_name": last,
            "gender": getattr(patient, "gender", "") or "O",
            "mobile": mobile or getattr(patient, "phone", "") or "",
            "kyc_verified": True, "kyc_method": "aadhaar",
            "x_token": _mock_token("patient"),
            "expires_in": 1800,
            "eka_care_user_id": f"eka-{secrets.token_hex(4)}",
            "photo_base64": "",
        }
        _journal("otp_verify", patient=patient, endpoint="mock://" + endpoint,
                 request_body={"txn_id": txn_id}, response_body={"abha_address": abha_addr},
                 http_status=200, request_id=txn_id)
        return resp

    status, resp = _http("POST", endpoint, headers=_authed_headers(),
                         body={"txn_id": txn_id, "otp": otp, "mobile": mobile})
    _journal("otp_verify", patient=patient, endpoint=endpoint,
             request_body={"txn_id": txn_id}, response_body=resp,
             http_status=status, ok=200 <= status < 300, request_id=txn_id)
    if not (200 <= status < 300):
        raise EkaCareError("OTP verification failed.", status=status, body=resp)
    return resp


# ── Mobile-number flow (existing ABHA login) ─────────────────────────

def request_mobile_otp(mobile: str, *, patient=None) -> dict:
    endpoint = f"{base_url()}/abdm/na/v1/phr/login/mobile/generate-otp"
    if mode() == "mock":
        resp = {"txn_id": _mock_txn_id(), "sent_to": "XXXXXX" + mobile[-4:]}
        _journal("otp_request", patient=patient, endpoint="mock://" + endpoint,
                 request_body={"mobile": "***" + mobile[-4:]},
                 response_body=resp, http_status=200, request_id=resp["txn_id"])
        return resp
    status, resp = _http("POST", endpoint, headers=_authed_headers(), body={"mobile": mobile})
    _journal("otp_request", patient=patient, endpoint=endpoint,
             request_body={"mobile": "***" + mobile[-4:]}, response_body=resp,
             http_status=status, ok=200 <= status < 300, request_id=resp.get("txn_id", ""))
    return resp


def verify_mobile_otp(*, txn_id: str, otp: str, patient=None) -> dict:
    endpoint = f"{base_url()}/abdm/na/v1/phr/login/mobile/verify-otp"
    if mode() == "mock":
        if otp not in {"123456", "000000"}:
            raise EkaCareError("Invalid OTP (mock expects 123456).", status=400)
        addresses = [f"demo{secrets.randbelow(999):03d}@abdm"]
        resp = {"txn_id": txn_id, "abha_addresses": addresses}
        _journal("otp_verify", patient=patient, endpoint="mock://" + endpoint,
                 response_body=resp, http_status=200, request_id=txn_id)
        return resp
    status, resp = _http("POST", endpoint, headers=_authed_headers(),
                         body={"txn_id": txn_id, "otp": otp})
    _journal("otp_verify", patient=patient, endpoint=endpoint,
             response_body=resp, http_status=status, ok=200 <= status < 300, request_id=txn_id)
    if not (200 <= status < 300):
        raise EkaCareError("Mobile OTP verification failed.", status=status, body=resp)
    return resp


# ── Profile & card ───────────────────────────────────────────────────

def fetch_profile(abha_address: str, *, patient=None) -> dict:
    endpoint = f"{base_url()}/abdm/na/v1/profile/account"
    if mode() == "mock":
        try:
            profile = ABHAProfile.objects.get(abha_address=abha_address)
            resp = {
                "abha_number": profile.abha_number,
                "abha_address": profile.abha_address,
                "first_name": profile.first_name, "last_name": profile.last_name,
                "mobile": profile.mobile, "gender": profile.gender,
                "date_of_birth": profile.date_of_birth.isoformat() if profile.date_of_birth else None,
                "kyc_verified": profile.kyc_verified,
            }
        except ABHAProfile.DoesNotExist:
            resp = {"abha_address": abha_address, "kyc_verified": False, "mock": True}
        _journal("abha_fetch", patient=patient, endpoint="mock://" + endpoint,
                 response_body=resp, http_status=200)
        return resp
    status, resp = _http("GET", endpoint,
                         headers=_authed_headers({"X-HIP-ID": _cfg("EKA_CARE_HIP_ID", "")}))
    _journal("abha_fetch", patient=patient, endpoint=endpoint,
             response_body=resp, http_status=status, ok=200 <= status < 300)
    return resp


def download_abha_card(abha_address: str, *, patient=None) -> dict:
    """Returns a dict with base64 PNG (key: 'card_base64')."""
    endpoint = f"{base_url()}/abdm/na/v1/profile/account/abha-card"
    if mode() == "mock":
        # 1x1 transparent PNG
        png = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=")
        resp = {"card_base64": png, "mime": "image/png"}
        _journal("abha_fetch", patient=patient, endpoint="mock://" + endpoint,
                 response_body={"ok": True}, http_status=200)
        return resp
    status, resp = _http("GET", endpoint, headers=_authed_headers())
    _journal("abha_fetch", patient=patient, endpoint=endpoint, response_body=resp,
             http_status=status, ok=200 <= status < 300)
    return resp


# ── Care Context + HIP share ─────────────────────────────────────────

def link_care_context(abha: ABHAProfile, *, reference: str, display: str,
                      hi_types: list[str] | None = None) -> dict:
    """Announce a new care-context to ABDM so the patient can see it in PHR apps."""
    endpoint = f"{base_url()}/abdm/hip/v1/care-contexts/link"
    payload = {
        "patient": {
            "reference": abha.abha_address,
            "display": f"{abha.first_name} {abha.last_name}".strip() or abha.abha_address,
            "careContexts": [{"referenceNumber": reference, "display": display}],
            "hiTypes": hi_types or ["OPConsultation"],
        },
    }
    if mode() == "mock":
        resp = {"linked": True, "eka_context_id": f"cc-{secrets.token_hex(6)}"}
        _journal("care_context_link", patient=abha.patient,
                 endpoint="mock://" + endpoint, request_body=payload,
                 response_body=resp, http_status=200)
        return resp
    status, resp = _http("POST", endpoint,
                         headers=_authed_headers({"X-HIP-ID": _cfg("EKA_CARE_HIP_ID", "")}),
                         body=payload)
    _journal("care_context_link", patient=abha.patient, endpoint=endpoint,
             request_body=payload, response_body=resp,
             http_status=status, ok=200 <= status < 300)
    if not (200 <= status < 300):
        raise EkaCareError("Care context link failed", status=status, body=resp)
    return resp


def share_fhir_bundle(abha: ABHAProfile, *, care_context_ref: str, record_type: str,
                      fhir_bundle: dict) -> dict:
    """POST a FHIR bundle to Eka Care (HIP data-push).

    Eka Care exposes `/abdm/hip/v1/health-information/notify` for this.
    """
    endpoint = f"{base_url()}/abdm/hip/v1/health-information/notify"
    payload = {
        "patient": {"id": abha.abha_address, "abha_number": abha.abha_number},
        "careContextReference": care_context_ref,
        "type": record_type,
        "bundle": fhir_bundle,
    }
    if mode() == "mock":
        resp = {
            "acknowledged": True,
            "hi_request_id": f"hi-{secrets.token_hex(6)}",
            "stored_resources": len(fhir_bundle.get("entry", [])),
        }
        _journal("hip_share", patient=abha.patient,
                 endpoint="mock://" + endpoint,
                 request_body={"careContextReference": care_context_ref, "type": record_type},
                 response_body=resp, http_status=200,
                 request_id=resp["hi_request_id"])
        return resp
    status, resp = _http("POST", endpoint,
                         headers=_authed_headers({"X-HIP-ID": _cfg("EKA_CARE_HIP_ID", "")}),
                         body=payload)
    _journal("hip_share", patient=abha.patient, endpoint=endpoint,
             request_body={"careContextReference": care_context_ref, "type": record_type},
             response_body=resp, http_status=status, ok=200 <= status < 300,
             request_id=resp.get("hi_request_id", ""))
    if not (200 <= status < 300):
        raise EkaCareError("HIP data push failed", status=status, body=resp)
    return resp


# ── Consent ──────────────────────────────────────────────────────────

def request_consent(*, abha_address: str, purpose: str, hi_types: list[str],
                    date_from: datetime, date_to: datetime, expires_at: datetime,
                    requester_name: str = "AIIMS Hospital",
                    requester_id: str = "", patient=None) -> dict:
    endpoint = f"{base_url()}/abdm/hiu/v1/consent-requests/init"
    body = {
        "purpose": {"code": purpose, "text": dict(ABDMTransaction._meta.get_field("kind").choices).get("consent_request")},
        "patient": {"id": abha_address},
        "hiu": {"id": requester_id, "name": requester_name},
        "requester": {"name": requester_name},
        "hiTypes": hi_types,
        "permission": {
            "accessMode": "VIEW",
            "dateRange": {"from": date_from.isoformat(), "to": date_to.isoformat()},
            "dataEraseAt": expires_at.isoformat(),
            "frequency": {"unit": "HOUR", "value": 1, "repeats": 0},
        },
    }
    if mode() == "mock":
        resp = {"consent_request_id": f"cr-{secrets.token_hex(6)}", "status": "REQUESTED"}
        _journal("consent_request", patient=patient,
                 endpoint="mock://" + endpoint, request_body=body, response_body=resp,
                 http_status=200, request_id=resp["consent_request_id"])
        return resp
    status, resp = _http("POST", endpoint,
                         headers=_authed_headers({"X-HIU-ID": _cfg("EKA_CARE_HIU_ID", "")}),
                         body=body)
    _journal("consent_request", patient=patient, endpoint=endpoint,
             request_body=body, response_body=resp,
             http_status=status, ok=200 <= status < 300,
             request_id=resp.get("consent_request_id", ""))
    if not (200 <= status < 300):
        raise EkaCareError("Consent request failed", status=status, body=resp)
    return resp
