"""OT business logic — booking lifecycle, conflict detection, billing calculation.

All state transitions go through these functions. ViewSets call them.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .models import (
    OTRoom,
    OTBooking,
    SurgicalTeamMember,
    SurgicalSafetyChecklist,
    IntraoperativeRecord,
    ImplantLog,
    BloodProductUsed,
    OTBill,
    OTInventoryItem,
)


# ---------------------------------------------------------------------------
# Booking number generation
# ---------------------------------------------------------------------------

def generate_booking_number() -> str:
    """Generate a unique booking number in the format OT-YYYYMMDD-NNN.

    Queries today's booking count and zero-pads to 3 digits.  Retries
    (up to 10 times) on the unlikely event of a collision.
    """
    today = timezone.localdate()
    prefix = f"OT-{today:%Y%m%d}-"

    for attempt in range(10):
        count = OTBooking.objects.filter(booking_number__startswith=prefix).count()
        candidate = f"{prefix}{count + 1:03d}"
        if not OTBooking.objects.filter(booking_number=candidate).exists():
            return candidate
        # Increment past any gap that might exist from deletions
    # Fallback: use microsecond timestamp suffix to guarantee uniqueness
    return f"OT-{today:%Y%m%d}-{timezone.now().strftime('%H%M%S%f')[:9]}"


# ---------------------------------------------------------------------------
# Conflict detection
# ---------------------------------------------------------------------------

def check_room_conflict(
    room: OTRoom,
    scheduled_date: date,
    scheduled_start,
    scheduled_end,
    exclude_booking_id: int | None = None,
) -> bool:
    """Return True if a conflicting booking already exists for this room/time.

    A conflict exists when two bookings overlap:
        start1 < end2  AND  start2 < end1

    Bookings with status 'cancelled' or 'postponed' are ignored.
    The booking identified by *exclude_booking_id* (e.g. the one being edited)
    is also excluded.
    """
    qs = OTBooking.objects.filter(
        room=room,
        scheduled_date=scheduled_date,
    ).exclude(status__in=["cancelled", "postponed"])

    if exclude_booking_id is not None:
        qs = qs.exclude(pk=exclude_booking_id)

    # Time-range overlap: start1 < end2  AND  start2 < end1
    return qs.filter(
        scheduled_start__lt=scheduled_end,
        scheduled_end__gt=scheduled_start,
    ).exists()


# ---------------------------------------------------------------------------
# Create / update bookings
# ---------------------------------------------------------------------------

@transaction.atomic
def create_booking(
    *,
    room: OTRoom,
    patient,
    surgery_name: str,
    surgery_category: str,
    priority: str,
    scheduled_date: date,
    scheduled_start,
    scheduled_end,
    primary_surgeon: SurgicalTeamMember,
    diagnosis: str,
    planned_procedure: str,
    booked_by=None,
    **kwargs,
) -> OTBooking:
    """Create an OTBooking after checking for room conflicts.

    Raises ValueError if the room is already booked for an overlapping window.
    All additional keyword arguments are forwarded to OTBooking.objects.create().
    """
    if check_room_conflict(room, scheduled_date, scheduled_start, scheduled_end):
        # Find the conflicting booking to surface a helpful message
        conflict = (
            OTBooking.objects.filter(
                room=room,
                scheduled_date=scheduled_date,
            )
            .exclude(status__in=["cancelled", "postponed"])
            .filter(
                scheduled_start__lt=scheduled_end,
                scheduled_end__gt=scheduled_start,
            )
            .first()
        )
        if conflict:
            raise ValueError(
                f"OT room '{room.name}' is already booked from "
                f"{conflict.scheduled_start} to {conflict.scheduled_end} "
                f"on {scheduled_date}."
            )
        raise ValueError(f"OT room '{room.name}' is already booked at the requested time on {scheduled_date}.")

    booking_number = generate_booking_number()

    booking = OTBooking.objects.create(
        booking_number=booking_number,
        room=room,
        patient=patient,
        surgery_name=surgery_name,
        surgery_category=surgery_category,
        priority=priority,
        scheduled_date=scheduled_date,
        scheduled_start=scheduled_start,
        scheduled_end=scheduled_end,
        primary_surgeon=primary_surgeon,
        diagnosis=diagnosis,
        planned_procedure=planned_procedure,
        booked_by=booked_by,
        **kwargs,
    )
    return booking


@transaction.atomic
def update_booking_schedule(
    booking: OTBooking,
    room: OTRoom,
    scheduled_date: date,
    scheduled_start,
    scheduled_end,
) -> OTBooking:
    """Reschedule an existing booking.  Raises ValueError on conflict."""
    if check_room_conflict(
        room, scheduled_date, scheduled_start, scheduled_end,
        exclude_booking_id=booking.pk,
    ):
        conflict = (
            OTBooking.objects.filter(
                room=room,
                scheduled_date=scheduled_date,
            )
            .exclude(status__in=["cancelled", "postponed"])
            .exclude(pk=booking.pk)
            .filter(
                scheduled_start__lt=scheduled_end,
                scheduled_end__gt=scheduled_start,
            )
            .first()
        )
        if conflict:
            raise ValueError(
                f"OT room '{room.name}' is already booked from "
                f"{conflict.scheduled_start} to {conflict.scheduled_end} "
                f"on {scheduled_date}."
            )
        raise ValueError(f"OT room '{room.name}' is already booked at the requested time on {scheduled_date}.")

    booking.room = room
    booking.scheduled_date = scheduled_date
    booking.scheduled_start = scheduled_start
    booking.scheduled_end = scheduled_end
    booking.save()
    return booking


# ---------------------------------------------------------------------------
# Booking status transitions
# ---------------------------------------------------------------------------

@transaction.atomic
def cancel_booking(booking: OTBooking, reason: str = "") -> OTBooking:
    """Cancel a booking and record the reason."""
    booking.status = "cancelled"
    booking.cancellation_reason = reason
    booking.save()
    return booking


@transaction.atomic
def postpone_booking(
    booking: OTBooking,
    new_date: date,
    new_start,
    new_end,
    reason: str = "",
) -> OTBooking:
    """Postpone a booking to a new date/time.  Raises ValueError on conflict."""
    if check_room_conflict(
        booking.room, new_date, new_start, new_end,
        exclude_booking_id=booking.pk,
    ):
        conflict = (
            OTBooking.objects.filter(
                room=booking.room,
                scheduled_date=new_date,
            )
            .exclude(status__in=["cancelled", "postponed"])
            .exclude(pk=booking.pk)
            .filter(
                scheduled_start__lt=new_end,
                scheduled_end__gt=new_start,
            )
            .first()
        )
        if conflict:
            raise ValueError(
                f"OT room '{booking.room.name}' is already booked from "
                f"{conflict.scheduled_start} to {conflict.scheduled_end} "
                f"on {new_date}."
            )
        raise ValueError(
            f"OT room '{booking.room.name}' is already booked at the requested time on {new_date}."
        )

    booking.status = "postponed"
    booking.scheduled_date = new_date
    booking.scheduled_start = new_start
    booking.scheduled_end = new_end
    booking.cancellation_reason = reason
    booking.save()
    return booking


@transaction.atomic
def start_surgery(booking: OTBooking) -> OTBooking:
    """Transition booking to in_progress and mark the OT room as occupied.

    Also creates an IntraoperativeRecord if one does not already exist.
    Raises ValueError if the booking is not in a startable state.
    """
    startable = {"scheduled", "confirmed", "prep"}
    if booking.status not in startable:
        raise ValueError(
            f"Cannot start surgery for a booking in status '{booking.status}'. "
            f"Expected one of: {', '.join(sorted(startable))}."
        )

    booking.status = "in_progress"
    booking.actual_start = timezone.now()
    booking.save()

    room = booking.room
    room.status = "occupied"
    room.save()

    # Create the intraoperative record shell if it doesn't exist yet
    IntraoperativeRecord.objects.get_or_create(booking=booking)

    return booking


@transaction.atomic
def complete_surgery(booking: OTBooking) -> OTBooking:
    """Transition booking to completed, free the OT room, and draft the bill.

    Raises ValueError if booking is not currently in_progress.
    """
    if booking.status != "in_progress":
        raise ValueError(
            f"Cannot complete surgery for a booking in status '{booking.status}'. "
            "Expected status: 'in_progress'."
        )

    booking.status = "completed"
    booking.actual_end = timezone.now()
    booking.save()

    room = booking.room
    room.status = "available"
    room.save()

    # Auto-draft or refresh OT bill
    calculate_ot_bill(booking)

    return booking


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------

def calculate_ot_bill(booking: OTBooking) -> OTBill:
    """Calculate charges for a completed booking and persist an OTBill.

    Charge rules
    ------------
    ot_charges       : actual duration in minutes × ₹50 (minimum 120 min / 2 h)
    implant_charges  : Σ(unit_cost × quantity) across all ImplantLog rows
    blood_product_charges:
                       PRBC / FFP / Platelets → ₹1500/unit
                       All others              → ₹500/unit
    All other charge fields are preserved if they already exist on the bill.
    """
    bill, _ = OTBill.objects.get_or_create(booking=booking)

    # OT charges — based on actual duration or scheduled duration
    if booking.actual_start and booking.actual_end:
        duration_minutes = int(
            (booking.actual_end - booking.actual_start).total_seconds() / 60
        )
    else:
        # Fall back to scheduled window if surgery hasn't ended yet
        scheduled_start_dt = datetime.combine(booking.scheduled_date, booking.scheduled_start)
        scheduled_end_dt = datetime.combine(booking.scheduled_date, booking.scheduled_end)
        duration_minutes = int((scheduled_end_dt - scheduled_start_dt).total_seconds() / 60)

    billable_minutes = max(duration_minutes, 120)  # minimum 2 hours
    bill.ot_charges = Decimal(billable_minutes) * Decimal("50.00")

    # Implant charges
    implant_total = Decimal("0")
    for implant in ImplantLog.objects.filter(booking=booking):
        implant_total += Decimal(str(implant.unit_cost)) * implant.quantity
    bill.implant_charges = implant_total

    # Blood product charges (requires access to IntraoperativeRecord)
    try:
        intraop = booking.intraop_record
        bp_total = Decimal("0")
        premium_types = {"prbc", "ffp", "platelets"}
        for bp in intraop.blood_products.all():
            rate = Decimal("1500") if bp.product_type in premium_types else Decimal("500")
            bp_total += rate * bp.units
        bill.blood_product_charges = bp_total
    except IntraoperativeRecord.DoesNotExist:
        pass  # leave existing value intact

    bill.calculate_and_save_total()
    return bill


# ---------------------------------------------------------------------------
# Schedule helpers
# ---------------------------------------------------------------------------

def get_daily_ot_schedule(scheduled_date: date):
    """Return all bookings for a given date, ordered by room then start time."""
    return (
        OTBooking.objects
        .filter(scheduled_date=scheduled_date)
        .select_related(
            "patient",
            "room",
            "primary_surgeon",
            "primary_surgeon__user",
        )
        .order_by("room__room_number", "scheduled_start")
    )


def get_ot_dashboard_stats() -> dict:
    """Aggregate today's OT activity into a dashboard-ready dictionary."""
    today = timezone.localdate()

    today_qs = OTBooking.objects.filter(scheduled_date=today)

    # Fetch items where quantity_in_stock <= reorder_level using a DB-level filter
    low_inventory_qs = OTInventoryItem.objects.filter(is_active=True).extra(
        where=["quantity_in_stock <= reorder_level"]
    )

    return {
        "today_total": today_qs.count(),
        "today_completed": today_qs.filter(status="completed").count(),
        "today_in_progress": today_qs.filter(status="in_progress").count(),
        "today_elective": today_qs.filter(priority="elective").count(),
        "today_emergency": today_qs.filter(priority="emergency").count(),
        "rooms_available": OTRoom.objects.filter(status="available").count(),
        "rooms_occupied": OTRoom.objects.filter(status="occupied").count(),
        "pending_checklists": SurgicalSafetyChecklist.objects.filter(
            completed=False,
            booking__status="in_progress",
        ).count(),
        "low_inventory": [
            {
                "id": item.id,
                "name": item.name,
                "quantity_in_stock": item.quantity_in_stock,
                "reorder_level": item.reorder_level,
            }
            for item in low_inventory_qs
        ],
    }


