"""Operation Theatre (OT) / Surgery Management models.

Covers the full surgical workflow:
  OT Booking  →  Pre-Op Assessment  →  Safety Checklist (Sign-In)
              →  Intraoperative Record (vitals, drugs, blood, specimens)
              →  Anaesthesia Record
              →  Safety Checklist (Time-Out → Sign-Out)
              →  Recovery Room  →  Operative Note  →  Billing  →  Outcome
"""
from django.conf import settings
from django.db import models

from core.models import TimestampedModel, Department, Patient


# ---------------------------------------------------------------------------
# OT Room
# ---------------------------------------------------------------------------

class OTRoom(TimestampedModel):
    """A physical operation theatre room."""

    ROOM_TYPE_CHOICES = [
        ("major", "Major OT"),
        ("minor", "Minor OT"),
        ("emergency", "Emergency OT"),
        ("cardiac", "Cardiac OT"),
        ("neuro", "Neuro OT"),
        ("transplant", "Transplant OT"),
        ("ortho", "Orthopaedic OT"),
        ("laparoscopy", "Laparoscopy Suite"),
    ]

    STATUS_CHOICES = [
        ("available", "Available"),
        ("occupied", "Occupied"),
        ("cleaning", "Cleaning"),
        ("maintenance", "Under Maintenance"),
        ("closed", "Closed"),
    ]

    name = models.CharField(max_length=100)
    room_number = models.CharField(max_length=20, unique=True)
    room_type = models.CharField(max_length=20, choices=ROOM_TYPE_CHOICES)
    department = models.ForeignKey(
        Department, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="ot_rooms",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="available")
    equipment = models.JSONField(default=list, help_text="List of available equipment names")
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["room_number"]

    def __str__(self):
        return f"{self.name} ({self.room_number})"


# ---------------------------------------------------------------------------
# Surgical Team
# ---------------------------------------------------------------------------

