"""ABDM service layer — orchestrates Eka Care calls + local persistence.

All viewsets call into functions here. This keeps transaction boundaries,
audit-logging and side-effects in a single place.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from django.db import transaction
from django.utils import timezone

from core.models import Patient
from .models import ABHAProfile, CareContext, HealthRecordLink, ConsentRequest
from . import eka_client as eka
from .fhir import build_op_consult_bundle


# ── Aadhaar flow ─────────────────────────────────────────────────────

def start_aadhaar_enrolment(patient: Patient, *, aadhaar: str) -> dict:
    return eka.request_aadhaar_otp(aadhaar, patient=patient)


@transaction.atomic
def complete_aadhaar_enrolment(patient: Patient, *, txn_id: str, otp: str,
                               mobile: str = "", preferred_abha_address: str = "") -> ABHAProfile:
    """Verify the Aadhaar OTP, then persist/update the patient's ABHAProfile."""
    data = eka.verify_aadhaar_otp(txn_id=txn_id, otp=otp, mobile=mobile, patient=patient)
    abha_address = preferred_abha_address or data.get("abha_address") or ""
    dob = data.get("date_of_birth")
    if dob and isinstance(dob, str):
        try:
            dob = datetime.fromisoformat(dob).date()
        except ValueError:
            dob = None

    profile, _created = ABHAProfile.objects.update_or_create(
        patient=patient,
        defaults={
            "abha_number": data["abha_number"],
            "abha_address": abha_address,
            "first_name": data.get("first_name", ""),
            "middle_name": data.get("middle_name", ""),
            "last_name": data.get("last_name", ""),
            "mobile": data.get("mobile") or mobile or patient.phone,
            "gender": data.get("gender", "") or patient.gender or "",
            "date_of_birth": dob or patient.date_of_birth,
            "kyc_verified": bool(data.get("kyc_verified", True)),
            "kyc_method": data.get("kyc_method", "aadhaar"),
            "x_token": data.get("x_token", ""),
            "x_token_expires_at": (
                timezone.now() + timedelta(seconds=int(data.get("expires_in") or 1800))
                if data.get("x_token") else None
            ),
            "eka_care_user_id": data.get("eka_care_user_id", ""),
            "linked_at": timezone.now(),
        },
    )
    return profile


# ── Mobile flow ──────────────────────────────────────────────────────

def start_mobile_login(patient: Patient, *, mobile: str) -> dict:
    return eka.request_mobile_otp(mobile, patient=patient)


def complete_mobile_login(patient: Patient, *, txn_id: str, otp: str) -> dict:
    return eka.verify_mobile_otp(txn_id=txn_id, otp=otp, patient=patient)


# ── Profile & card ───────────────────────────────────────────────────

def refresh_profile(profile: ABHAProfile) -> ABHAProfile:
    data = eka.fetch_profile(profile.abha_address, patient=profile.patient)
    for attr, key in [
        ("first_name", "first_name"), ("middle_name", "middle_name"),
        ("last_name", "last_name"), ("mobile", "mobile"), ("email", "email"),
        ("gender", "gender"),
    ]:
        if data.get(key):
            setattr(profile, attr, data[key])
    profile.save()
    return profile


def get_abha_card(profile: ABHAProfile) -> dict:
    return eka.download_abha_card(profile.abha_address, patient=profile.patient)


# ── Care context + HIP share ─────────────────────────────────────────

@transaction.atomic
def push_visit_to_abdm(visit) -> HealthRecordLink:
    """Build a FHIR bundle for a closed visit and ship it to Eka Care.

    1. Build the FHIR bundle.
    2. Ensure/announce a CareContext at the ABDM gateway.
    3. Notify HIP (data-push) and record the result in `HealthRecordLink`.
    """
    abha = getattr(visit.patient, "abha", None)
    bundle = build_op_consult_bundle(visit)

    hr = HealthRecordLink.objects.create(
        care_context=None,
        patient=visit.patient,
        visit_id=visit.id,
        record_type="OPConsultation",
        fhir_bundle=bundle,
        status=HealthRecordLink.STATUS_PENDING,
    )

    if not abha:
        hr.status = HealthRecordLink.STATUS_FAILED
        hr.error = "Patient has no linked ABHA profile."
        hr.save(update_fields=["status", "error", "updated_at"])
        return hr

    # 1) Announce the care context
    cc, _created = CareContext.objects.get_or_create(
        abha=abha, reference=visit.visit_number,
        defaults={
            "display": f"OP Consultation · {visit.opened_at:%d %b %Y}",
            "hi_types": ["OPConsultation"],
        },
    )
    if not cc.linked_at:
        try:
            link_resp = eka.link_care_context(
                abha, reference=cc.reference, display=cc.display, hi_types=cc.hi_types,
            )
            cc.linked_at = timezone.now()
            cc.eka_context_id = link_resp.get("eka_context_id", "")
            cc.save(update_fields=["linked_at", "eka_context_id", "updated_at"])
        except eka.EkaCareError as e:
            hr.status = HealthRecordLink.STATUS_FAILED
            hr.error = f"care-context link failed: {e}"
            hr.care_context = cc
            hr.save(update_fields=["status", "error", "care_context", "updated_at"])
            return hr

    hr.care_context = cc
    hr.save(update_fields=["care_context", "updated_at"])

    # 2) Ship the bundle
    try:
        share_resp = eka.share_fhir_bundle(
            abha, care_context_ref=cc.reference,
            record_type="OPConsultation", fhir_bundle=bundle,
        )
        hr.status = HealthRecordLink.STATUS_ACKED if share_resp.get("acknowledged") else HealthRecordLink.STATUS_SENT
        hr.eka_request_id = share_resp.get("hi_request_id", "")
        hr.eka_response = share_resp
        hr.sent_at = timezone.now()
        hr.acked_at = timezone.now() if share_resp.get("acknowledged") else None
        hr.save(update_fields=[
            "status", "eka_request_id", "eka_response",
            "sent_at", "acked_at", "updated_at",
        ])
        visit.abdm_care_context_ref = cc.reference
        visit.abdm_synced_at = timezone.now()
        visit.save(update_fields=["abdm_care_context_ref", "abdm_synced_at", "updated_at"])
    except eka.EkaCareError as e:
        hr.status = HealthRecordLink.STATUS_FAILED
        hr.error = str(e)
        hr.save(update_fields=["status", "error", "updated_at"])

    return hr


# ── Consent ──────────────────────────────────────────────────────────

@transaction.atomic
def request_patient_consent(patient: Patient, *, abha_address: str, purpose: str,
                             hi_types: list[str], days_valid: int = 30) -> ConsentRequest:
    now = timezone.now()
    date_from = now - timedelta(days=365)
    date_to = now
    expires_at = now + timedelta(days=days_valid)

    resp = eka.request_consent(
        abha_address=abha_address, purpose=purpose, hi_types=hi_types,
        date_from=date_from, date_to=date_to, expires_at=expires_at,
        patient=patient,
    )
    cr = ConsentRequest.objects.create(
        patient=patient, purpose=purpose, hi_types=hi_types,
        date_from=date_from, date_to=date_to, expires_at=expires_at,
        status=ConsentRequest.STATUS_REQUESTED,
        consent_request_id=resp.get("consent_request_id", ""),
    )
    return cr
