from django.db import models
from django.conf import settings
from django.utils import timezone
from core.models import TimestampedModel, Department, Service, Counter, Patient


class Token(TimestampedModel):
    """A single patient token flowing through the queue.

    Lifecycle maps to the SRS flowchart:
      WAITING → CALLED → IN_SERVICE → COMPLETED
                      ↘ SKIPPED (after 3 missed calls) → optionally re-queued
                      ↘ NO_SHOW | CANCELLED
    """

    CHANNEL_KIOSK = "kiosk"
    CHANNEL_COUNTER = "counter"
    CHANNEL_WEB = "web"
    CHANNEL_APP = "app"
    CHANNEL_CHOICES = [
        (CHANNEL_KIOSK, "Kiosk Self Check-in"),
        (CHANNEL_COUNTER, "Counter"),
        (CHANNEL_WEB, "Web"),
        (CHANNEL_APP, "Mobile App"),
    ]

    PRIORITY_NORMAL = "normal"
    PRIORITY_ELDERLY = "elderly"
    PRIORITY_DISABLED = "disabled"
    PRIORITY_EMERGENCY = "emergency"
    PRIORITY_CHOICES = [
        (PRIORITY_NORMAL, "Normal"),
        (PRIORITY_ELDERLY, "Elderly"),
        (PRIORITY_DISABLED, "Disabled"),
        (PRIORITY_EMERGENCY, "Emergency"),
    ]

    STATUS_WAITING = "waiting"
    STATUS_CALLED = "called"
    STATUS_IN_SERVICE = "in_service"
    STATUS_COMPLETED = "completed"
    STATUS_SKIPPED = "skipped"
    STATUS_NO_SHOW = "no_show"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_WAITING, "Waiting"),
        (STATUS_CALLED, "Called"),
        (STATUS_IN_SERVICE, "In Service"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_SKIPPED, "Skipped"),
        (STATUS_NO_SHOW, "No Show"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    number = models.CharField(max_length=20, help_text="Formatted token e.g. OPD-A042")
    sequence = models.PositiveIntegerField(help_text="Daily numeric sequence per department+priority")
    patient = models.ForeignKey(Patient, null=True, blank=True, on_delete=models.SET_NULL, related_name="tokens")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="tokens")
    service = models.ForeignKey(Service, on_delete=models.PROTECT, related_name="tokens")
    counter = models.ForeignKey(Counter, null=True, blank=True, on_delete=models.SET_NULL, related_name="tokens")

    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default=CHANNEL_COUNTER)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_WAITING)

    issued_at = models.DateTimeField(default=timezone.now)
    called_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    skip_count = models.PositiveSmallIntegerField(default=0)
    notify_lead_minutes = models.PositiveSmallIntegerField(default=10)
    notified_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-issued_at"]
        indexes = [
            models.Index(fields=["department", "status"]),
            models.Index(fields=["status", "priority"]),
        ]

    def __str__(self):
        return f"{self.number} [{self.status}]"

    @property
    def is_priority(self) -> bool:
        return self.priority != self.PRIORITY_NORMAL

    @property
    def wait_seconds(self) -> int | None:
        end = self.called_at or self.completed_at or timezone.now()
        return int((end - self.issued_at).total_seconds()) if self.issued_at else None

    @property
    def service_seconds(self) -> int | None:
        if not self.started_at:
            return None
        end = self.completed_at or timezone.now()
        return int((end - self.started_at).total_seconds())

    @property
    def tat_seconds(self) -> int | None:
        """Turn-around-time from issuance to completion."""
        if not self.completed_at:
            return None
        return int((self.completed_at - self.issued_at).total_seconds())


class TokenEvent(TimestampedModel):
    """Audit trail for state transitions — powers analytics and debugging."""
    EVENT_CHOICES = [
        ("issued", "Issued"),
        ("called", "Called"),
        ("recalled", "Re-called"),
        ("skipped", "Skipped"),
        ("started", "Service Started"),
        ("completed", "Completed"),
        ("no_show", "No Show"),
        ("cancelled", "Cancelled"),
        ("transferred", "Transferred"),
        ("notified", "Notified"),
    ]
    token = models.ForeignKey(Token, on_delete=models.CASCADE, related_name="events")
    event = models.CharField(max_length=20, choices=EVENT_CHOICES)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    counter = models.ForeignKey(Counter, null=True, blank=True, on_delete=models.SET_NULL)
    payload = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.token.number} · {self.event}"


class QueueCounter(TimestampedModel):
    """Daily counter used to build per-department, per-priority sequence numbers.

    Keyed by (department, date) — stores the last-issued normal and priority sequences.
    """
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="daily_counters")
    date = models.DateField(default=timezone.now)
    last_normal_seq = models.PositiveIntegerField(default=0)
    last_priority_seq = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [("department", "date")]
