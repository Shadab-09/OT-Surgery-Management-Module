"""DRF serializers for the OT (Operation Theatre) app.

Follows the project pattern:
- Denormalised read-only display fields via CharField(source=...)
- Nested read serializers on detail views
- Separate list/detail serializers where payload differs materially
"""
from rest_framework import serializers

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

class OTRoomSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = OTRoom
        fields = [
            "id", "name", "room_number", "room_type", "department", "department_name",
            "status", "equipment", "notes", "is_active", "created_at", "updated_at",
        ]


# ---------------------------------------------------------------------------
# Surgical Team Member
# ---------------------------------------------------------------------------

class SurgicalTeamMemberSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = SurgicalTeamMember
        fields = [
            "id", "user", "user_name", "user_username",
            "role", "specialization", "registration_number",
            "is_active", "created_at", "updated_at",
        ]


# ---------------------------------------------------------------------------
# OT Booking
# ---------------------------------------------------------------------------

class OTBookingListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views — avoids N+1 by using select_related fields."""

    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    room_name = serializers.CharField(source="room.name", read_only=True)
    primary_surgeon_name = serializers.CharField(
        source="primary_surgeon.user.get_full_name", read_only=True
    )

    class Meta:
        model = OTBooking
        fields = [
            "id", "booking_number",
            "patient", "patient_name", "patient_mrn",
            "room", "room_name",
            "surgery_name", "surgery_category", "priority", "status",
            "scheduled_date", "scheduled_start", "scheduled_end",
            "primary_surgeon", "primary_surgeon_name",
            "created_at",
        ]


class OTBookingSerializer(serializers.ModelSerializer):
    """Full detail serializer for create / retrieve / update."""

    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    room_name = serializers.CharField(source="room.name", read_only=True)
    room_number = serializers.CharField(source="room.room_number", read_only=True)
    primary_surgeon_name = serializers.CharField(
        source="primary_surgeon.user.get_full_name", read_only=True
    )

    class Meta:
        model = OTBooking
        fields = [
            "id", "booking_number",
            "patient", "patient_name", "patient_mrn",
            "room", "room_name", "room_number",
            "surgery_name", "surgery_category", "icd_procedure_code",
            "priority", "status",
            "scheduled_date", "scheduled_start", "scheduled_end",
            "actual_start", "actual_end",
            "primary_surgeon", "primary_surgeon_name",
            "anaesthesiologist", "team_members",
            "diagnosis", "planned_procedure", "special_requirements", "equipment_needed",
            "visit_id", "appointment_id",
            "ward", "bed_number",
            "booked_by", "booking_notes", "cancellation_reason",
            "created_at", "updated_at",
        ]
        read_only_fields = ["booking_number", "status", "actual_start", "actual_end"]
        extra_kwargs = {
            "surgery_category": {"required": False, "allow_blank": True},
            "diagnosis": {"required": False, "allow_blank": True},
            "planned_procedure": {"required": False, "allow_blank": True},
            "scheduled_end": {"required": False},
        }


# ---------------------------------------------------------------------------
# Pre-Op Assessment
# ---------------------------------------------------------------------------

class PreOpAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreOpAssessment
        fields = [
            "id", "booking", "assessed_by",
            "weight", "height", "bmi", "blood_group",
            "asa_grade", "airway_assessment",
            "allergies", "drug_allergies", "latex_allergy",
            "comorbidities", "current_medications", "last_meal_time",
            "haemoglobin", "platelet_count", "inr", "serum_creatinine",
            "investigations_note",
            "anaesthesia_type", "special_precautions", "pre_op_medications",
            "informed_consent_obtained", "consent_date", "consent_by",
            "fitness_status", "fitness_notes",
            "created_at", "updated_at",
        ]


# ---------------------------------------------------------------------------
# Surgical Safety Checklist
# ---------------------------------------------------------------------------

class SurgicalSafetyChecklistSerializer(serializers.ModelSerializer):
    completed_by_name = serializers.CharField(
        source="completed_by.get_full_name", read_only=True
    )

    class Meta:
        model = SurgicalSafetyChecklist
        fields = [
            "id", "booking", "phase",
            "completed", "completed_by", "completed_by_name",
            "completed_at", "items", "notes",
        ]


# ---------------------------------------------------------------------------
# Intraoperative sub-records
# ---------------------------------------------------------------------------

class IntraopVitalSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntraopVital
        fields = [
            "id", "intraop_record", "recorded_at",
            "bp_systolic", "bp_diastolic", "heart_rate",
            "spo2", "temperature", "etco2", "respiratory_rate", "notes",
        ]


class DrugAdministrationSerializer(serializers.ModelSerializer):
    administered_by_name = serializers.CharField(
        source="administered_by.get_full_name", read_only=True
    )

    class Meta:
        model = DrugAdministration
        fields = [
            "id", "intraop_record",
            "drug_name", "dose", "unit", "route",
            "administered_at", "administered_by", "administered_by_name",
            "indication", "notes",
        ]


class BloodProductUsedSerializer(serializers.ModelSerializer):
    class Meta:
        model = BloodProductUsed
        fields = [
            "id", "intraop_record",
            "product_type", "units", "volume_ml",
            "blood_group", "cross_match_number", "bag_number",
            "transfused_at", "reaction_occurred", "reaction_details",
        ]


class SpecimenCollectedSerializer(serializers.ModelSerializer):
    class Meta:
        model = SpecimenCollected
        fields = [
            "id", "intraop_record",
            "specimen_type", "description", "site",
            "sent_to_lab", "lab_request_number", "collected_at",
        ]


# ---------------------------------------------------------------------------
# Intraoperative Record (master)
# ---------------------------------------------------------------------------

class IntraoperativeRecordSerializer(serializers.ModelSerializer):
    vitals = IntraopVitalSerializer(many=True, read_only=True)
    drug_administrations = DrugAdministrationSerializer(many=True, read_only=True)
    blood_products = BloodProductUsedSerializer(many=True, read_only=True)
    specimens = SpecimenCollectedSerializer(many=True, read_only=True)

    class Meta:
        model = IntraoperativeRecord
        fields = [
            "id", "booking",
            "operative_findings", "procedure_performed",
            "iv_fluids_ml", "estimated_blood_loss_ml", "urine_output_ml",
            "wound_classification",
            "drain_placed", "drain_details",
            "instrument_count_correct", "sponge_count_correct", "needle_count_correct",
            "intraop_complications", "closure_technique", "suture_material",
            "documented_by",
            "vitals", "drug_administrations", "blood_products", "specimens",
            "created_at", "updated_at",
        ]


# ---------------------------------------------------------------------------
# Implant Log
# ---------------------------------------------------------------------------

class ImplantLogSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.CharField(
        source="recorded_by.get_full_name", read_only=True
    )

    class Meta:
        model = ImplantLog
        fields = [
            "id", "booking",
            "implant_name", "manufacturer", "batch_number",
            "lot_number", "serial_number", "size",
            "quantity", "unit_cost", "expiry_date", "body_site", "notes",
            "recorded_by", "recorded_by_name", "recorded_at",
        ]


# ---------------------------------------------------------------------------
# Anaesthesia Record
# ---------------------------------------------------------------------------

class AnaesthesiaRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnaesthesiaRecord
        fields = [
            "id", "booking", "anaesthesiologist",
            "anaesthesia_type", "airway_management", "airway_size",
            "induction_time", "intubation_time", "extubation_time",
            "induction_agents", "maintenance_agents", "reversal_agents",
            "regional_block_details", "nerve_stimulator_used", "ultrasound_guided",
            "monitoring_used", "lines_placed",
            "complications", "difficult_intubation", "intubation_attempts",
            "recovery_score_at_transfer", "post_op_pain_score", "nausea_vomiting",
            "notes",
            "created_at", "updated_at",
        ]


# ---------------------------------------------------------------------------
# Post-Op Orders
# ---------------------------------------------------------------------------

class PostOpOrderSerializer(serializers.ModelSerializer):
    ordered_by_name = serializers.CharField(
        source="ordered_by.get_full_name", read_only=True
    )

    class Meta:
        model = PostOpOrder
        fields = [
            "id", "booking", "order_type", "order_text",
            "frequency", "duration",
            "ordered_by", "ordered_by_name",
            "ordered_at", "is_active", "notes",
        ]


# ---------------------------------------------------------------------------
# Recovery Room Record
# ---------------------------------------------------------------------------

class RecoveryRoomRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecoveryRoomRecord
        fields = [
            "id", "booking",
            "admission_time", "discharge_time",
            "aldrete_score_admission", "aldrete_score_discharge",
            "pain_score", "vitals_stable", "medications_given", "complications",
            "transferred_to", "transfer_ward", "transfer_bed",
            "nurse_in_charge", "notes",
            "created_at", "updated_at",
        ]


# ---------------------------------------------------------------------------
# Operative Note
# ---------------------------------------------------------------------------

class OperativeNoteSerializer(serializers.ModelSerializer):
    dictated_by_name = serializers.CharField(
        source="dictated_by.user.get_full_name", read_only=True
    )

    class Meta:
        model = OperativeNote
        fields = [
            "id", "booking",
            "procedure_name", "indication", "anaesthesia_given",
            "patient_position", "incision",
            "operative_findings", "steps_performed",
            "implants_used", "specimens_sent",
            "blood_loss", "complications", "closure", "post_op_instructions",
            "dictated_by", "dictated_by_name",
            "signed_at",
            "created_at", "updated_at",
        ]


# ---------------------------------------------------------------------------
# OT Bill
# ---------------------------------------------------------------------------

class OTBillSerializer(serializers.ModelSerializer):
    class Meta:
        model = OTBill
        fields = [
            "id", "booking",
            "ot_charges", "surgeon_fee", "anaesthesia_fee",
            "assistant_surgeon_fee", "nursing_charges", "supply_charges",
            "implant_charges", "blood_product_charges", "other_charges",
            "total_amount", "status", "billing_notes",
            "prepared_by",
            "created_at", "updated_at",
        ]

    def validate(self, attrs):
        """Auto-calculate total from charge components when all are provided."""
        charge_fields = [
            "ot_charges", "surgeon_fee", "anaesthesia_fee",
            "assistant_surgeon_fee", "nursing_charges", "supply_charges",
            "implant_charges", "blood_product_charges", "other_charges",
        ]
        # Sum whichever charge fields are present in this request;
        # for updates, fall back to existing instance values.
        total = 0
        for field in charge_fields:
            value = attrs.get(field)
            if value is None and self.instance:
                value = getattr(self.instance, field, 0)
            if value is not None:
                total += value
        if any(f in attrs for f in charge_fields):
            attrs["total_amount"] = total
        return attrs


# ---------------------------------------------------------------------------
# Surgical Outcome
# ---------------------------------------------------------------------------

class SurgicalOutcomeSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurgicalOutcome
        fields = [
            "id", "booking",
            "wound_class",
            "ssi_occurred", "ssi_date", "ssi_type",
            "intraop_complications", "postop_complications",
            "reoperation_required", "reoperation_date", "reoperation_reason",
            "icu_admission", "icu_days", "hospital_stay_days",
            "thirty_day_outcome", "thirty_day_mortality", "mortality_cause",
            "trainee_surgeon", "trainee_role",
            "audit_notes", "recorded_by",
            "created_at", "updated_at",
        ]


# ---------------------------------------------------------------------------
# OT Inventory
# ---------------------------------------------------------------------------

class OTInventoryItemSerializer(serializers.ModelSerializer):
    needs_reorder = serializers.BooleanField(read_only=True)

    class Meta:
        model = OTInventoryItem
        fields = [
            "id", "name", "category", "sku", "manufacturer",
            "unit", "quantity_in_stock", "reorder_level",
            "unit_cost", "is_active", "notes",
            "needs_reorder",
            "created_at", "updated_at",
        ]


# ---------------------------------------------------------------------------
# CSSD Batch
# ---------------------------------------------------------------------------

class CSSDBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = CSSDBatch
        fields = [
            "id", "batch_number", "instrument_set_name",
            "sterilization_method", "sterilization_date", "expiry_date",
            "status", "ot_booking", "notes",
            "created_at", "updated_at",
        ]
