from rest_framework import serializers

from core.serializers import PatientSerializer
from queues.serializers import TokenSerializer
from .models import (
    HMISProvider, HMISPatientLink, HMISAppointment,
    HMISEncounter, HMISTransaction,
)


class HMISProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = HMISProvider
        fields = [
            "id", "code", "name", "kind", "base_url", "auth_type",
            "facility_id", "is_primary", "is_active",
            "created_at", "updated_at",
        ]
        # Credentials are write-only — GET never leaks secrets back to clients.
        extra_kwargs = {
            "client_id": {"write_only": True, "required": False},
            "client_secret": {"write_only": True, "required": False},
            "api_key": {"write_only": True, "required": False},
            "username": {"write_only": True, "required": False},
            "password": {"write_only": True, "required": False},
            "webhook_secret": {"write_only": True, "required": False},
        }


class HMISPatientLinkSerializer(serializers.ModelSerializer):
    patient_detail = PatientSerializer(source="patient", read_only=True)
    provider_code = serializers.CharField(source="provider.code", read_only=True)

    class Meta:
        model = HMISPatientLink
        fields = [
            "id", "provider", "provider_code", "patient", "patient_detail",
            "hmis_patient_id", "hmis_mrn", "payload", "last_synced_at",
            "created_at", "updated_at",
        ]


class HMISAppointmentSerializer(serializers.ModelSerializer):
    patient_detail = PatientSerializer(source="patient", read_only=True)
    token_detail = TokenSerializer(source="token", read_only=True)
    provider_code = serializers.CharField(source="provider.code", read_only=True)

    class Meta:
        model = HMISAppointment
        fields = [
            "id", "provider", "provider_code",
            "hmis_appointment_id", "patient", "patient_detail",
            "department_code", "service_code",
            "doctor_name", "doctor_hmis_id",
            "scheduled_at", "status",
            "token", "token_detail",
            "raw", "last_synced_at",
            "created_at", "updated_at",
        ]


class HMISEncounterSerializer(serializers.ModelSerializer):
    patient_detail = PatientSerializer(source="patient", read_only=True)
    provider_code = serializers.CharField(source="provider.code", read_only=True)

    class Meta:
        model = HMISEncounter
        fields = [
            "id", "provider", "provider_code",
            "patient", "patient_detail", "token",
            "hmis_encounter_id", "payload", "response",
            "status", "error", "sent_at", "acked_at",
            "created_at", "updated_at",
        ]


class HMISTransactionSerializer(serializers.ModelSerializer):
    provider_code = serializers.CharField(source="provider.code", read_only=True)

    class Meta:
        model = HMISTransaction
        fields = [
            "id", "provider", "provider_code",
            "direction", "operation", "method", "url",
            "response_status", "error", "created_at",
        ]


# ── Action-body serializers ─────────────────────────────────────────

class PatientLookupSerializer(serializers.Serializer):
    mrn = serializers.CharField(required=False, allow_blank=True)
    hmis_patient_id = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    provider = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not any(attrs.get(k) for k in ("mrn", "hmis_patient_id", "phone")):
            raise serializers.ValidationError("Provide at least one of mrn, hmis_patient_id, or phone.")
        return attrs


class PullAppointmentsSerializer(serializers.Serializer):
    department_code = serializers.CharField(required=False, allow_blank=True)
    date = serializers.CharField(required=False, allow_blank=True)
    provider = serializers.CharField(required=False, allow_blank=True)


class CheckInAppointmentSerializer(serializers.Serializer):
    channel = serializers.CharField(required=False, allow_blank=True)


class WebhookEventSerializer(serializers.Serializer):
    event = serializers.CharField()
    data = serializers.DictField(required=False, default=dict)