class SurgicalTeamMember(TimestampedModel):
    """A staff member who participates in surgical procedures."""

    ROLE_CHOICES = [
        ("primary_surgeon", "Primary Surgeon"),
        ("assistant_surgeon", "Assistant Surgeon"),
        ("anaesthesiologist", "Anaesthesiologist"),
        ("scrub_nurse", "Scrub Nurse"),
        ("circulating_nurse", "Circulating Nurse"),
        ("ot_technician", "OT Technician"),
        ("perfusionist", "Perfusionist"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="surgical_team_profiles",
    )
    role = models.CharField(max_length=30, choices=ROLE_CHOICES)
    specialization = models.CharField(max_length=100, blank=True)
    registration_number = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["role", "user__last_name"]

    def __str__(self):
        return f"{self.user.get_full_name()} – {self.get_role_display()}"


# ---------------------------------------------------------------------------
# OT Booking
# ---------------------------------------------------------------------------

class OTBooking(TimestampedModel):
    """The central record for a scheduled or completed surgical case."""

    SURGERY_CATEGORY_CHOICES = [
        ("general", "General Surgery"),
        ("ortho", "Orthopaedic"),
        ("cardiac", "Cardiac"),
        ("neuro", "Neurosurgery"),
        ("ent", "ENT"),
        ("ophthalmology", "Ophthalmology"),
        ("urology", "Urology"),
        ("gynaecology", "Gynaecology & Obstetrics"),
        ("paediatric", "Paediatric Surgery"),
        ("plastic", "Plastic & Reconstructive"),
        ("transplant", "Transplant"),
        ("laparoscopy", "Laparoscopy"),
        ("endoscopy", "Endoscopy"),
        ("other", "Other"),
    ]

    PRIORITY_CHOICES = [
        ("elective", "Elective"),
        ("urgent", "Urgent"),
        ("emergency", "Emergency"),
    ]

    STATUS_CHOICES = [
        ("scheduled", "Scheduled"),
        ("confirmed", "Confirmed"),
        ("prep", "Patient in Prep"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
        ("postponed", "Postponed"),
    ]

    booking_number = models.CharField(max_length=20, unique=True, help_text="e.g. OT-20260422-0001")
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="ot_bookings")
    room = models.ForeignKey(OTRoom, on_delete=models.PROTECT, related_name="bookings")
    surgery_name = models.CharField(max_length=200)
    surgery_category = models.CharField(max_length=20, choices=SURGERY_CATEGORY_CHOICES)
    icd_procedure_code = models.CharField(max_length=20, blank=True, help_text="ICD-10-PCS procedure code")
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="elective")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="scheduled")

    # Scheduling
    scheduled_date = models.DateField()
    scheduled_start = models.TimeField()
    scheduled_end = models.TimeField()
    actual_start = models.DateTimeField(null=True, blank=True)
    actual_end = models.DateTimeField(null=True, blank=True)

    # Team
    primary_surgeon = models.ForeignKey(
        SurgicalTeamMember, on_delete=models.PROTECT,
        related_name="primary_surgeries",
    )
    anaesthesiologist = models.ForeignKey(
        SurgicalTeamMember, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="anaesthesia_cases",
    )
    team_members = models.ManyToManyField(
        SurgicalTeamMember, blank=True, related_name="assigned_surgeries",
    )

    # Clinical details
    diagnosis = models.TextField()
    planned_procedure = models.TextField()
    special_requirements = models.TextField(blank=True)
    equipment_needed = models.JSONField(default=list)

    # Links to other apps (stored as plain IDs to avoid circular imports)
    visit_id = models.IntegerField(null=True, blank=True, help_text="OPD Visit ID")
    appointment_id = models.IntegerField(null=True, blank=True, help_text="OPD Appointment ID")

    # Ward/bed info at time of booking
    ward = models.CharField(max_length=100, blank=True)
    bed_number = models.CharField(max_length=20, blank=True)

    # Administrative
    booked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True,
        on_delete=models.SET_NULL, related_name="ot_bookings_made",
    )
    booking_notes = models.TextField(blank=True)
    cancellation_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["scheduled_date", "scheduled_start"]
        indexes = [
            models.Index(fields=["scheduled_date", "status"]),
            models.Index(fields=["patient", "scheduled_date"]),
            models.Index(fields=["room", "scheduled_date"]),
        ]

    def __str__(self):
        return f"{self.booking_number} – {self.surgery_name}"


# ---------------------------------------------------------------------------
# Pre-Operative Assessment
# ---------------------------------------------------------------------------

