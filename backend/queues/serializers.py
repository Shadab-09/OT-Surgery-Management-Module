from rest_framework import serializers
from core.models import Department, Service, Counter, Patient
from core.serializers import PatientSerializer
from .models import Token, TokenEvent
from . import i18n


class TokenEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = TokenEvent
        fields = ["id", "event", "actor", "actor_name", "counter", "payload", "created_at"]

    def get_actor_name(self, obj):
        if obj.actor:
            return obj.actor.get_full_name() or obj.actor.username
        return None


class TokenSerializer(serializers.ModelSerializer):
    patient_detail = PatientSerializer(source="patient", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    counter_name = serializers.CharField(source="counter.name", read_only=True)
    wait_seconds = serializers.IntegerField(read_only=True)
    service_seconds = serializers.IntegerField(read_only=True)
    tat_seconds = serializers.IntegerField(read_only=True)
    is_priority = serializers.BooleanField(read_only=True)
    status_label = serializers.SerializerMethodField()
    priority_label = serializers.SerializerMethodField()
    channel_label = serializers.SerializerMethodField()
    announcement = serializers.SerializerMethodField()

    class Meta:
        model = Token
        fields = [
            "id", "number", "sequence",
            "patient", "patient_detail",
            "department", "department_name", "department_code",
            "service", "service_name",
            "counter", "counter_name",
            "channel", "channel_label",
            "priority", "priority_label", "is_priority",
            "status", "status_label",
            "issued_at", "called_at", "started_at", "completed_at",
            "skip_count", "notify_lead_minutes", "notified_at",
            "notes", "wait_seconds", "service_seconds", "tat_seconds",
            "announcement",
            "created_at",
        ]
        read_only_fields = [
            "number", "sequence", "status", "issued_at", "called_at",
            "started_at", "completed_at", "skip_count", "notified_at",
        ]

    def _lang(self) -> str:
        """Request-scoped language: ?lang=, Accept-Language, or patient pref."""
        ctx = self.context or {}
        if "language" in ctx:
            return i18n.normalize_language(ctx["language"])
        request = ctx.get("request")
        if request is not None:
            lang = i18n.resolve_request_language(request)
            if lang != i18n.DEFAULT_LANGUAGE:
                return lang
        return i18n.DEFAULT_LANGUAGE

    def _patient_lang(self, obj) -> str:
        """Fallback chain: request override > patient preferred language > en."""
        base = self._lang()
        if base != i18n.DEFAULT_LANGUAGE:
            return base
        if obj.patient_id and obj.patient and obj.patient.preferred_language:
            return i18n.normalize_language(obj.patient.preferred_language)
        return base

    def get_status_label(self, obj) -> str:
        return i18n.translate(f"status.{obj.status}", self._patient_lang(obj))

    def get_priority_label(self, obj) -> str:
        return i18n.translate(f"priority.{obj.priority}", self._patient_lang(obj))

    def get_channel_label(self, obj) -> str:
        return i18n.translate(f"channel.{obj.channel}", self._patient_lang(obj))

    def get_announcement(self, obj) -> str | None:
        if obj.status != Token.STATUS_CALLED or not obj.counter_id:
            return None
        counter_label = obj.counter.name if obj.counter else ""
        return i18n.announce(
            "announce.call", self._patient_lang(obj),
            token=obj.number, counter=counter_label,
        )


class IssueTokenSerializer(serializers.Serializer):
    """Input for POST /api/queues/tokens/issue/ — the Token Generation node."""
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.filter(is_active=True))
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.filter(is_active=True))
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all(), required=False, allow_null=True)
    channel = serializers.ChoiceField(choices=Token.CHANNEL_CHOICES, default=Token.CHANNEL_COUNTER)
    priority = serializers.ChoiceField(choices=Token.PRIORITY_CHOICES, default=Token.PRIORITY_NORMAL)
    notes = serializers.CharField(required=False, allow_blank=True)

    # Optional inline patient registration (kiosk / web flow)
    patient_mrn = serializers.CharField(required=False, allow_blank=True)
    patient_name = serializers.CharField(required=False, allow_blank=True)
    patient_phone = serializers.CharField(required=False, allow_blank=True)
    patient_is_elderly = serializers.BooleanField(required=False, default=False)
    patient_is_disabled = serializers.BooleanField(required=False, default=False)
    patient_language = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["service"].department_id != attrs["department"].id:
            raise serializers.ValidationError(
                {"service": "Service must belong to the selected department."}
            )
        return attrs

    def resolve_patient(self):
        """Return existing patient or create one from inline fields."""
        data = self.validated_data
        patient = data.get("patient")
        lang = i18n.normalize_language(data.get("patient_language") or "")
        if patient:
            if data.get("patient_language") and patient.preferred_language != lang:
                patient.preferred_language = lang
                patient.save(update_fields=["preferred_language", "updated_at"])
            return patient
        mrn = data.get("patient_mrn")
        name = data.get("patient_name")
        if not mrn and not name:
            return None
        if mrn:
            patient, created = Patient.objects.get_or_create(
                mrn=mrn,
                defaults={
                    "full_name": name or "Unknown",
                    "phone": data.get("patient_phone", ""),
                    "is_elderly": data.get("patient_is_elderly", False),
                    "is_disabled": data.get("patient_is_disabled", False),
                    "preferred_language": lang,
                },
            )
            return patient
        return Patient.objects.create(
            mrn=f"AUTO-{serializers.CharField().to_representation(name)[:8]}",
            full_name=name,
            phone=data.get("patient_phone", ""),
            is_elderly=data.get("patient_is_elderly", False),
            is_disabled=data.get("patient_is_disabled", False),
            preferred_language=lang,
        )


class CallNextSerializer(serializers.Serializer):
    counter = serializers.PrimaryKeyRelatedField(queryset=Counter.objects.all())


class CounterActionSerializer(serializers.Serializer):
    counter = serializers.PrimaryKeyRelatedField(queryset=Counter.objects.all(), required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
