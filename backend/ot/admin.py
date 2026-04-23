"""Django admin configuration for the OT (Operation Theatre) app."""
from django.contrib import admin

from .models import (
    OTRoom,
    SurgicalTeamMember,
    OTBooking,
    PreOpAssessment,
    SurgicalSafetyChecklist,
    IntraoperativeRecord,
    IntraopVital,
    DrugAdministration,
    BloodProductUsed,
    SpecimenCollected,
    ImplantLog,
    AnaesthesiaRecord,
    PostOpOrder,
    RecoveryRoomRecord,
    OperativeNote,
    OTBill,
    SurgicalOutcome,
    OTInventoryItem,
    CSSDBatch,
)


# ---------------------------------------------------------------------------
# OT Room
# ---------------------------------------------------------------------------

@admin.register(OTRoom)
class OTRoomAdmin(admin.ModelAdmin):
    list_display = ("room_number", "name", "room_type", "department", "status", "is_active")
    list_filter = ("room_type", "status", "is_active", "department")
    search_fields = ("name", "room_number")
    ordering = ("room_number",)


# ---------------------------------------------------------------------------
# Surgical Team Member
# ---------------------------------------------------------------------------

@admin.register(SurgicalTeamMember)
class SurgicalTeamMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "specialization", "registration_number", "is_active")
    list_filter = ("role", "is_active")
    search_fields = (
        "user__first_name", "user__last_name", "user__username",
        "registration_number", "specialization",
    )
    ordering = ("role", "user__last_name")


# ---------------------------------------------------------------------------
# OT Booking
# ---------------------------------------------------------------------------

class SurgicalSafetyChecklistInline(admin.TabularInline):
    model = SurgicalSafetyChecklist
    extra = 0
    readonly_fields = ("completed_at",)


class ImplantLogInline(admin.TabularInline):
    model = ImplantLog
    extra = 0
    readonly_fields = ("recorded_at",)


class PostOpOrderInline(admin.TabularInline):
    model = PostOpOrder
    extra = 0
    readonly_fields = ("ordered_at",)


@admin.register(OTBooking)
class OTBookingAdmin(admin.ModelAdmin):
    list_display = (
        "booking_number", "patient", "surgery_name",
        "scheduled_date", "scheduled_start", "room",
        "status", "priority",
    )
    list_filter = ("status", "priority", "surgery_category", "scheduled_date", "room")
    search_fields = (
        "booking_number", "patient__full_name", "patient__mrn",
        "surgery_name", "primary_surgeon__user__last_name",
    )
    date_hierarchy = "scheduled_date"
    raw_id_fields = ("patient", "primary_surgeon", "anaesthesiologist", "booked_by")
    filter_horizontal = ("team_members",)
    readonly_fields = ("actual_start", "actual_end")
    inlines = [SurgicalSafetyChecklistInline, ImplantLogInline, PostOpOrderInline]
    fieldsets = (
        ("Booking Info", {
            "fields": (
                "booking_number", "patient", "room", "priority", "status",
                "visit_id", "appointment_id",
            ),
        }),
        ("Surgery Details", {
            "fields": (
                "surgery_name", "surgery_category", "icd_procedure_code",
                "diagnosis", "planned_procedure", "special_requirements", "equipment_needed",
            ),
        }),
        ("Scheduling", {
            "fields": (
                "scheduled_date", "scheduled_start", "scheduled_end",
                "actual_start", "actual_end",
            ),
        }),
        ("Surgical Team", {
            "fields": ("primary_surgeon", "anaesthesiologist", "team_members"),
        }),
        ("Ward / Bed", {
            "fields": ("ward", "bed_number"),
        }),
        ("Administrative", {
            "fields": ("booked_by", "booking_notes", "cancellation_reason"),
        }),
    )


# ---------------------------------------------------------------------------
# Pre-Op Assessment
# ---------------------------------------------------------------------------

@admin.register(PreOpAssessment)
class PreOpAssessmentAdmin(admin.ModelAdmin):
    list_display = (
        "booking", "assessed_by", "asa_grade",
        "fitness_status", "informed_consent_obtained", "created_at",
    )
    list_filter = ("asa_grade", "fitness_status", "informed_consent_obtained", "latex_allergy")
    search_fields = (
        "booking__booking_number", "booking__patient__full_name", "booking__patient__mrn",
    )
    raw_id_fields = ("booking", "assessed_by")


# ---------------------------------------------------------------------------
# Surgical Safety Checklist
# ---------------------------------------------------------------------------

@admin.register(SurgicalSafetyChecklist)
class SurgicalSafetyChecklistAdmin(admin.ModelAdmin):
    list_display = ("booking", "phase", "completed", "completed_by", "completed_at")
    list_filter = ("phase", "completed")
    search_fields = ("booking__booking_number",)
    readonly_fields = ("completed_at",)