class PreOpAssessment(TimestampedModel):
    """Pre-operative clinical assessment and fitness clearance."""

    ASA_GRADE_CHOICES = [
        ("I", "ASA I – Normal healthy patient"),
        ("II", "ASA II – Mild systemic disease"),
        ("III", "ASA III – Severe systemic disease"),
        ("IV", "ASA IV – Severe disease, constant threat to life"),
        ("V", "ASA V – Moribund, not expected to survive without surgery"),
        ("VI", "ASA VI – Brain-dead, organ donation"),
    ]

    AIRWAY_CHOICES = [
        ("mallampati_1", "Mallampati Class I"),
        ("mallampati_2", "Mallampati Class II"),
        ("mallampati_3", "Mallampati Class III"),
        ("mallampati_4", "Mallampati Class IV"),
    ]

    FITNESS_CHOICES = [
        ("fit", "Fit for Surgery"),
        ("fit_with_precautions", "Fit with Precautions"),
        ("postpone", "Postpone – Optimisation Required"),
        ("unfit", "Unfit for Surgery"),
    ]

    booking = models.OneToOneField(
        OTBooking, on_delete=models.CASCADE, related_name="pre_op_assessment",
    )
    assessed_by = models.ForeignKey(
        SurgicalTeamMember, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="pre_op_assessments",
    )

    # Anthropometry
    weight = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, help_text="kg")
    height = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True, help_text="cm")
    bmi = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    blood_group = models.CharField(max_length=5, blank=True)

    # Risk stratification
    asa_grade = models.CharField(max_length=3, choices=ASA_GRADE_CHOICES)
    airway_assessment = models.CharField(max_length=20, choices=AIRWAY_CHOICES, blank=True)

    # Allergies
    allergies = models.TextField(blank=True)
    drug_allergies = models.JSONField(default=list, help_text="List of drug names the patient is allergic to")
    latex_allergy = models.BooleanField(default=False)

    # Medical history
    comorbidities = models.JSONField(default=list, help_text="List of known comorbidities")
    current_medications = models.TextField(blank=True)
    last_meal_time = models.DateTimeField(null=True, blank=True, help_text="NPO status reference")

    # Investigations
    haemoglobin = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True, help_text="g/dL")
    platelet_count = models.IntegerField(null=True, blank=True, help_text="×10³/µL")
    inr = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    serum_creatinine = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True, help_text="mg/dL")
    investigations_note = models.TextField(blank=True)

    # Anaesthesia plan
    anaesthesia_type = models.CharField(max_length=100, blank=True)
    special_precautions = models.TextField(blank=True)
    pre_op_medications = models.TextField(blank=True)

    # Consent
    informed_consent_obtained = models.BooleanField(default=False)
    consent_date = models.DateField(null=True, blank=True)
    consent_by = models.CharField(max_length=100, blank=True, help_text="Name of person who obtained consent")

    # Fitness decision
    fitness_status = models.CharField(max_length=30, choices=FITNESS_CHOICES, blank=True)
    fitness_notes = models.TextField(blank=True)

    def __str__(self):
        return f"Pre-Op: {self.booking.booking_number}"


# ---------------------------------------------------------------------------
# Surgical Safety Checklist (WHO)
# ---------------------------------------------------------------------------

class SurgicalSafetyChecklist(models.Model):
    """WHO Surgical Safety Checklist — one row per phase per booking."""

    PHASE_CHOICES = [
        ("sign_in", "Sign-In (before anaesthesia)"),
        ("timeout", "Time-Out (before incision)"),
        ("sign_out", "Sign-Out (before patient leaves OT)"),
    ]

    booking = models.ForeignKey(
        OTBooking, on_delete=models.CASCADE, related_name="safety_checklists",
    )
    phase = models.CharField(max_length=20, choices=PHASE_CHOICES)
    completed = models.BooleanField(default=False)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="completed_checklists",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    items = models.JSONField(
        default=dict,
        help_text="Checklist items as {key: bool}, e.g. {'patient_identity_confirmed': True}",
    )
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [("booking", "phase")]
        ordering = ["booking", "phase"]

    def __str__(self):
        return f"{self.get_phase_display()} – {self.booking.booking_number}"


# ---------------------------------------------------------------------------
# Intraoperative Record
# ---------------------------------------------------------------------------

