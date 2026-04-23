"""ABDM / Eka Care persistence.

ABDM = Ayushman Bharat Digital Mission (India's national health stack).
Eka Care provides the gateway SDK/APIs we use here. All identifiers below
are the ones defined by the ABDM spec.
"""
from django.db import models

from core.models import TimestampedModel, Patient


class ABHAProfile(TimestampedModel):
    """ABHA (Ayushman Bharat Health Account) profile linked to a local Patient."""
    GENDER_CHOICES = [("M", "Male"), ("F", "Female"), ("O", "Other")]

    patient = models.OneToOneField(Patient, on_delete=models.CASCADE, related_name="abha")
    abha_number = models.CharField(max_length=17, unique=True, help_text="14 digit ABHA number, formatted XX-XXXX-XXXX-XXXX")
    abha_address = models.CharField(max_length=100, unique=True, help_text="Self-chosen ABHA address e.g. alice@abdm")
    first_name = models.CharField(max_length=60, blank=True)
    middle_name = models.CharField(max_length=60, blank=True)
    last_name = models.CharField(max_length=60, blank=True)
    mobile = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    kyc_verified = models.BooleanField(default=False)
    kyc_method = models.CharField(max_length=20, blank=True, help_text="aadhaar | mobile | driving_license")
    photo_base64 = models.TextField(blank=True)

    # Linking / tokens
    linked_at = models.DateTimeField(null=True, blank=True)
    eka_care_user_id = models.CharField(max_length=80, blank=True, help_text="Eka Care internal user id")
    x_token = models.TextField(blank=True, help_text="ABDM patient token (short-lived)")
    x_token_expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.abha_address} ({self.abha_number})"


class ConsentRequest(TimestampedModel):
    """Patient-approved consent artefact that allows this HIP/HIU to pull records."""
    STATUS_REQUESTED = "requested"
    STATUS_GRANTED = "granted"
    STATUS_DENIED = "denied"
    STATUS_EXPIRED = "expired"
    STATUS_REVOKED = "revoked"
    STATUS_CHOICES = [
        (STATUS_REQUESTED, "Requested"),
        (STATUS_GRANTED, "Granted"),
        (STATUS_DENIED, "Denied"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_REVOKED, "Revoked"),
    ]

    PURPOSE_CHOICES = [
        ("CAREMGT", "Care Management"),
        ("BTG", "Break the Glass"),
        ("PUBHLTH", "Public Health"),
        ("HPAYMT", "Healthcare Payment"),
        ("DSRCH", "Disease Specific Research"),
        ("PATRQT", "Patient Requested"),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="consents")
    requester_name = models.CharField(max_length=120, default="AIIMS Hospital")
    requester_id = models.CharField(max_length=60, blank=True, help_text="HIP/HIU id")
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES, default="CAREMGT")
    hi_types = models.JSONField(default=list, help_text="Health Information types, e.g. ['Prescription','DiagnosticReport']")
    date_from = models.DateTimeField(null=True, blank=True)
    date_to = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_REQUESTED)
    consent_request_id = models.CharField(max_length=100, blank=True, help_text="ABDM gateway id")
    consent_artefact_id = models.CharField(max_length=100, blank=True)
    reason = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Consent {self.consent_request_id or self.id} [{self.status}]"


class CareContext(TimestampedModel):
    """An episode of care attached to an ABHA profile — maps to one or more Visits.

    ABDM's "link context" flow groups health records under a care-context node.
    """
    abha = models.ForeignKey(ABHAProfile, on_delete=models.CASCADE, related_name="care_contexts")
    reference = models.CharField(max_length=80, unique=True, help_text="Hospital-assigned unique ref (e.g. visit number)")
    display = models.CharField(max_length=160, help_text="Human description — 'Consultation 21 Apr 2026'")
    hi_types = models.JSONField(default=list, help_text="Record types included in this context")
    linked_at = models.DateTimeField(null=True, blank=True)
    eka_context_id = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.reference} — {self.display}"


class HealthRecordLink(TimestampedModel):
    """Tracks FHIR bundles shipped to Eka Care / ABDM for a given Visit."""
    STATUS_PENDING = "pending"
    STATUS_SENT = "sent"
    STATUS_ACKED = "acked"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SENT, "Sent"),
        (STATUS_ACKED, "Acknowledged"),
        (STATUS_FAILED, "Failed"),
    ]

    RECORD_TYPE_CHOICES = [
        ("OPConsultation", "OP Consultation"),
        ("Prescription", "Prescription"),
        ("DiagnosticReport", "Diagnostic Report"),
        ("DischargeSummary", "Discharge Summary"),
        ("WellnessRecord", "Wellness Record"),
        ("HealthDocumentRecord", "Health Document Record"),
        ("ImmunizationRecord", "Immunization Record"),
    ]

    care_context = models.ForeignKey(
        CareContext, null=True, blank=True, on_delete=models.SET_NULL, related_name="records",
    )
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="health_records")
    visit_id = models.PositiveIntegerField(null=True, blank=True, help_text="opd.Visit id (soft link)")
    record_type = models.CharField(max_length=40, choices=RECORD_TYPE_CHOICES, default="OPConsultation")
    fhir_bundle = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    eka_request_id = models.CharField(max_length=120, blank=True)
    eka_response = models.JSONField(default=dict, blank=True)
    error = models.CharField(max_length=500, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    acked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"HR#{self.id} {self.record_type} [{self.status}]"


class ABDMTransaction(TimestampedModel):
    """Audit log of every Eka Care API call — handy for compliance/debugging."""
    KIND_CHOICES = [
        ("auth", "Gateway Auth"),
        ("otp_request", "OTP Request"),
        ("otp_verify", "OTP Verify"),
        ("abha_create", "ABHA Create"),
        ("abha_fetch", "ABHA Fetch"),
        ("abha_link", "ABHA Link"),
        ("consent_request", "Consent Request"),
        ("consent_fetch", "Consent Fetch"),
        ("care_context_link", "Care Context Link"),
        ("hip_share", "HIP Share Bundle"),
        ("other", "Other"),
    ]

    kind = models.CharField(max_length=30, choices=KIND_CHOICES, default="other")
    patient = models.ForeignKey(Patient, null=True, blank=True, on_delete=models.SET_NULL, related_name="abdm_txns")
    request_id = models.CharField(max_length=120, blank=True)
    endpoint = models.CharField(max_length=255, blank=True)
    request_body = models.JSONField(default=dict, blank=True)
    response_body = models.JSONField(default=dict, blank=True)
    http_status = models.PositiveIntegerField(null=True, blank=True)
    ok = models.BooleanField(default=False)
    error = models.CharField(max_length=500, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.kind} #{self.id} ({self.http_status})"
