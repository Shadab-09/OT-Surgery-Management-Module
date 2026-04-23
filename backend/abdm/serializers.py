from rest_framework import serializers
from core.models import Patient
from .models import ABHAProfile, CareContext, HealthRecordLink, ConsentRequest, ABDMTransaction


class ABHAProfileSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_mrn = serializers.CharField(source="patient.mrn", read_only=True)

    class Meta:
        model = ABHAProfile
        fields = [
            "id", "patient", "patient_name", "patient_mrn",
            "abha_number", "abha_address",
            "first_name", "middle_name", "last_name",
            "mobile", "email", "gender", "date_of_birth",
            "kyc_verified", "kyc_method", "photo_base64",
            "eka_care_user_id", "linked_at",
            "created_at",
        ]
        read_only_fields = fields  # profiles are created only via the enrolment flow


class CareContextSerializer(serializers.ModelSerializer):
    abha_address = serializers.CharField(source="abha.abha_address", read_only=True)

    class Meta:
        model = CareContext
        fields = ["id", "abha", "abha_address", "reference", "display",
                  "hi_types", "linked_at", "eka_context_id", "created_at"]


class HealthRecordLinkSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    care_context_ref = serializers.CharField(source="care_context.reference", read_only=True)

    class Meta:
        model = HealthRecordLink
        fields = ["id", "patient", "patient_name",
                  "care_context", "care_context_ref",
                  "visit_id", "record_type", "status",
                  "eka_request_id", "eka_response", "error",
                  "sent_at", "acked_at", "created_at"]
        read_only_fields = fields


class ConsentRequestSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)

    class Meta:
        model = ConsentRequest
        fields = ["id", "patient", "patient_name", "requester_name", "requester_id",
                  "purpose", "hi_types", "date_from", "date_to", "expires_at",
                  "status", "consent_request_id", "consent_artefact_id", "reason",
                  "created_at"]
        read_only_fields = ["status", "consent_request_id", "consent_artefact_id"]


class ABDMTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ABDMTransaction
        fields = ["id", "kind", "patient", "request_id", "endpoint",
                  "request_body", "response_body", "http_status", "ok",
                  "error", "created_at"]


# ── Action payload serializers ──────────────────────────────────────

class StartAadhaarSerializer(serializers.Serializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())
    aadhaar = serializers.CharField(min_length=12, max_length=14)


class VerifyAadhaarSerializer(serializers.Serializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())
    txn_id = serializers.CharField()
    otp = serializers.CharField(min_length=4, max_length=10)
    mobile = serializers.CharField(required=False, allow_blank=True)
    preferred_abha_address = serializers.CharField(required=False, allow_blank=True)


class StartMobileSerializer(serializers.Serializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())
    mobile = serializers.CharField(min_length=10, max_length=14)


class VerifyMobileSerializer(serializers.Serializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())
    txn_id = serializers.CharField()
    otp = serializers.CharField(min_length=4, max_length=10)


class ConsentInitSerializer(serializers.Serializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all())
    abha_address = serializers.CharField()
    purpose = serializers.ChoiceField(choices=ConsentRequest.PURPOSE_CHOICES, default="CAREMGT")
    hi_types = serializers.ListField(child=serializers.CharField(), default=list)
    days_valid = serializers.IntegerField(default=30, min_value=1, max_value=365)
