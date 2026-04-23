"""Queue business logic — token generation, routing, lifecycle.

This module is the single source of truth for state transitions.
Serializers/viewsets call these functions; they never mutate tokens directly.
"""
from django.db import transaction
from django.utils import timezone
from core.models import Department, Service, Counter, Patient
from .models import Token, TokenEvent, QueueCounter


def _derive_priority(patient: Patient | None, requested: str) -> str:
    """Emergency always wins. Else elderly/disabled from patient flags. Else normal."""
    if requested == Token.PRIORITY_EMERGENCY:
        return Token.PRIORITY_EMERGENCY
    if patient:
        if patient.is_disabled:
            return Token.PRIORITY_DISABLED
        if patient.is_elderly:
            return Token.PRIORITY_ELDERLY
    if requested in {Token.PRIORITY_ELDERLY, Token.PRIORITY_DISABLED}:
        return requested
    return Token.PRIORITY_NORMAL


def _next_sequence(department: Department, is_priority: bool) -> int:
    """Atomically increment today's counter for a (dept, priority) bucket."""
    today = timezone.localdate()
    qc, _ = QueueCounter.objects.select_for_update().get_or_create(
        department=department, date=today,
    )
    if is_priority:
        qc.last_priority_seq += 1
        seq = qc.last_priority_seq
    else:
        qc.last_normal_seq += 1
        seq = qc.last_normal_seq
    qc.save(update_fields=["last_priority_seq", "last_normal_seq", "updated_at"])
    return seq


def _format_number(department: Department, priority: str, seq: int) -> str:
    """OPD-A042 for priority, OPD-N042 for normal (A = priority, N = normal)."""
    letter = "P" if priority != Token.PRIORITY_NORMAL else "N"
    return f"{department.code}-{letter}{seq:03d}"


@transaction.atomic
def issue_token(
    *,
    department: Department,
    service: Service,
    patient: Patient | None = None,
    channel: str = Token.CHANNEL_COUNTER,
    priority: str = Token.PRIORITY_NORMAL,
    actor=None,
    notes: str = "",
) -> Token:
    """Issue a new token — the outcome of 'Token Generation' in the SRS flow."""
    if service.department_id != department.id:
        raise ValueError("Service does not belong to the selected department.")

    final_priority = _derive_priority(patient, priority)
    seq = _next_sequence(department, final_priority != Token.PRIORITY_NORMAL)
    number = _format_number(department, final_priority, seq)

    token = Token.objects.create(
        number=number,
        sequence=seq,
        patient=patient,
        department=department,
        service=service,
        channel=channel,
        priority=final_priority,
        status=Token.STATUS_WAITING,
        notes=notes,
    )
    TokenEvent.objects.create(
        token=token, event="issued", actor=actor,
        payload={"channel": channel, "priority": final_priority, "sequence": seq},
    )
    return token


def _pickable_queryset(department: Department, service: Service | None = None):
    """Waiting tokens in routing order: priority first, then FIFO."""
    qs = Token.objects.filter(
        department=department, status=Token.STATUS_WAITING,
    )
    if service:
        qs = qs.filter(service=service)
    # Emergency > Disabled > Elderly > Normal, then by issuance time
    priority_order = {
        Token.PRIORITY_EMERGENCY: 0,
        Token.PRIORITY_DISABLED: 1,
        Token.PRIORITY_ELDERLY: 2,
        Token.PRIORITY_NORMAL: 3,
    }
    tokens = list(qs)
    tokens.sort(key=lambda t: (priority_order.get(t.priority, 9), t.issued_at))
    return tokens


def next_token_for(counter: Counter) -> Token | None:
    """Peek the next token a counter would be given (no state change)."""
    services = list(counter.services.all())
    if services:
        for svc in services:
            picks = _pickable_queryset(counter.department, svc)
            if picks:
                return picks[0]
        return None
    picks = _pickable_queryset(counter.department)
    return picks[0] if picks else None