class IntraoperativeRecord(TimestampedModel):
    """Master intraoperative record for a surgical case."""

    WOUND_CLASSIFICATION_CHOICES = [
        ("clean", "Class I – Clean"),
        ("clean_contaminated", "Class II – Clean-Contaminated"),
        ("contaminated", "Class III – Contaminated"),
        ("dirty", "Class IV – Dirty/Infected"),
    ]

    booking = models.OneToOneField(
        OTBooking, on_delete=models.CASCADE, related_name="intraop_record",
    )
    operative_findings = models.TextField(blank=True)
    procedure_performed = models.TextField(blank=True)

    # Fluid balance
    iv_fluids_ml = models.PositiveIntegerField(default=0, help_text="Total IV fluids administered (mL)")
    estimated_blood_loss_ml = models.PositiveIntegerField(default=0, help_text="Estimated blood loss (mL)")
    urine_output_ml = models.PositiveIntegerField(default=0, help_text="Urine output during procedure (mL)")

    # Wound & closure
    wound_classification = models.CharField(
        max_length=25, choices=WOUND_CLASSIFICATION_CHOICES, blank=True,
    )
    drain_placed = models.BooleanField(default=False)
    drain_details = models.TextField(blank=True)

    # Count verification
    instrument_count_correct = models.BooleanField(default=True)
    sponge_count_correct = models.BooleanField(default=True)
    needle_count_correct = models.BooleanField(default=True)

    # Complications & closure
    intraop_complications = models.TextField(blank=True)
    closure_technique = models.CharField(max_length=200, blank=True)
    suture_material = models.CharField(max_length=200, blank=True)

    documented_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True,
        on_delete=models.SET_NULL, related_name="intraop_records_documented",
    )

    def __str__(self):
        return f"Intraop: {self.booking.booking_number}"


class IntraopVital(models.Model):
    """Periodic intraoperative vital signs reading."""

    intraop_record = models.ForeignKey(
        IntraoperativeRecord, on_delete=models.CASCADE, related_name="vitals",
    )
    recorded_at = models.DateTimeField()
    bp_systolic = models.PositiveIntegerField(null=True, blank=True, help_text="mmHg")
    bp_diastolic = models.PositiveIntegerField(null=True, blank=True, help_text="mmHg")
    heart_rate = models.PositiveIntegerField(null=True, blank=True, help_text="bpm")
    spo2 = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True, help_text="%")
    temperature = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True, help_text="°C")
    etco2 = models.PositiveIntegerField(null=True, blank=True, help_text="End-tidal CO₂ (mmHg)")
    respiratory_rate = models.PositiveIntegerField(null=True, blank=True, help_text="breaths/min")
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["recorded_at"]

    def __str__(self):
        return f"Vital @ {self.recorded_at:%H:%M} – {self.intraop_record.booking.booking_number}"


class DrugAdministration(models.Model):
    """A single drug dose administered during the intraoperative period."""

    ROUTE_CHOICES = [
        ("iv", "Intravenous (IV)"),
        ("im", "Intramuscular (IM)"),
        ("sc", "Subcutaneous (SC)"),
        ("it", "Intrathecal (IT)"),
        ("epidural", "Epidural"),
        ("inhalation", "Inhalation"),
        ("topical", "Topical"),
    ]

    intraop_record = models.ForeignKey(
        IntraoperativeRecord, on_delete=models.CASCADE, related_name="drug_administrations",
    )
    drug_name = models.CharField(max_length=100)
    dose = models.CharField(max_length=50)
    unit = models.CharField(max_length=20)
    route = models.CharField(max_length=20, choices=ROUTE_CHOICES)
    administered_at = models.DateTimeField()
    administered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True,
        on_delete=models.SET_NULL, related_name="drug_administrations",
    )
    indication = models.CharField(max_length=200, blank=True)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["administered_at"]

    def __str__(self):
        return f"{self.drug_name} {self.dose}{self.unit} @ {self.administered_at:%H:%M}"


class BloodProductUsed(models.Model):
    """A blood product transfused during the case."""

    PRODUCT_TYPE_CHOICES = [
        ("prbc", "Packed Red Blood Cells (PRBC)"),
        ("ffp", "Fresh Frozen Plasma (FFP)"),
        ("platelets", "Platelets"),
        ("cryo", "Cryoprecipitate"),
        ("whole_blood", "Whole Blood"),
        ("albumin", "Albumin"),
    ]

    intraop_record = models.ForeignKey(
        IntraoperativeRecord, on_delete=models.CASCADE, related_name="blood_products",
    )
    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPE_CHOICES)
    units = models.PositiveIntegerField()
    volume_ml = models.PositiveIntegerField(null=True, blank=True)
    blood_group = models.CharField(max_length=5)
    cross_match_number = models.CharField(max_length=50, blank=True)
    bag_number = models.CharField(max_length=50, blank=True)
    transfused_at = models.DateTimeField()
    reaction_occurred = models.BooleanField(default=False)
    reaction_details = models.TextField(blank=True)

    def __str__(self):
        return f"{self.get_product_type_display()} – {self.units} unit(s)"


