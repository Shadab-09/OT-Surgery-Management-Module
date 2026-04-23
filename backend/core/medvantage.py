"""Thin client for the MedVantage demo HMIS UHID lookup.

Endpoint:
    GET {MEDVANTAGE_UHID_URL}?UHID=<uhid>&ClientId=<client_id>

Used by the kiosk to pre-fill a patient's name, age, and gender at token-
generation time (FR-QMS-010 / "token auto-linked to patient UHID").

The client is intentionally dependency-free — it uses urllib so we don't pull
in ``requests`` just for one call. TLS verification is on by default; the demo
endpoint's certificate is self-signed, so operators can flip
``MEDVANTAGE_VERIFY_TLS=false`` in dev to tolerate that.
"""
from __future__ import annotations

import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from django.conf import settings

DEFAULT_URL = "https://demo.medvantage.tech:7082/api/PatientPersonalDashboard/GetPatientDetailsByUHID"
DEFAULT_CLIENT_ID = "176"


class UhidLookupError(RuntimeError):
    """Network / HTTP / payload failure while looking up a UHID."""


def _cfg(name: str, default: str) -> str:
    return getattr(settings, name, default)


def _ssl_context() -> ssl.SSLContext:
    verify = str(_cfg("MEDVANTAGE_VERIFY_TLS", "true")).lower() not in {"0", "false", "no"}
    ctx = ssl.create_default_context()
    if not verify:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def fetch_uhid(uhid: str, *, client_id: str | None = None, timeout: int = 8) -> dict[str, Any]:
    """Return the first patient record for a UHID — raises on any failure.

    Shape mirrors the upstream response's ``responseValue[0]``; see tests for
    expected keys (``patientName``, ``age``, ``gender``, ``dob``, …).
    """
    uhid = (uhid or "").strip()
    if not uhid:
        raise UhidLookupError("UHID is required.")

    url = _cfg("MEDVANTAGE_UHID_URL", DEFAULT_URL)
    cid = client_id or _cfg("MEDVANTAGE_CLIENT_ID", DEFAULT_CLIENT_ID)
    qs = urllib.parse.urlencode({"UHID": uhid, "ClientId": cid})
    full = f"{url}?{qs}"

    req = urllib.request.Request(full, method="GET", headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, context=_ssl_context(), timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        raise UhidLookupError(f"HTTP {e.code} from MedVantage.") from e
    except urllib.error.URLError as e:
        raise UhidLookupError(f"Cannot reach MedVantage: {e.reason}") from e
    except TimeoutError as e:
        raise UhidLookupError("MedVantage lookup timed out.") from e

    try:
        body = json.loads(raw)
    except json.JSONDecodeError as e:
        raise UhidLookupError(f"Invalid JSON from MedVantage: {e}") from e

    if body.get("status") != 1:
        raise UhidLookupError(body.get("message") or "Lookup failed.")
    records = body.get("responseValue") or []
    if not records:
        raise UhidLookupError(f"No patient found for UHID {uhid}.")
    return records[0]


# ── Normalisation ──────────────────────────────────────────────────
# The upstream payload is wide; the kiosk only needs identity + contact. We
# normalise to a stable shape so frontends aren't coupled to vendor keys.

_GENDER_MAP = {"male": "M", "female": "F", "m": "M", "f": "F", "other": "O"}


def normalise(record: dict[str, Any]) -> dict[str, Any]:
    """Return a kiosk-friendly subset of a MedVantage UHID record."""
    raw_gender = str(record.get("gender") or "").strip().lower()
    gender = _GENDER_MAP.get(raw_gender, "")
    age = record.get("age")
    try:
        age = int(age) if age is not None else None
    except (TypeError, ValueError):
        age = None
    return {
        "uhid": record.get("uhId") or "",
        "mrn": record.get("crNo") or record.get("uhId") or "",
        "full_name": record.get("patientName") or "",
        "age": age,
        "age_unit": record.get("agetype") or "Y",
        "dob": record.get("dob") or "",
        "gender": gender,
        "gender_text": record.get("gender") or "",
        "phone": record.get("mobileNo") or "",
        "email": record.get("emailID") or "",
        "address": record.get("address") or "",
        "city": record.get("city") or "",
        "state": record.get("state") or "",
        "department": record.get("department") or "",
        "patient_type": record.get("patientType") or "",
        "ward_name": record.get("wardName") or "",
        "bed_name": record.get("bedName") or "",
        "blood_group": record.get("bloodGroupName") or "",
    }
