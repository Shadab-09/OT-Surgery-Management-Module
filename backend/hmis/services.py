"""HMIS orchestration layer.

Viewsets never talk to the client directly — they call the functions here so
transaction boundaries, audit journal and local persistence stay in sync.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from django.db import transaction
from django.utils import timezone

from core.models import Patient, Department, Service
from queues.models import Token
from . import client as hmis_client
from .models import HMISProvider, HMISPatientLink, HMISAppointment, HMISEncounter


# ── Patient sync ─────────────────────────────────────────────────────

@transaction.atomic
def sync_patient_from_hmis(*, mrn: str = "", hmis_patient_id: str = "", phone: str = "",
                           provider: HMISProvider | str | int | None = None) -> Patient:
    """Pull a patient from HMIS, create/update the local Patient + link."""
    data = hmis_client.lookup_patient(
        mrn=mrn, hmis_patient_id=hmis_patient_id, phone=phone, provider=provider,
    )
    p = _coerce_provider(provider)

    patient_mrn = data.get("mrn") or mrn or f"HMIS-{data.get('hmis_patient_id', '?')}"
    defaults = {
        "full_name": data.get("full_name") or "Unknown",
        "phone": data.get("phone", ""),
        "is_elderly": bool(data.get("is_elderly", False)),
        "is_disabled": bool(data.get("is_disabled", False)),
        "preferred_language": data.get("preferred_language") or "en",
    }
    dob = data.get("date_of_birth")
    if dob and isinstance(dob, str):
        try:
            defaults["date_of_birth"] = datetime.fromisoformat(dob).date()
        except ValueError:
            pass
    if data.get("gender"):
        defaults["gender"] = data["gender"][:1].upper()

    patient, _ = Patient.objects.update_or_create(mrn=patient_mrn, defaults=defaults)

    HMISPatientLink.objects.update_or_create(
        provider=p, hmis_patient_id=data.get("hmis_patient_id") or patient_mrn,
        defaults={
            "patient": patient,
            "hmis_mrn": patient_mrn,
            "payload": data,
            "last_synced_at": timezone.now(),
        },
    )
    return patient


@transaction.atomic
def push_patient_to_hmis(patient: Patient, *,
                        provider: HMISProvider | str | int | None = None) -> HMISPatientLink:
    """Create a patient in the HMIS for locally registered patients.

    Used when kiosk check-in registers a walk-in patient that the HMIS has
    never seen before.
    """
    p = _coerce_provider(provider)
    payload = {
        "mrn": patient.mrn,
        "full_name": patient.full_name,
        "phone": patient.phone,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "gender": patient.gender,
        "preferred_language": patient.preferred_language,
        "is_elderly": patient.is_elderly,
        "is_disabled": patient.is_disabled,
    }
    resp = hmis_client.register_patient(payload=payload, provider=p, patient=patient)
    link, _ = HMISPatientLink.objects.update_or_create(
        provider=p, hmis_patient_id=resp.get("hmis_patient_id") or patient.mrn,
        defaults={
            "patient": patient,
            "hmis_mrn": resp.get("mrn") or patient.mrn,
            "payload": resp,
            "last_synced_at": timezone.now(),
        },
    )
    return link


# ── Appointment sync ─────────────────────────────────────────────────

@transaction.atomic
def pull_appointments(*, department_code: str = "", date: str = "",
                       provider: HMISProvider | str | int | None = None) -> list[HMISAppointment]:
    """Pull today's scheduled HMIS appointments and store them locally.

    Appointments become the seed for pre-issued queue tokens on arrival.
    """
    p = _coerce_provider(provider)
    data = hmis_client.list_appointments(
        department_code=department_code, date=date, provider=p,
    )
    stored: list[HMISAppointment] = []
    for item in data.get("items", []):
        patient = _ensure_patient(item, provider=p)
        scheduled_at_raw = item.get("scheduled_at")
        try:
            scheduled_at = datetime.fromisoformat(scheduled_at_raw) if scheduled_at_raw else timezone.now()
        except ValueError:
            scheduled_at = timezone.now()
        appt, _ = HMISAppointment.objects.update_or_create(
            provider=p, hmis_appointment_id=item["hmis_appointment_id"],
            defaults={
                "patient": patient,
                "department_code": item.get("department_code", ""),
                "service_code": item.get("service_code", ""),
                "doctor_name": item.get("doctor_name", ""),
                "doctor_hmis_id": item.get("doctor_hmis_id", ""),
                "scheduled_at": scheduled_at,
                "status": item.get("status", HMISAppointment.STATUS_SCHEDULED),
                "raw": item,
                "last_synced_at": timezone.now(),
            },
        )
        stored.append(appt)
    return stored


@transaction.atomic
def issue_token_from_appointment(appointment: HMISAppointment, *,
                                  channel: str = Token.CHANNEL_COUNTER,
                                  actor=None) -> Token:
    """Check in a scheduled HMIS appointment — issues a queue token and flips
    the appointment status to ``checked_in``.
    """
    from queues import services as queue_services  # local import to avoid cycle

    department = Department.objects.filter(code=appointment.department_code).first()
    if not department:
        raise ValueError(
            f"Department '{appointment.department_code}' is not configured locally."
        )
    service = Service.objects.filter(
        department=department, code=appointment.service_code,
    ).first() or department.services.filter(is_active=True).first()
    if not service:
        raise ValueError(f"No service configured for department '{department.code}'.")

    priority = Token.PRIORITY_NORMAL
    if appointment.patient:
        if appointment.patient.is_disabled:
            priority = Token.PRIORITY_DISABLED
        elif appointment.patient.is_elderly:
            priority = Token.PRIORITY_ELDERLY

    token = queue_services.issue_token(
        department=department,
        service=service,
        patient=appointment.patient,
        channel=channel,
        priority=priority,
        actor=actor,
        notes=f"HMIS appointment {appointment.hmis_appointment_id}",
    )
    appointment.status = HMISAppointment.STATUS_CHECKED_IN
    appointment.token = token
    appointment.save(update_fields=["status", "token", "updated_at"])

    # Best-effort: notify HMIS that the patient has arrived. Failures here
    # don't roll back the local token issuance.
    try:
        hmis_client.push_token_status(
            token_number=token.number, status="checked_in",
            extra={"appointment_id": appointment.hmis_appointment_id},
            provider=appointment.provider,
        )
    except hmis_client.HMISError:
        pass
    return token


# ── Encounter push ───────────────────────────────────────────────────

@transaction.atomic
def push_token_encounter(token: Token, *,
                         provider: HMISProvider | str | int | None = None,
                         extra: dict | None = None) -> HMISEncounter:
    """When a visit closes, build a minimal encounter and ship it to HMIS."""
    p = _coerce_provider(provider)
    payload = {
        "facility_id": p.facility_id,
        "token_number": token.number,
        "department_code": token.department.code,
        "service_code": token.service.code,
        "patient": {
            "mrn": token.patient.mrn if token.patient else None,
            "full_name": token.patient.full_name if token.patient else None,
        } if token.patient else None,
        "channel": token.channel,
        "priority": token.priority,
        "status": token.status,
        "issued_at": token.issued_at.isoformat() if token.issued_at else None,
        "completed_at": token.completed_at.isoformat() if token.completed_at else None,
        "tat_seconds": token.tat_seconds,
        "notes": token.notes,
    }
    if extra:
        payload.update(extra)

    enc = HMISEncounter.objects.create(
        provider=p, patient=token.patient, token=token, payload=payload,
        status=HMISEncounter.STATUS_PENDING,
    )
    if not token.patient:
        enc.status = HMISEncounter.STATUS_FAILED
        enc.error = "Token has no linked patient."
        enc.save(update_fields=["status", "error", "updated_at"])
        return enc

    try:
        resp = hmis_client.push_encounter(
            payload=payload, patient=token.patient, provider=p,
        )
        enc.response = resp
        enc.hmis_encounter_id = resp.get("hmis_encounter_id", "")
        enc.status = (
            HMISEncounter.STATUS_ACKED if resp.get("acknowledged")
            else HMISEncounter.STATUS_SENT
        )
        enc.sent_at = timezone.now()
        enc.acked_at = timezone.now() if resp.get("acknowledged") else None
        enc.save(update_fields=[
            "response", "hmis_encounter_id", "status",
            "sent_at", "acked_at", "updated_at",
        ])
    except hmis_client.HMISError as e:
        enc.status = HMISEncounter.STATUS_FAILED
        enc.error = str(e)
        enc.response = e.body or {}
        enc.save(update_fields=["status", "error", "response", "updated_at"])
    return enc


# ── Inbound webhook processing ──────────────────────────────────────

@transaction.atomic
def apply_webhook(provider: HMISProvider, *, event: str, data: dict) -> dict:
    """Handle an HMIS-originated event (appointment cancelled, patient updated…).

    Returns a dict summarising what we did — viewsets return this to the HMIS
    so operators can see in their logs whether the event was applied.
    """
    summary: dict[str, Any] = {"event": event, "applied": False}

    if event in {"patient.updated", "patient.created"}:
        patient = sync_patient_from_hmis(
            mrn=data.get("mrn", ""),
            hmis_patient_id=data.get("hmis_patient_id", ""),
            provider=provider,
        )
        summary.update(applied=True, patient_id=patient.id)

    elif event == "appointment.cancelled":
        appt = HMISAppointment.objects.filter(
            provider=provider, hmis_appointment_id=data.get("hmis_appointment_id", ""),
        ).first()
        if appt:
            appt.status = HMISAppointment.STATUS_CANCELLED
            appt.save(update_fields=["status", "updated_at"])
            if appt.token_id:
                from queues import services as queue_services
                try:
                    queue_services.cancel_token(appt.token, reason="HMIS cancelled appointment")
                except ValueError:
                    pass
            summary.update(applied=True, appointment_id=appt.id)

    elif event in {"appointment.created", "appointment.updated"}:
        pull_appointments(
            department_code=data.get("department_code", ""),
            provider=provider,
        )
        summary.update(applied=True)

    return summary


# ── Internal helpers ─────────────────────────────────────────────────

def _coerce_provider(provider: HMISProvider | str | int | None) -> HMISProvider:
    if isinstance(provider, HMISProvider):
        return provider
    if isinstance(provider, int):
        return HMISProvider.objects.get(pk=provider)
    if isinstance(provider, str):
        return HMISProvider.objects.get(code=provider)
    first = HMISProvider.objects.filter(is_active=True, is_primary=True).first() \
        or HMISProvider.objects.filter(is_active=True).first()
    if not first:
        raise ValueError("No active HMIS provider configured.")
    return first


def _ensure_patient(item: dict, *, provider: HMISProvider) -> Patient | None:
    """Best-effort resolve of the patient associated with an HMIS record."""
    hmis_patient_id = item.get("hmis_patient_id", "")
    mrn = item.get("mrn", "")
    if hmis_patient_id:
        link = HMISPatientLink.objects.filter(
            provider=provider, hmis_patient_id=hmis_patient_id,
        ).select_related("patient").first()
        if link:
            return link.patient
    if mrn:
        patient = Patient.objects.filter(mrn=mrn).first()
        if patient:
            HMISPatientLink.objects.update_or_create(
                provider=provider, hmis_patient_id=hmis_patient_id or mrn,
                defaults={"patient": patient, "hmis_mrn": mrn, "last_synced_at": timezone.now()},
            )
            return patient
    if not mrn and not hmis_patient_id:
        return None
    # Fall through to HMIS lookup to materialise the patient.
    try:
        return sync_patient_from_hmis(
            mrn=mrn, hmis_patient_id=hmis_patient_id, provider=provider,
        )
    except hmis_client.HMISError:
        return None