class SpecimenCollected(models.Model):
    """A tissue or fluid specimen collected during the procedure."""

    SPECIMEN_TYPE_CHOICES = [
        ("tissue", "Tissue / Biopsy"),
        ("fluid", "Fluid"),
        ("blood", "Blood"),
        ("urine", "Urine"),
        ("swab", "Swab / Culture"),
        ("bone", "Bone"),
        ("other", "Other"),
    ]

    intraop_record = models.ForeignKey(
        IntraoperativeRecord, on_delete=models.CASCADE, related_name="specimens",
    )
    specimen_type = models.CharField(max_length=20, choices=SPECIMEN_TYPE_CHOICES)
    description = models.CharField(max_length=200)
    site = models.CharField(max_length=200)
    sent_to_lab = models.BooleanField(default=False)
    lab_request_number = models.CharField(max_length=50, blank=True)
    collected_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_specimen_type_display()} – {self.description}"


# ---------------------------------------------------------------------------
# Implant Log
# ---------------------------------------------------------------------------

class ImplantLog(models.Model):
    """Implant / prosthesis used during a surgical case."""

    booking = models.ForeignKey(
        OTBooking, on_delete=models.CASCADE, related_name="implants",
    )
    implant_name = models.CharField(max_length=200)
    manufacturer = models.CharField(max_length=100)
    batch_number = models.CharField(max_length=100)
    lot_number = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=100, blank=True)
    size = models.CharField(max_length=50, blank=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    expiry_date = models.DateField(null=True, blank=True)
    body_site = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True,
        on_delete=models.SET_NULL, related_name="implant_logs_recorded",
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.implant_name} – Batch: {self.batch_number}"


# ---------------------------------------------------------------------------
# Anaesthesia Record
# ---------------------------------------------------------------------------

class AnaesthesiaRecord(TimestampedModel):
    """Complete anaesthesia record for a surgical case."""

    ANAESTHESIA_TYPE_CHOICES = [
        ("general", "General Anaesthesia"),
        ("spinal", "Spinal Anaesthesia"),
        ("epidural", "Epidural Anaesthesia"),
        ("combined_spinal_epidural", "Combined Spinal-Epidural (CSE)"),
        ("regional", "Regional Block"),
        ("local", "Local Anaesthesia"),
        ("sedation", "Monitored Anaesthesia Care / Sedation"),
    ]

    AIRWAY_MANAGEMENT_CHOICES = [
        ("ett", "Endotracheal Tube (ETT)"),
        ("lma", "Laryngeal Mask Airway (LMA)"),
        ("mask", "Face Mask"),
        ("none", "No Airway Device"),
        ("tracheostomy", "Tracheostomy"),
    ]

    booking = models.OneToOneField(
        OTBooking, on_delete=models.CASCADE, related_name="anaesthesia_record",
    )
    anaesthesiologist = models.ForeignKey(
        SurgicalTeamMember, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="anaesthesia_records",
    )

    # Anaesthesia plan & delivery
    anaesthesia_type = models.CharField(max_length=30, choices=ANAESTHESIA_TYPE_CHOICES)
    airway_management = models.CharField(
        max_length=20, choices=AIRWAY_MANAGEMENT_CHOICES, blank=True,
    )
    airway_size = models.CharField(max_length=10, blank=True, help_text="e.g. 7.5 ETT")

    # Timestamps
    induction_time = models.DateTimeField(null=True, blank=True)
    intubation_time = models.DateTimeField(null=True, blank=True)
    extubation_time = models.DateTimeField(null=True, blank=True)

    # Agents
    induction_agents = models.JSONField(default=list, help_text="List of induction agents used")
    maintenance_agents = models.JSONField(default=list, help_text="List of maintenance agents")
    reversal_agents = models.JSONField(default=list, help_text="List of reversal agents")

    # Regional anaesthesia details
    regional_block_details = models.TextField(blank=True)
    nerve_stimulator_used = models.BooleanField(default=False)
    ultrasound_guided = models.BooleanField(default=False)

    # Monitoring & lines
    monitoring_used = models.JSONField(default=list, help_text="e.g. ['IBP', 'CVP', 'BIS']")
    lines_placed = models.JSONField(default=list, help_text="e.g. ['16G PIV', 'CVC right IJV']")

    # Complications & recovery
    complications = models.TextField(blank=True)
    difficult_intubation = models.BooleanField(default=False)
    intubation_attempts = models.PositiveIntegerField(default=1)
    recovery_score_at_transfer = models.CharField(
        max_length=50, blank=True, help_text="Aldrete / Modified Aldrete score at transfer",
    )
    post_op_pain_score = models.PositiveIntegerField(
        null=True, blank=True, help_text="NRS pain score 0–10 at recovery",
    )
    nausea_vomiting = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"Anaesthesia: {self.booking.booking_number} ({self.get_anaesthesia_type_display()})"


