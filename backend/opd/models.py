"""OPD (Out-Patient Department) domain models.

Covers the full clinical OPD flow:
  Appointment  →  Check-in (Queue token issued in `queues` app)
                →  Visit (doctor encounter: vitals → complaints → diagnosis → prescription / lab orders)
                →  Visit Closed  →  pushed to ABDM as FHIR bundle (see `abdm` app)
"""
from django.conf import settings
from django.db import models
from django.utils import timezone

from core.models import TimestampedModel, Department, Patient


class Doctor(TimestampedModel):
    """A consulting physician attached to an OPD department."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="doctor_profile",
    )
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="doctors")
    full_name = models.CharField(max_length=160)
    registration_number = models.CharField(max_length=60, unique=True, help_text="PMDC/NMC license #")
    specialisation = models.CharField(max_length=120, blank=True)
    qualifications = models.CharField(max_length=160, blank=True, help_text="e.g. MBBS, MD (Medicine)")
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    abha_address = models.CharField(max_length=100, blank=True, help_text="Doctor's own ABHA address (e.g. drsmith@abdm)")
    hpr_id = models.CharField(max_length=60, blank=True, help_text="Healthcare Professional Registry ID (ABDM)")
    consultation_fee = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    avg_consult_minutes = models.PositiveIntegerField(default=15)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"Dr. {self.full_name}"


class DoctorSchedule(TimestampedModel):
    """Weekly recurring OPD slot for a doctor.

    A day's appointment slots are generated from this (`start_time` → `end_time`
    stepped by `slot_minutes`). One doctor can have many rows (e.g. Mon/Wed/Fri AM).
    """
    WEEKDAY_CHOICES = [(i, d) for i, d in enumerate(
        ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    )]

    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="schedules")
    weekday = models.PositiveSmallIntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_minutes = models.PositiveIntegerField(default=15)
    room = models.CharField(max_length=60, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["doctor__full_name", "weekday", "start_time"]
        unique_together = [("doctor", "weekday", "start_time")]

    def __str__(self):
        return f"{self.doctor.full_name} · {self.get_weekday_display()} {self.start_time}–{self.end_time}"


class Appointment(TimestampedModel):
    """A pre-booked OPD slot (patient books via web/app/counter)."""
    STATUS_SCHEDULED = "scheduled"
    STATUS_CHECKED_IN = "checked_in"
    STATUS_IN_CONSULTATION = "in_consultation"
    STATUS_COMPLETED = "completed"
    STATUS_NO_SHOW = "no_show"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_CHECKED_IN, "Checked-in"),
        (STATUS_IN_CONSULTATION, "In Consultation"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_NO_SHOW, "No Show"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    TYPE_NEW = "new"
    TYPE_FOLLOWUP = "followup"
    TYPE_CHOICES = [(TYPE_NEW, "New Consultation"), (TYPE_FOLLOWUP, "Follow-up")]

    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="appointments")
    doctor = models.ForeignKey(Doctor, on_delete=models.PROTECT, related_name="appointments")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="appointments")
    scheduled_at = models.DateTimeField()
    slot_minutes = models.PositiveIntegerField(default=15)
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_NEW)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SCHEDULED)
    reason = models.CharField(max_length=255, blank=True, help_text="Chief complaint / reason for visit")
    booked_via = models.CharField(max_length=20, default="counter", help_text="counter | web | app | kiosk")
    checked_in_at = models.DateTimeField(null=True, blank=True)
    # token issued at check-in (from the `queues` app) — kept as a plain id to avoid circular import
    token_id = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["-scheduled_at"]
        indexes = [
            models.Index(fields=["doctor", "scheduled_at"]),
            models.Index(fields=["patient", "scheduled_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.patient.full_name} · Dr. {self.doctor.full_name} · {self.scheduled_at:%Y-%m-%d %H:%M}"


class Visit(TimestampedModel):
    """A doctor-patient clinical encounter — created when doctor starts consultation.

    The Visit is the unit-of-sync with ABDM: once `closed_at` is set, a FHIR bundle
    is assembled and pushed to Eka Care / the HIP gateway (see `abdm.services.push_visit`).
    """
    STATUS_OPEN = "open"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [(STATUS_OPEN, "Open"), (STATUS_CLOSED, "Closed")]

    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="visits")
    doctor = models.ForeignKey(Doctor, on_delete=models.PROTECT, related_name="visits")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="visits")
    appointment = models.OneToOneField(
        Appointment, null=True, blank=True, on_delete=models.SET_NULL, related_name="visit",
    )
    visit_number = models.CharField(max_length=30, unique=True, help_text="Human-readable, e.g. OPD-V-20260421-0007")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_OPEN)
    chief_complaints = models.TextField(blank=True)
    history = models.TextField(blank=True, help_text="History of present illness / past medical history")
    examination = models.TextField(blank=True)
    advice = models.TextField(blank=True)
    follow_up_on = models.DateField(null=True, blank=True)
    opened_at = models.DateTimeField(default=timezone.now)
    closed_at = models.DateTimeField(null=True, blank=True)

    # ABDM sync metadata
    abdm_care_context_ref = models.CharField(max_length=120, blank=True)
    abdm_synced_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-opened_at"]
        indexes = [
            models.Index(fields=["patient", "opened_at"]),
            models.Index(fields=["doctor", "opened_at"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.visit_number} · {self.patient.full_name}"


class Vitals(TimestampedModel):
    """Vitals captured at triage / at the start of a visit."""
    visit = models.OneToOneField(Visit, on_delete=models.CASCADE, related_name="vitals")
    temperature_c = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    pulse_bpm = models.PositiveIntegerField(null=True, blank=True)
    systolic_bp = models.PositiveIntegerField(null=True, blank=True)
    diastolic_bp = models.PositiveIntegerField(null=True, blank=True)
    respiratory_rate = models.PositiveIntegerField(null=True, blank=True)
    spo2 = models.PositiveIntegerField(null=True, blank=True, help_text="%")
    height_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    bmi = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    def save(self, *args, **kwargs):
        if self.height_cm and self.weight_kg:
            h_m = float(self.height_cm) / 100.0
            if h_m > 0:
                self.bmi = round(float(self.weight_kg) / (h_m * h_m), 2)
        super().save(*args, **kwargs)


class Diagnosis(TimestampedModel):
    """One diagnosis line per visit (a visit may have several)."""
    KIND_PROVISIONAL = "provisional"
    KIND_FINAL = "final"
    KIND_DIFFERENTIAL = "differential"
    KIND_CHOICES = [
        (KIND_PROVISIONAL, "Provisional"),
        (KIND_FINAL, "Final"),
        (KIND_DIFFERENTIAL, "Differential"),
    ]

    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name="diagnoses")
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_PROVISIONAL)
    description = models.CharField(max_length=255)
    icd10_code = models.CharField(max_length=20, blank=True, help_text="ICD-10 classification code")
    snomed_code = models.CharField(max_length=30, blank=True, help_text="SNOMED CT code (used in ABDM FHIR bundles)")

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.description} ({self.get_kind_display()})"


class Prescription(TimestampedModel):
    """Prescription header for a visit."""
    visit = models.OneToOneField(Visit, on_delete=models.CASCADE, related_name="prescription")
    notes = models.TextField(blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Rx · {self.visit.visit_number}"


class PrescriptionItem(TimestampedModel):
    """Individual medication line."""
    FREQUENCY_CHOICES = [
        ("OD", "Once a day"),
        ("BD", "Twice a day"),
        ("TDS", "Three times a day"),
        ("QID", "Four times a day"),
        ("HS", "At bedtime"),
        ("SOS", "As needed"),
        ("STAT", "Immediately"),
    ]
    ROUTE_CHOICES = [
        ("oral", "Oral"),
        ("iv", "IV"),
        ("im", "IM"),
        ("sc", "Subcutaneous"),
        ("topical", "Topical"),
        ("inhaled", "Inhaled"),
    ]

    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name="items")
    drug_name = models.CharField(max_length=160)
    strength = models.CharField(max_length=60, blank=True, help_text="e.g. 500 mg")
    route = models.CharField(max_length=20, choices=ROUTE_CHOICES, default="oral")
    frequency = models.CharField(max_length=10, choices=FREQUENCY_CHOICES, default="OD")
    duration_days = models.PositiveIntegerField(default=1)
    instructions = models.CharField(max_length=255, blank=True)
    rx_norm_code = models.CharField(max_length=30, blank=True, help_text="RxNorm / SNOMED code for FHIR")

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.drug_name} {self.strength} {self.frequency}×{self.duration_days}d"


class LabOrder(TimestampedModel):
    """Laboratory / Radiology investigation ordered during a visit."""
    STATUS_ORDERED = "ordered"
    STATUS_COLLECTED = "collected"
    STATUS_RESULTED = "resulted"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_ORDERED, "Ordered"),
        (STATUS_COLLECTED, "Sample Collected"),
        (STATUS_RESULTED, "Result Available"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name="lab_orders")
    test_name = models.CharField(max_length=160)
    test_code = models.CharField(max_length=40, blank=True, help_text="LOINC code (ABDM FHIR)")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ORDERED)
    urgency = models.CharField(max_length=20, default="routine", help_text="routine | urgent | stat")
    notes = models.CharField(max_length=255, blank=True)
    result_value = models.CharField(max_length=255, blank=True)
    result_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.test_name} [{self.status}]"