# ---------------------------------------------------------------------------
# Safety checklist initialisation
# ---------------------------------------------------------------------------

_CHECKLIST_DEFAULTS = {
    "sign_in": {
        "patient_identity_confirmed": False,
        "site_marked": False,
        "allergies_checked": False,
        "anaesthesia_equipment_checked": False,
        "pulse_oximeter_attached": False,
        "consent_obtained": False,
    },
    "timeout": {
        "team_confirmed_patient": False,
        "site_and_procedure_confirmed": False,
        "antibiotic_prophylaxis_given": False,
        "critical_steps_reviewed": False,
        "imaging_displayed": False,
    },
    "sign_out": {
        "procedure_recorded": False,
        "instrument_count_complete": False,
        "specimen_labelled": False,
        "equipment_issues_addressed": False,
        "post_op_plan_communicated": False,
    },
}


def initialize_safety_checklist(booking: OTBooking) -> list:
    """Create WHO Surgical Safety Checklist entries for all three phases.

    Phases that already exist are skipped.  Returns the list of newly
    created SurgicalSafetyChecklist instances.
    """
    created = []
    for phase, default_items in _CHECKLIST_DEFAULTS.items():
        checklist, was_created = SurgicalSafetyChecklist.objects.get_or_create(
            booking=booking,
            phase=phase,
            defaults={"items": default_items},
        )
        if was_created:
            created.append(checklist)
    return created