# ---------------------------------------------------------------------------
# Post-Operative Orders
# ---------------------------------------------------------------------------

class PostOpOrder(models.Model):
    """A post-operative standing order written by the surgical team."""

    ORDER_TYPE_CHOICES = [
        ("medication", "Medication"),
        ("fluid", "IV Fluid"),
        ("monitoring", "Monitoring"),
        ("diet", "Diet"),
        ("activity", "Activity / Mobilisation"),
        ("wound_care", "Wound Care"),
        ("lab", "Laboratory Investigation"),
        ("imaging", "Imaging"),
        ("other", "Other"),
    ]

    booking = models.ForeignKey(
        OTBooking, on_delete=models.CASCADE, related_name="post_op_orders",
    )
    order_type = models.CharField(max_length=20, choices=ORDER_TYPE_CHOICES)
    order_text = models.TextField()
    frequency = models.CharField(max_length=50, blank=True, help_text="e.g. BD, Q4H, PRN")
    duration = models.CharField(max_length=50, blank=True, help_text="e.g. 5 days, until discharge")
    ordered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True,
        on_delete=models.SET_NULL, related_name="post_op_orders_written",
    )
    ordered_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ["ordered_at"]

    def __str__(self):
        return f"{self.get_order_type_display()}: {self.order_text[:60]}"


# ---------------------------------------------------------------------------
# Recovery Room Record
# ---------------------------------------------------------------------------

class RecoveryRoomRecord(TimestampedModel):
    """Post-anaesthesia care unit (PACU) / recovery room record."""

    booking = models.OneToOneField(
        OTBooking, on_delete=models.CASCADE, related_name="recovery_record",
    )
    admission_time = models.DateTimeField()
    discharge_time = models.DateTimeField(null=True, blank=True)

    # Aldrete scoring
    aldrete_score_admission = models.PositiveIntegerField(
        null=True, blank=True, help_text="Aldrete score on PACU admission (0–10)",
    )
    aldrete_score_discharge = models.PositiveIntegerField(
        null=True, blank=True, help_text="Aldrete score at PACU discharge (0–10)",
    )

    pain_score = models.PositiveIntegerField(null=True, blank=True, help_text="NRS 0–10")
    vitals_stable = models.BooleanField(default=False)
    medications_given = models.JSONField(
        default=list, help_text="List of medications given in recovery room",
    )
    complications = models.TextField(blank=True)

    # Transfer destination
    transferred_to = models.CharField(
        max_length=100, blank=True, help_text="e.g. Ward, ICU, HDU, Home",
    )
    transfer_ward = models.CharField(max_length=100, blank=True)
    transfer_bed = models.CharField(max_length=20, blank=True)

    nurse_in_charge = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True,
        on_delete=models.SET_NULL, related_name="recovery_room_cases",
    )
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"Recovery: {self.booking.booking_number}"


