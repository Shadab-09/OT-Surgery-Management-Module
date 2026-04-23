"""HMIS HTTP client.

Wraps the generic REST surface we use to talk to the hospital's Hospital
Management Information System. Follows the same two-mode pattern as
``abdm.eka_client``:

  * ``HMIS_MODE = "mock"`` (default) — returns plausible fake responses so
    local development, CI, and demos don't need a real endpoint. Mock data
    is seeded from the ``HMISAppointment`` / ``HMISPatientLink`` tables when
    present; otherwise synthesised on the fly.
  * ``HMIS_MODE = "live"`` — performs real HTTPS calls against the provider's
    ``base_url``. Auth header is chosen from ``provider.auth_type``.

Every call is journalled to :class:`HMISTransaction` for audit.
"""
from __future__ import annotations

import base64
import json
import hashlib
import hmac
import secrets
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone as dtz
from typing import Any

from django.conf import settings
from django.utils import timezone

from core.models import Patient
from .models import HMISProvider, HMISTransaction


class HMISError(RuntimeError):
    def __init__(self, message: str, *, status: int | None = None, body: Any = None):
        super().__init__(message)
        self.status = status
        self.body = body


# ── Config ──────────────────────────────────────────────────────────

def mode() -> str:
    return str(getattr(settings, "HMIS_MODE", "mock")).lower()


def _primary_provider() -> HMISProvider | None:
    return HMISProvider.objects.filter(is_active=True, is_primary=True).first() \
        or HMISProvider.objects.filter(is_active=True).first()


def _resolve_provider(provider: HMISProvider | str | int | None) -> HMISProvider:
    if isinstance(provider, HMISProvider):
        return provider
    if isinstance(provider, int):
        return HMISProvider.objects.get(pk=provider)
    if isinstance(provider, str):
        return HMISProvider.objects.get(code=provider)
    p = _primary_provider()
    if not p:
        raise HMISError("No active HMIS provider configured.")
    return p


# ── Auth headers ─────────────────────────────────────────────────────

def _auth_headers(provider: HMISProvider) -> dict[str, str]:
    if provider.auth_type == "bearer" and provider.client_secret:
        return {"Authorization": f"Bearer {provider.client_secret}"}
    if provider.auth_type == "api_key" and provider.api_key:
        return {"X-API-Key": provider.api_key}
    if provider.auth_type == "basic" and provider.username:
        raw = f"{provider.username}:{provider.password}".encode("utf-8")
        return {"Authorization": "Basic " + base64.b64encode(raw).decode("ascii")}
    return {}


# ── Journalled HTTP helper ──────────────────────────────────────────

def _journal(provider: HMISProvider, *, operation: str, direction: str = HMISTransaction.DIRECTION_OUT,
             method: str = "POST", url: str = "", request_body: dict | None = None,
             request_headers: dict | None = None, patient: Patient | None = None) -> HMISTransaction:
    return HMISTransaction.objects.create(
        provider=provider, operation=operation, direction=direction,
        method=method, url=url,
        request_body=request_body or {},
        request_headers={k: v for k, v in (request_headers or {}).items()
                         if k.lower() not in {"authorization", "x-api-key"}},
        patient=patient,
    )


def _http(method: str, url: str, *, headers: dict | None = None,
          body: dict | None = None, timeout: int = 20) -> tuple[int, dict]:
    data = None
    hdr = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdr["Content-Type"] = "application/json"
    if headers:
        hdr.update(headers)

    req = urllib.request.Request(url, data=data, method=method.upper(), headers=hdr)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8") or "{}"
            payload = json.loads(raw) if raw.startswith("{") or raw.startswith("[") else {"raw": raw}
            return resp.status, payload
    except urllib.error.HTTPError as e:
        body_txt = e.read().decode("utf-8", errors="ignore") if hasattr(e, "read") else ""
        try:
            payload = json.loads(body_txt) if body_txt else {}
        except json.JSONDecodeError:
            payload = {"raw": body_txt}
        raise HMISError(f"HTTP {e.code} from HMIS", status=e.code, body=payload)
    except urllib.error.URLError as e:
        raise HMISError(f"HMIS network error: {e.reason}")


def _call(provider: HMISProvider, *, operation: str, path: str,
          method: str = "POST", body: dict | None = None,
          patient: Patient | None = None) -> dict:
    """Execute a call against the provider (or return a mock) and journal it."""
    url = f"{provider.base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = _auth_headers(provider)
    tx = _journal(provider, operation=operation, method=method, url=url,
                  request_body=body, request_headers=headers, patient=patient)

    if mode() != "live":
        response = _mock_response(operation, body or {}, provider=provider, patient=patient)
        tx.response_status = 200
        tx.response_body = response
        tx.save(update_fields=["response_status", "response_body", "updated_at"])
        return response

    try:
        code, payload = _http(method, url, headers=headers, body=body)
        tx.response_status = code
        tx.response_body = payload
        tx.save(update_fields=["response_status", "response_body", "updated_at"])
        return payload
    except HMISError as e:
        tx.response_status = e.status or 0
        tx.response_body = e.body or {}
        tx.error = str(e)
        tx.save(update_fields=["response_status", "response_body", "error", "updated_at"])
        raise