# ---------------------------------------------------------------------------
# Intraoperative Record
# ---------------------------------------------------------------------------

class IntraopVitalInline(admin.TabularInline):
    model = IntraopVital
    extra = 0
    fields = (
        "recorded_at", "bp_systolic", "bp_diastolic",
        "heart_rate", "spo2", "temperature", "etco2",
        "respiratory_rate", "notes",
    )


class DrugAdministrationInline(admin.TabularInline):
    model = DrugAdministration
    extra = 0
    fields = (
        "drug_name", "dose", "unit", "route",
        "administered_at", "administered_by", "indication",
    )


class BloodProductUsedInline(admin.TabularInline):
    model = BloodProductUsed
    extra = 0
    fields = (
        "product_type", "units", "volume_ml", "blood_group",
        "cross_match_number", "bag_number", "transfused_at", "reaction_occurred",
    )


class SpecimenCollectedInline(admin.TabularInline):
    model = SpecimenCollected
    extra = 0
    fields = (
        "specimen_type", "description", "site",
        "sent_to_lab", "lab_request_number", "collected_at",
    )
    readonly_fields = ("collected_at",)


@admin.register(IntraoperativeRecord)
class IntraoperativeRecordAdmin(admin.ModelAdmin):
    list_display = (
        "booking", "wound_classification", "iv_fluids_ml",
        "estimated_blood_loss_ml", "drain_placed",
        "instrument_count_correct", "sponge_count_correct", "needle_count_correct",
        "documented_by",
    )
    list_filter = ("wound_classification", "drain_placed", "instrument_count_correct")
    search_fields = ("booking__booking_number", "booking__patient__full_name")
    raw_id_fields = ("booking", "documented_by")
    inlines = [
        IntraopVitalInline,
        DrugAdministrationInline,
        BloodProductUsedInline,
        SpecimenCollectedInline,
    ]


@admin.register(IntraopVital)
class IntraopVitalAdmin(admin.ModelAdmin):
    list_display = (
        "intraop_record", "recorded_at",
        "bp_systolic", "bp_diastolic", "heart_rate", "spo2", "temperature",
    )
    list_filter = ("recorded_at",)
    search_fields = ("intraop_record__booking__booking_number",)
    ordering = ("intraop_record", "recorded_at")


@admin.register(DrugAdministration)
class DrugAdministrationAdmin(admin.ModelAdmin):
    list_display = (
        "drug_name", "dose", "unit", "route",
        "administered_at", "administered_by", "intraop_record",
    )
    list_filter = ("route",)
    search_fields = (
        "drug_name", "intraop_record__booking__booking_number",
    )


@admin.register(BloodProductUsed)
class BloodProductUsedAdmin(admin.ModelAdmin):
    list_display = (
        "product_type", "units", "blood_group",
        "transfused_at", "reaction_occurred", "intraop_record",
    )
    list_filter = ("product_type", "reaction_occurred")
    search_fields = ("cross_match_number", "bag_number", "intraop_record__booking__booking_number")


@admin.register(SpecimenCollected)
class SpecimenCollectedAdmin(admin.ModelAdmin):
    list_display = (
        "specimen_type", "description", "site",
        "sent_to_lab", "lab_request_number", "collected_at",
    )
    list_filter = ("specimen_type", "sent_to_lab")
    search_fields = ("description", "lab_request_number", "intraop_record__booking__booking_number")
    readonly_fields = ("collected_at",)


# ---------------------------------------------------------------------------
# Implant Log
# ---------------------------------------------------------------------------

@admin.register(ImplantLog)
class ImplantLogAdmin(admin.ModelAdmin):
    list_display = (
        "implant_name", "manufacturer", "batch_number",
        "quantity", "unit_cost", "expiry_date", "booking", "recorded_at",
    )
    list_filter = ("manufacturer",)
    search_fields = (
        "implant_name", "batch_number", "serial_number",
        "booking__booking_number",
    )
    readonly_fields = ("recorded_at",)
    raw_id_fields = ("booking", "recorded_by")


# ---------------------------------------------------------------------------
# Anaesthesia Record
# ---------------------------------------------------------------------------

@admin.register(AnaesthesiaRecord)
class AnaesthesiaRecordAdmin(admin.ModelAdmin):
    list_display = (
        "booking", "anaesthesiologist", "anaesthesia_type",
        "airway_management", "difficult_intubation",
        "nausea_vomiting", "created_at",
    )
    list_filter = (
        "anaesthesia_type", "airway_management",
        "difficult_intubation", "nausea_vomiting",
        "nerve_stimulator_used", "ultrasound_guided",
    )
    search_fields = (
        "booking__booking_number", "booking__patient__full_name",
        "anaesthesiologist__user__last_name",
    )
    raw_id_fields = ("booking", "anaesthesiologist")