# ---------------------------------------------------------------------------
# Operative Note
# ---------------------------------------------------------------------------

class OperativeNote(TimestampedModel):
    """Dictated/typed operative note — the formal surgical record."""

    booking = models.OneToOneField(
        OTBooking, on_delete=models.CASCADE, related_name="operative_note",
    )
    procedure_name = models.CharField(max_length=200)
    indication = models.TextField()
    anaesthesia_given = models.CharField(max_length=100)
    patient_position = models.CharField(max_length=100, blank=True)
    incision = models.CharField(max_length=200, blank=True)
    operative_findings = models.TextField()
    steps_performed = models.TextField()
    implants_used = models.TextField(blank=True)
    specimens_sent = models.TextField(blank=True)
    blood_loss = models.CharField(max_length=50, blank=True, help_text="e.g. 200 mL")
    complications = models.TextField(blank=True)
    closure = models.TextField(blank=True)
    post_op_instructions = models.TextField(blank=True)
    dictated_by = models.ForeignKey(
        SurgicalTeamMember, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="operative_notes",
    )
    signed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Op Note: {self.booking.booking_number} – {self.procedure_name}"


# ---------------------------------------------------------------------------
# OT Bill
# ---------------------------------------------------------------------------

class OTBill(TimestampedModel):
    """Financial bill for the surgical episode."""

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("finalized", "Finalized"),
        ("submitted", "Submitted to Insurance / TPA"),
        ("paid", "Paid"),
    ]

    booking = models.OneToOneField(
        OTBooking, on_delete=models.CASCADE, related_name="ot_bill",
    )

    # Charge components
    ot_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    surgeon_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    anaesthesia_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    assistant_surgeon_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    nursing_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    supply_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    implant_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    blood_product_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_charges = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    billing_notes = models.TextField(blank=True)
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True,
        on_delete=models.SET_NULL, related_name="ot_bills_prepared",
    )

    def calculate_and_save_total(self):
        """Sum all charge components, update total_amount, and persist."""
        self.total_amount = (
            self.ot_charges
            + self.surgeon_fee
            + self.anaesthesia_fee
            + self.assistant_surgeon_fee
            + self.nursing_charges
            + self.supply_charges
            + self.implant_charges
            + self.blood_product_charges
            + self.other_charges
        )
        self.save()

    def __str__(self):
        return f"Bill: {self.booking.booking_number} – {self.total_amount} ({self.get_status_display()})"


# ---------------------------------------------------------------------------
# Surgical Outcome
# ---------------------------------------------------------------------------