# ── Mock response generator ─────────────────────────────────────────

def _mock_response(operation: str, body: dict, *, provider: HMISProvider,
                   patient: Patient | None = None) -> dict:
    """Hand-crafted fake responses that are realistic enough for UI/demo use."""
    now = timezone.now()
    if operation == "auth.token":
        return {
            "access_token": "mock-" + secrets.token_hex(12),
            "token_type": "Bearer",
            "expires_in": 3600,
        }
    if operation == "patient.lookup":
        mrn = body.get("mrn") or body.get("hmis_patient_id") or f"HMIS-{secrets.token_hex(3).upper()}"
        return {
            "hmis_patient_id": body.get("hmis_patient_id") or f"P{secrets.randbelow(10**8):08d}",
            "mrn": mrn,
            "full_name": body.get("full_name") or "Anonymous Patient",
            "phone": body.get("phone", ""),
            "date_of_birth": body.get("date_of_birth"),
            "gender": body.get("gender", ""),
            "preferred_language": body.get("preferred_language", "en"),
            "is_elderly": bool(body.get("is_elderly", False)),
            "is_disabled": bool(body.get("is_disabled", False)),
            "facility_id": provider.facility_id,
        }
    if operation == "patient.search":
        return {"results": []}
    if operation == "patient.register":
        return {
            "hmis_patient_id": f"P{secrets.randbelow(10**8):08d}",
            "mrn": body.get("mrn") or f"HMIS-{secrets.token_hex(3).upper()}",
            "created": True,
        }
    if operation == "appointment.list":
        return {
            "items": [
                {
                    "hmis_appointment_id": f"A{secrets.token_hex(4).upper()}",
                    "hmis_patient_id": f"P{secrets.randbelow(10**8):08d}",
                    "mrn": f"HMIS-{secrets.token_hex(3).upper()}",
                    "full_name": "Demo Patient",
                    "department_code": body.get("department_code") or "OPD",
                    "service_code": "CONSULT",
                    "doctor_name": "Dr. Demo",
                    "doctor_hmis_id": "D001",
                    "scheduled_at": (now + timedelta(minutes=15)).isoformat(),
                    "status": "scheduled",
                }
            ]
        }
    if operation == "encounter.push":
        return {
            "hmis_encounter_id": f"E{secrets.token_hex(4).upper()}",
            "acknowledged": True,
            "received_at": now.isoformat(),
        }
    if operation == "token.status":
        return {"acknowledged": True}
    return {"ok": True, "operation": operation, "echo": body}


# ── Public operations ────────────────────────────────────────────────

def lookup_patient(*, mrn: str = "", hmis_patient_id: str = "", phone: str = "",
                   provider: HMISProvider | str | int | None = None) -> dict:
    p = _resolve_provider(provider)
    return _call(p, operation="patient.lookup", path="patients/lookup",
                 body={"mrn": mrn, "hmis_patient_id": hmis_patient_id, "phone": phone})


def register_patient(*, payload: dict,
                     provider: HMISProvider | str | int | None = None,
                     patient: Patient | None = None) -> dict:
    p = _resolve_provider(provider)
    return _call(p, operation="patient.register", path="patients",
                 body=payload, patient=patient)


def list_appointments(*, department_code: str = "", date: str = "",
                      provider: HMISProvider | str | int | None = None) -> dict:
    p = _resolve_provider(provider)
    return _call(p, operation="appointment.list", path="appointments",
                 method="GET",
                 body={"department_code": department_code, "date": date})


def push_encounter(*, payload: dict, patient: Patient | None = None,
                   provider: HMISProvider | str | int | None = None) -> dict:
    p = _resolve_provider(provider)
    return _call(p, operation="encounter.push", path="encounters",
                 body=payload, patient=patient)


def push_token_status(*, token_number: str, status: str, extra: dict | None = None,
                      provider: HMISProvider | str | int | None = None) -> dict:
    """Send queue lifecycle updates back to HMIS (arrived / completed / no-show)."""
    p = _resolve_provider(provider)
    return _call(p, operation="token.status", path="queue/tokens",
                 body={"token": token_number, "status": status, **(extra or {})})


# ── Inbound webhook helpers ─────────────────────────────────────────

def verify_webhook_signature(provider: HMISProvider, *, raw_body: bytes,
                             signature: str) -> bool:
    """Validate an HMAC-SHA256 signature on an inbound webhook."""
    if not provider.webhook_secret or not signature:
        return mode() != "live"  # permissive only in mock mode
    expected = hmac.new(
        provider.webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature.replace("sha256=", ""))