@transaction.atomic
def call_next(counter: Counter, actor=None) -> Token | None:
    """Pop the next token for this counter and mark it CALLED."""
    token = next_token_for(counter)
    if not token:
        return None
    token.status = Token.STATUS_CALLED
    token.counter = counter
    token.called_at = timezone.now()
    token.save(update_fields=["status", "counter", "called_at", "updated_at"])
    counter.status = Counter.STATUS_BUSY
    counter.save(update_fields=["status", "updated_at"])
    TokenEvent.objects.create(token=token, event="called", actor=actor, counter=counter)
    return token


@transaction.atomic
def recall(token: Token, actor=None) -> Token:
    """Announce the same token again — increments skip_count."""
    if token.status not in {Token.STATUS_CALLED, Token.STATUS_WAITING}:
        raise ValueError(f"Cannot recall a token in status '{token.status}'.")
    token.skip_count += 1
    token.called_at = timezone.now()
    token.status = Token.STATUS_CALLED
    token.save(update_fields=["skip_count", "called_at", "status", "updated_at"])
    TokenEvent.objects.create(
        token=token, event="recalled", actor=actor, counter=token.counter,
        payload={"skip_count": token.skip_count},
    )
    return token


@transaction.atomic
def skip_token(token: Token, actor=None, max_attempts: int = 3) -> Token:
    """Mark absent after max_attempts re-calls (SRS: 3 attempts then skip)."""
    if token.skip_count + 1 >= max_attempts:
        token.status = Token.STATUS_SKIPPED
    token.skip_count += 1
    token.save(update_fields=["status", "skip_count", "updated_at"])
    if token.counter_id:
        Counter.objects.filter(pk=token.counter_id).update(status=Counter.STATUS_AVAILABLE)
    TokenEvent.objects.create(
        token=token, event="skipped", actor=actor, counter=token.counter,
        payload={"skip_count": token.skip_count, "max_attempts": max_attempts},
    )
    return token


@transaction.atomic
def start_service(token: Token, actor=None) -> Token:
    """Counter staff begins serving the called patient."""
    if token.status not in {Token.STATUS_CALLED, Token.STATUS_WAITING}:
        raise ValueError(f"Cannot start service on token in status '{token.status}'.")
    token.status = Token.STATUS_IN_SERVICE
    token.started_at = timezone.now()
    token.save(update_fields=["status", "started_at", "updated_at"])
    TokenEvent.objects.create(token=token, event="started", actor=actor, counter=token.counter)
    return token


@transaction.atomic
def complete_service(token: Token, actor=None, notes: str = "") -> Token:
    """Close the token, record TAT, free the counter."""
    if token.status not in {Token.STATUS_IN_SERVICE, Token.STATUS_CALLED}:
        raise ValueError(f"Cannot complete token in status '{token.status}'.")
    token.status = Token.STATUS_COMPLETED
    token.completed_at = timezone.now()
    if notes:
        token.notes = (token.notes + "\n" + notes).strip() if token.notes else notes
    token.save(update_fields=["status", "completed_at", "notes", "updated_at"])
    if token.counter_id:
        Counter.objects.filter(pk=token.counter_id).update(status=Counter.STATUS_AVAILABLE)
    TokenEvent.objects.create(
        token=token, event="completed", actor=actor, counter=token.counter,
        payload={"tat_seconds": token.tat_seconds, "service_seconds": token.service_seconds},
    )
    return token


@transaction.atomic
def cancel_token(token: Token, actor=None, reason: str = "") -> Token:
    if token.status in {Token.STATUS_COMPLETED, Token.STATUS_CANCELLED}:
        raise ValueError(f"Cannot cancel token in status '{token.status}'.")
    token.status = Token.STATUS_CANCELLED
    token.save(update_fields=["status", "updated_at"])
    TokenEvent.objects.create(
        token=token, event="cancelled", actor=actor, payload={"reason": reason},
    )
    return token


@transaction.atomic
def transfer_token(token: Token, *, counter: Counter, actor=None) -> Token:
    """Move a token to a different counter (keeps its place in the queue)."""
    old = token.counter
    token.counter = counter
    token.save(update_fields=["counter", "updated_at"])
    TokenEvent.objects.create(
        token=token, event="transferred", actor=actor, counter=counter,
        payload={"from_counter_id": old.id if old else None},
    )
    return token
