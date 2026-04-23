from datetime import datetime
from rest_framework import serializers
from django.utils import timezone

from core.models import Patient, Department
from core.serializers import PatientSerializer

from .models import (
    Doctor, DoctorSchedule, Appointment, Visit, Vitals,
    Diagnosis, Prescription, PrescriptionItem, LabOrder,
)


class DoctorScheduleSerializer(serializers.ModelSerializer):
    weekday_name = serializers.CharField(source="get_weekday_display", read_only=True)

    class Meta:
        model = DoctorSchedule
        fields = ["id", "doctor", "weekday", "weekday_name",
                  "start_time", "end_time", "slot_minutes", "room", "is_active"]


class DoctorSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)
    schedules = DoctorScheduleSerializer(many=True, read_only=True)

    class Meta:
        model = Doctor
        fields = ["id", "full_name", "registration_number", "specialisation",
                  "qualifications", "phone", "email", "abha_address", "hpr_id",
                  "consultation_fee", "avg_consult_minutes", "is_active",
                  "department", "department_name", "department_code",
                  "user", "schedules", "created_at"]


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)

    class Meta:
        model = Appointment
        fields = ["id", "patient", "patient_name", "patient_mrn",
                  "doctor", "doctor_name", "department", "department_code",
                  "scheduled_at", "slot_minutes", "type", "status", "reason",
                  "booked_via", "checked_in_at", "token_id", "created_at"]
        read_only_fields = ["status", "checked_in_at", "token_id", "department"]

    def validate(self, attrs):
        doctor = attrs.get("doctor") or (self.instance and self.instance.doctor)
        if doctor and not attrs.get("department"):
            attrs["department"] = doctor.department
        return attrs


class BookAppointmentSerializer(serializers.Serializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())
    doctor = serializers.PrimaryKeyRelatedField(queryset=Doctor.objects.filter(is_active=True))
    scheduled_at = serializers.DateTimeField()
    reason = serializers.CharField(allow_blank=True, required=False, default="")
    type = serializers.ChoiceField(
        choices=Appointment.TYPE_CHOICES, default=Appointment.TYPE_NEW,
    )
    booked_via = serializers.CharField(default="counter")


class VitalsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vitals
        fields = ["id", "visit", "temperature_c", "pulse_bpm",
                  "systolic_bp", "diastolic_bp", "respiratory_rate",
                  "spo2", "height_cm", "weight_kg", "bmi", "notes"]
        read_only_fields = ["bmi"]


class DiagnosisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagnosis
        fields = ["id", "visit", "kind", "description", "icd10_code", "snomed_code", "created_at"]


class PrescriptionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrescriptionItem
        fields = ["id", "drug_name", "strength", "route", "frequency",
                  "duration_days", "instructions", "rx_norm_code"]


class PrescriptionSerializer(serializers.ModelSerializer):
    items = PrescriptionItemSerializer(many=True, read_only=True)

    class Meta:
        model = Prescription
        fields = ["id", "visit", "notes", "signed_at", "items", "created_at"]


class UpsertPrescriptionSerializer(serializers.Serializer):
    notes = serializers.CharField(allow_blank=True, required=False, default="")
    items = PrescriptionItemSerializer(many=True, required=False, default=list)


class LabOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabOrder
        fields = ["id", "visit", "test_name", "test_code", "status", "urgency",
                  "notes", "result_value", "result_at", "created_at"]


class VisitSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)
    doctor_name = serializers.CharField(source="doctor.full_name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)
    vitals = VitalsSerializer(read_only=True)
    diagnoses = DiagnosisSerializer(many=True, read_only=True)
    prescription = PrescriptionSerializer(read_only=True)
    lab_orders = LabOrderSerializer(many=True, read_only=True)

    class Meta:
        model = Visit
        fields = ["id", "visit_number", "patient", "patient_name", "patient_mrn",
                  "doctor", "doctor_name", "department", "department_code",
                  "appointment", "status", "chief_complaints", "history",
                  "examination", "advice", "follow_up_on",
                  "opened_at", "closed_at", "abdm_care_context_ref", "abdm_synced_at",
                  "vitals", "diagnoses", "prescription", "lab_orders", "created_at"]
        read_only_fields = ["visit_number", "opened_at", "closed_at",
                            "abdm_care_context_ref", "abdm_synced_at"]


class StartVisitSerializer(serializers.Serializer):
    appointment = serializers.PrimaryKeyRelatedField(
        queryset=Appointment.objects.all(), required=False, allow_null=True,
    )
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all(), required=False)
    doctor = serializers.PrimaryKeyRelatedField(
        queryset=Doctor.objects.filter(is_active=True), required=False,
    )

    def validate(self, attrs):
        if not attrs.get("appointment") and not (attrs.get("patient") and attrs.get("doctor")):
            raise serializers.ValidationError(
                "Provide either `appointment`, or both `patient` and `doctor`."
            )
        return attrs
