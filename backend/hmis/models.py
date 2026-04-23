"""HMIS integration persistence.

Models here represent the **linkage** between records in our system (Patient,
Token, visit encounters) and the external Hospital Management Information
System. We store identifiers from the remote HMIS plus an audit log of every
call made so operations can diagnose sync failures end-to-end.

None of these models replace the authoritative records inside the HMIS —
they are glue only.
"""
from django.db import models

from core.models import TimestampedModel, Patient


class HMISProvider(TimestampedModel):
    """One row per HMIS endpoint we integrate with.

    A hospital may have a primary HMIS plus departmental systems (LIS, RIS,
    PharmaSys, etc.) each reachable at its own URL and credentials.
    """
    KIND_GENERIC = "generic"
    KIND_EHOSPITAL = "ehospital"     # NIC e-Hospital (AIIMS default)
    KIND_MEDIXCEL = "medixcel"
    KIND_NEXTGEN = "nextgen"
    KIND_CUSTOM_FHIR = "fhir"
    KIND_CHOICES = [
        (KIND_GENERIC, "Generic REST"),
        (KIND_EHOSPITAL, "NIC e-Hospital"),
        (KIND_MEDIXCEL, "Medixcel"),
        (KIND_NEXTGEN, "NextGen"),
        (KIND_CUSTOM_FHIR, "FHIR R4"),
    ]

    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_GENERIC)
    base_url = models.URLField(help_text="Root URL of the HMIS REST API")
    auth_type = models.CharField(
        max_length=20, default="bearer",
        help_text="bearer | basic | api_key | oauth2",
    )
    client_id = models.CharField(max_length=120, blank=True)
    client_secret = models.CharField(max_length=255, blank=True)
    api_key = models.CharField(max_length=255, blank=True)
    username = models.CharField(max_length=120, blank=True)
    password = models.CharField(max_length=255, blank=True)
    facility_id = models.CharField(max_length=80, blank=True, help_text="Hospital code in the HMIS")
    webhook_secret = models.CharField(max_length=80, blank=True, help_text="HMAC secret used for inbound webhook verification")
    is_primary = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-is_primary", "name"]

    def __str__(self):
        return f"{self.code} – {self.name}"


class HMISPatientLink(TimestampedModel):
    """Maps a local Patient to its HMIS counterpart."""
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="hmis_links")
    provider = models.ForeignKey(HMISProvider, on_delete=models.CASCADE, related_name="patient_links")
    hmis_patient_id = models.CharField(max_length=80, help_text="Primary patient id in the HMIS")
    hmis_mrn = models.CharField(max_length=80, blank=True)
    payload = models.JSONField(default=dict, blank=True, help_text="Last snapshot from HMIS (for debugging)")
    last_synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("provider", "hmis_patient_id")]
        indexes = [models.Index(fields=["provider", "hmis_mrn"])]

    def __str__(self):
        return f"{self.provider.code}:{self.hmis_patient_id} ↔ {self.patient.mrn}"


class HMISAppointment(TimestampedModel):
    """A scheduled HMIS appointment. Pulled daily into the queue for token pre-issue."""
    STATUS_SCHEDULED = "scheduled"
    STATUS_ARRIVED = "arrived"
    STATUS_CHECKED_IN = "checked_in"     # token issued
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_NO_SHOW = "no_show"
    STATUS_CHOICES = [
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_ARRIVED, "Arrived"),
        (STATUS_CHECKED_IN, "Checked In"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_NO_SHOW, "No Show"),
    ]

    provider = models.ForeignKey(HMISProvider, on_delete=models.CASCADE, related_name="appointments")
    hmis_appointment_id = models.CharField(max_length=80)
    patient = models.ForeignKey(Patient, null=True, blank=True, on_delete=models.SET_NULL, related_name="hmis_appointments")
    department_code = models.CharField(max_length=40, blank=True)
    service_code = models.CharField(max_length=40, blank=True)
    doctor_name = models.CharField(max_length=120, blank=True)
    doctor_hmis_id = models.CharField(max_length=80, blank=True)
    scheduled_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SCHEDULED)
    token = models.ForeignKey(
        "queues.Token", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="hmis_appointments",
    )
    raw = models.JSONField(default=dict, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [("provider", "hmis_appointment_id")]
        indexes = [
            models.Index(fields=["status", "scheduled_at"]),
            models.Index(fields=["patient"]),
        ]
        ordering = ["scheduled_at"]

    def __str__(self):
        return f"{self.hmis_appointment_id} · {self.status}"


class HMISEncounter(TimestampedModel):
    """Represents a clinical encounter pushed back to HMIS when a visit closes.

    We keep a local copy so that if HMIS is unavailable we can retry from the
    queue (see :mod:`hmis.services.push_encounter`).
    """
    STATUS_PENDING = "pending"
    STATUS_SENT = "sent"
    STATUS_ACKED = "acknowledged"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SENT, "Sent"),
        (STATUS_ACKED, "Acknowledged"),
        (STATUS_FAILED, "Failed"),
    ]

    provider = models.ForeignKey(HMISProvider, on_delete=models.CASCADE, related_name="encounters")
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="hmis_encounters")
    token = models.ForeignKey(
        "queues.Token", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="hmis_encounters",
    )
    hmis_encounter_id = models.CharField(max_length=80, blank=True)
    payload = models.JSONField(default=dict)
    response = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    error = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    acked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"encounter · {self.patient.mrn} · {self.status}"


class HMISTransaction(TimestampedModel):
    """Journal of every HMIS call (outbound + inbound webhooks).

    Scoped at the request level — one row per HTTP call, whether we made it
    or received it. Used to debug integration failures and for compliance.
    """
    DIRECTION_OUT = "outbound"
    DIRECTION_IN = "inbound"
    DIRECTION_CHOICES = [(DIRECTION_OUT, "Outbound"), (DIRECTION_IN, "Inbound")]

    provider = models.ForeignKey(HMISProvider, on_delete=models.CASCADE, related_name="transactions")
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES, default=DIRECTION_OUT)
    operation = models.CharField(max_length=80, help_text="patient.lookup, appointment.list, encounter.push, webhook.status…")
    method = models.CharField(max_length=10, default="POST")
    url = models.CharField(max_length=500, blank=True)
    request_headers = models.JSONField(default=dict, blank=True)
    request_body = models.JSONField(default=dict, blank=True)
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body = models.JSONField(default=dict, blank=True)
    error = models.TextField(blank=True)
    patient = models.ForeignKey(Patient, null=True, blank=True, on_delete=models.SET_NULL, related_name="hmis_transactions")

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["provider", "operation"]),
            models.Index(fields=["direction", "created_at"]),
        ]

    def __str__(self):
        return f"{self.direction}:{self.operation} → {self.response_status or 'error'}"