# ---------------------------------------------------------------------------
# Post-Op Orders
# ---------------------------------------------------------------------------

@admin.register(PostOpOrder)
class PostOpOrderAdmin(admin.ModelAdmin):
    list_display = (
        "booking", "order_type", "order_text",
        "frequency", "ordered_by", "ordered_at", "is_active",
    )
    list_filter = ("order_type", "is_active")
    search_fields = ("booking__booking_number", "order_text")
    readonly_fields = ("ordered_at",)
    raw_id_fields = ("booking", "ordered_by")


# ---------------------------------------------------------------------------
# Recovery Room Record
# ---------------------------------------------------------------------------

@admin.register(RecoveryRoomRecord)
class RecoveryRoomRecordAdmin(admin.ModelAdmin):
    list_display = (
        "booking", "admission_time", "discharge_time",
        "aldrete_score_admission", "aldrete_score_discharge",
        "pain_score", "vitals_stable", "transferred_to",
    )
    list_filter = ("vitals_stable", "transferred_to")
    search_fields = (
        "booking__booking_number", "booking__patient__full_name",
        "transfer_ward",
    )
    raw_id_fields = ("booking", "nurse_in_charge")


# ---------------------------------------------------------------------------
# Operative Note
# ---------------------------------------------------------------------------

@admin.register(OperativeNote)
class OperativeNoteAdmin(admin.ModelAdmin):
    list_display = (
        "booking", "procedure_name", "anaesthesia_given",
        "dictated_by", "signed_at", "created_at",
    )
    list_filter = ("signed_at",)
    search_fields = (
        "booking__booking_number", "booking__patient__full_name",
        "procedure_name",
    )
    raw_id_fields = ("booking", "dictated_by")
    readonly_fields = ("signed_at",)


# ---------------------------------------------------------------------------
# OT Bill
# ---------------------------------------------------------------------------

@admin.register(OTBill)
class OTBillAdmin(admin.ModelAdmin):
    list_display = (
        "booking", "total_amount", "status",
        "ot_charges", "surgeon_fee", "anaesthesia_fee",
        "implant_charges", "prepared_by", "created_at",
    )
    list_filter = ("status",)
    search_fields = ("booking__booking_number", "booking__patient__full_name")
    raw_id_fields = ("booking", "prepared_by")
    readonly_fields = ("total_amount",)
    fieldsets = (
        ("Booking", {
            "fields": ("booking", "status", "prepared_by", "billing_notes"),
        }),
        ("Charges", {
            "fields": (
                "ot_charges", "surgeon_fee", "anaesthesia_fee",
                "assistant_surgeon_fee", "nursing_charges",
                "supply_charges", "implant_charges",
                "blood_product_charges", "other_charges",
                "total_amount",
            ),
        }),
    )


# ---------------------------------------------------------------------------
# Surgical Outcome
# ---------------------------------------------------------------------------

@admin.register(SurgicalOutcome)
class SurgicalOutcomeAdmin(admin.ModelAdmin):
    list_display = (
        "booking", "wound_class", "ssi_occurred",
        "reoperation_required", "icu_admission",
        "thirty_day_outcome", "thirty_day_mortality", "created_at",
    )
    list_filter = (
        "wound_class", "ssi_occurred",
        "reoperation_required", "icu_admission",
        "thirty_day_outcome", "thirty_day_mortality",
    )
    search_fields = (
        "booking__booking_number", "booking__patient__full_name",
        "trainee_surgeon__user__last_name",
    )
    raw_id_fields = ("booking", "trainee_surgeon", "recorded_by")


# ---------------------------------------------------------------------------
# OT Inventory
# ---------------------------------------------------------------------------

@admin.register(OTInventoryItem)
class OTInventoryItemAdmin(admin.ModelAdmin):
    list_display = (
        "name", "category", "sku", "unit",
        "quantity_in_stock", "reorder_level", "unit_cost",
        "needs_reorder", "is_active",
    )
    list_filter = ("category", "unit", "is_active")
    search_fields = ("name", "sku", "manufacturer")
    ordering = ("category", "name")

    @admin.display(boolean=True, description="Needs Reorder?")
    def needs_reorder(self, obj):
        return obj.needs_reorder


# ---------------------------------------------------------------------------
# CSSD Batch
# ---------------------------------------------------------------------------

@admin.register(CSSDBatch)
class CSSDBatchAdmin(admin.ModelAdmin):
    list_display = (
        "batch_number", "instrument_set_name",
        "sterilization_method", "sterilization_date",
        "expiry_date", "status", "ot_booking",
    )
    list_filter = ("status", "sterilization_method")
    search_fields = (
        "batch_number", "instrument_set_name",
        "ot_booking__booking_number",
    )
    raw_id_fields = ("ot_booking",)
    date_hierarchy = "sterilization_date"
