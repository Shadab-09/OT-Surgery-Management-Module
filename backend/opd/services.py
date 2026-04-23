"""OPD business logic — appointment lifecycle, visit generation, slot planning.

All state transitions go through these functions. Viewsets call them; they never
mutate models directly. Mirrors the pattern used in `queues.services`.
"""
from datetime import date, datetime, timedelta, time
from django.db import transaction
from django.utils import timezone

from core.models import Patient, Department, Service
from queues import services as queue_services
from queues.models import Token

from .models import (
    Doctor, DoctorSchedule, Appointment, Visit,
    Prescription, PrescriptionItem,
)


# ── Slot generation ─────────────────────────────────────────────

def generate_slots(doctor: Doctor, on: date) -> list[dict]:
    """Return free & booked slots for a doctor on a given date.

    Each entry: { "start": iso, "end": iso, "available": bool, "appointment_id": int|None }.
    """
    weekday = on.weekday()
    schedules = doctor.schedules.filter(weekday=weekday, is_active=True)
    if not schedules.exists():
        return []

    tz = timezone.get_current_timezone()
    day_start = datetime.combine(on, time.min, tzinfo=tz)
    day_end = datetime.combine(on, time.max, tzinfo=tz)
    booked = {
        a.scheduled_at.replace(second=0, microsecond=0): a
        for a in doctor.appointments.filter(
            scheduled_at__range=(day_start, day_end),
            status__in=[
                Appointment.STATUS_SCHEDULED,
                Appointment.STATUS_CHECKED_IN,
                Appointment.STATUS_IN_CONSULTATION,
            ],
        )
    }

    slots = []
    for sched in schedules:
        cursor = datetime.combine(on, sched.start_time, tzinfo=tz)
        end = datetime.combine(on, sched.end_time, tzinfo=tz)
        step = timedelta(minutes=sched.slot_minutes)
        while cursor + step <= end:
            key = cursor.replace(second=0, microsecond=0)
            appt = booked.get(key)
            slots.append({
                "start": cursor.isoformat(),
                "end": (cursor + step).isoformat(),
                "available": appt is None,
                "appointment_id": appt.id if appt else None,
                "room": sched.room,
            })
            cursor += step
    return slots


# ── Appointments ─────────────────────────────────────────────

@transaction.atomic
def book_appointment(
    *, patient: Patient, doctor: Doctor, scheduled_at, reason: str = "",
    appointment_type: str = Appointment.TYPE_NEW, booked_via: str = "counter",
) -> Appointment:
    """Create an appointment; fails if the slot clashes."""
    clash = Appointment.objects.filter(
        doctor=doctor, scheduled_at=scheduled_at,
        status__in=[
            Appointment.STATUS_SCHEDULED,
            Appointment.STATUS_CHECKED_IN,
            Appointment.STATUS_IN_CONSULTATION,
        ],
    ).exists()
    if clash:
        raise ValueError("That slot is already booked.")
    return Appointment.objects.create(
        patient=patient, doctor=doctor, department=doctor.department,
        scheduled_at=scheduled_at,
        slot_minutes=doctor.avg_consult_minutes,
        type=appointment_type, reason=reason, booked_via=booked_via,
    )


@transaction.atomic
def check_in_appointment(appointment: Appointment, *, actor=None) -> Appointment:
    """Patient has arrived — issue a queue token and link it to the appointment.

    Picks the department's first 'Consultation' service if present, else any service.
    """
    if appointment.status != Appointment.STATUS_SCHEDULED:
        raise ValueError(f"Cannot check in appointment in status '{appointment.status}'.")
    dept = appointment.department
    svc = (
        Service.objects.filter(department=dept, code__iexact="CONS").first()
        or Service.objects.filter(department=dept, is_active=True).first()
    )
    if not svc:
        raise ValueError("No service configured for this department — cannot issue a token.")

    token = queue_services.issue_token(
        department=dept, service=svc,
        patient=appointment.patient, channel=Token.CHANNEL_COUNTER,
        actor=actor, notes=f"Appointment #{appointment.id}",
    )
    appointment.status = Appointment.STATUS_CHECKED_IN
    appointment.checked_in_at = timezone.now()
    appointment.token_id = token.id
    appointment.save(update_fields=["status", "checked_in_at", "token_id", "updated_at"])
    return appointment


@transaction.atomic
def cancel_appointment(appointment: Appointment, *, reason: str = "") -> Appointment:
    if appointment.status in {Appointment.STATUS_COMPLETED, Appointment.STATUS_CANCELLED}:
        raise ValueError(f"Cannot cancel appointment in status '{appointment.status}'.")
    appointment.status = Appointment.STATUS_CANCELLED
    appointment.save(update_fields=["status", "updated_at"])
    return appointment


# ── Visits ─────────────────────────────────────────────

def _next_visit_number() -> str:
    today = timezone.localdate()
    prefix = f"OPD-V-{today:%Y%m%d}"
    count = Visit.objects.filter(visit_number__startswith=prefix).count() + 1
    return f"{prefix}-{count:04d}"


@transaction.atomic
def start_visit(*, appointment: Appointment | None = None, patient: Patient = None,
                doctor: Doctor = None, department: Department = None) -> Visit:
    """Open a clinical visit. If an appointment is given, its status becomes 'in_consultation'."""
    if appointment:
        patient = appointment.patient
        doctor = doctor or appointment.doctor
        department = department or appointment.department
    if not (patient and doctor and department):
        raise ValueError("patient, doctor and department are required (or pass an appointment).")

    visit = Visit.objects.create(
        patient=patient, doctor=doctor, department=department,
        appointment=appointment, visit_number=_next_visit_number(),
    )
    if appointment:
        appointment.status = Appointment.STATUS_IN_CONSULTATION
        appointment.save(update_fields=["status", "updated_at"])
    return visit


@transaction.atomic
def close_visit(visit: Visit, *, push_to_abdm: bool = True) -> Visit:
    """Close the visit and (optionally) dispatch to ABDM as a FHIR bundle."""
    if visit.status == Visit.STATUS_CLOSED:
        return visit
    visit.status = Visit.STATUS_CLOSED
    visit.closed_at = timezone.now()
    visit.save(update_fields=["status", "closed_at", "updated_at"])

    if visit.appointment_id:
        appt = visit.appointment
        appt.status = Appointment.STATUS_COMPLETED
        appt.save(update_fields=["status", "updated_at"])

    if push_to_abdm:
        # late import — the abdm app depends on opd, and vice-versa at the
        # service layer only. Keeping imports lazy avoids a circular import.
        try:
            from abdm.services import push_visit_to_abdm
            push_visit_to_abdm(visit)
        except Exception:  # pragma: no cover  — ABDM is best-effort on close
            pass
    return visit


# ── Prescription helpers ─────────────────────────────────────────────

@transaction.atomic
def upsert_prescription(visit: Visit, *, notes: str = "", items: list[dict] | None = None) -> Prescription:
    """Create/update the prescription for a visit and replace its items."""
    rx, _ = Prescription.objects.update_or_create(
        visit=visit, defaults={"notes": notes},
    )
    if items is not None:
        rx.items.all().delete()
        PrescriptionItem.objects.bulk_create([
            PrescriptionItem(prescription=rx, **item) for item in items
        ])
    return rx