class SurgicalOutcome(TimestampedModel):
    """Post-surgical outcome & quality audit record."""

    WOUND_CLASS_CHOICES = [
        ("I", "I – Clean"),
        ("II", "II – Clean-Contaminated"),
        ("III", "III – Contaminated"),
        ("IV", "IV – Dirty-Infected"),
    ]

    THIRTY_DAY_OUTCOME_CHOICES = [
        ("recovered", "Recovered"),
        ("improved", "Improved"),
        ("unchanged", "Unchanged"),
        ("deteriorated", "Deteriorated"),
        ("expired", "Expired"),
    ]

    booking = models.OneToOneField(
        OTBooking, on_delete=models.CASCADE, related_name="surgical_outcome",
    )

    # Wound
    wound_class = models.CharField(max_length=5, choices=WOUND_CLASS_CHOICES, blank=True)

    # Surgical Site Infection
    ssi_occurred = models.BooleanField(default=False)
    ssi_date = models.DateField(null=True, blank=True)
    ssi_type = models.CharField(max_length=50, blank=True, help_text="e.g. Superficial, Deep, Organ-space")

    # Complications
    intraop_complications = models.TextField(blank=True)
    postop_complications = models.TextField(blank=True)

    # Reoperation
    reoperation_required = models.BooleanField(default=False)
    reoperation_date = models.DateField(null=True, blank=True)
    reoperation_reason = models.TextField(blank=True)

    # ICU & LOS
    icu_admission = models.BooleanField(default=False)
    icu_days = models.PositiveIntegerField(null=True, blank=True)
    hospital_stay_days = models.PositiveIntegerField(null=True, blank=True)

    # 30-day outcome
    thirty_day_outcome = models.CharField(
        max_length=20, choices=THIRTY_DAY_OUTCOME_CHOICES, blank=True,
    )
    thirty_day_mortality = models.BooleanField(default=False)
    mortality_cause = models.TextField(blank=True)

    # Trainee case log (for surgical training audit)
    trainee_surgeon = models.ForeignKey(
        SurgicalTeamMember, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="case_logs",
    )
    trainee_role = models.CharField(max_length=100, blank=True)

    audit_notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True,
        on_delete=models.SET_NULL, related_name="surgical_outcomes_recorded",
    )

    def __str__(self):
        return f"Outcome: {self.booking.booking_number}"


# ---------------------------------------------------------------------------
# OT Inventory
# ---------------------------------------------------------------------------

class OTInventoryItem(TimestampedModel):
    """An item stocked in the OT store / inventory."""

    CATEGORY_CHOICES = [
        ("implant", "Implant / Prosthesis"),
        ("suture", "Suture Material"),
        ("consumable", "Consumable"),
        ("instrument", "Surgical Instrument"),
        ("anaesthesia", "Anaesthesia Supply"),
        ("drape", "Drapes / Covers"),
        ("gloves", "Gloves / PPE"),
        ("other", "Other"),
    ]

    UNIT_CHOICES = [
        ("piece", "Piece"),
        ("box", "Box"),
        ("pack", "Pack"),
        ("roll", "Roll"),
        ("vial", "Vial"),
        ("ampule", "Ampule"),
        ("set", "Set"),
    ]

    name = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    sku = models.CharField(
        max_length=50, unique=True, blank=True,
        help_text="Stock-keeping unit code",
    )
    manufacturer = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default="piece")
    quantity_in_stock = models.PositiveIntegerField(default=0)
    reorder_level = models.PositiveIntegerField(default=10)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["category", "name"]

    @property
    def needs_reorder(self):
        """True when stock is at or below the reorder threshold."""
        return self.quantity_in_stock <= self.reorder_level

    def __str__(self):
        return f"{self.name} ({self.quantity_in_stock} {self.unit})"


# ---------------------------------------------------------------------------
# CSSD Batch
# ---------------------------------------------------------------------------

class CSSDBatch(TimestampedModel):
    """Central Sterile Supply Department (CSSD) sterilisation batch record."""

    STATUS_CHOICES = [
        ("sterilizing", "Sterilizing"),
        ("ready", "Ready for Use"),
        ("issued", "Issued to OT"),
        ("used", "Used"),
        ("recall", "Recall / Quarantine"),
    ]

    batch_number = models.CharField(max_length=50, unique=True)
    instrument_set_name = models.CharField(max_length=200)
    sterilization_method = models.CharField(
        max_length=50, blank=True, help_text="e.g. Autoclave, EO, Plasma",
    )
    sterilization_date = models.DateField()
    expiry_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="sterilizing")
    ot_booking = models.ForeignKey(
        OTBooking, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="cssd_batches",
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-sterilization_date"]
        verbose_name = "CSSD Batch"
        verbose_name_plural = "CSSD Batches"

    def __str__(self):
        return f"CSSD Batch {self.batch_number} – {self.instrument_set_name}"
