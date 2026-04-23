from rest_framework import serializers
from .models import Department, Service, Counter, Patient, DisplayBoard


class DepartmentSerializer(serializers.ModelSerializer):
    service_count = serializers.IntegerField(source="services.count", read_only=True)
    counter_count = serializers.IntegerField(source="counters.count", read_only=True)

    class Meta:
        model = Department
        fields = ["id", "name", "code", "description", "is_active",
                  "service_count", "counter_count", "created_at"]


class ServiceSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)

    class Meta:
        model = Service
        fields = ["id", "department", "department_name", "department_code",
                  "name", "code", "avg_service_minutes", "priority_enabled",
                  "is_active", "created_at"]


class CounterSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)
    operator_name = serializers.SerializerMethodField()
    service_names = serializers.SerializerMethodField()

    class Meta:
        model = Counter
        fields = ["id", "department", "department_name", "services", "service_names",
                  "name", "code", "status", "operator", "operator_name",
                  "location", "created_at"]

    def get_operator_name(self, obj):
        if obj.operator:
            return obj.operator.get_full_name() or obj.operator.username
        return None

    def get_service_names(self, obj):
        return [s.name for s in obj.services.all()]


class PatientSerializer(serializers.ModelSerializer):
    priority = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = ["id", "mrn", "full_name", "phone", "email",
                  "date_of_birth", "gender", "is_elderly", "is_disabled",
                  "preferred_language", "priority", "created_at"]

    def get_priority(self, obj):
        if obj.is_disabled:
            return "disabled"
        if obj.is_elderly:
            return "elderly"
        return "normal"


class DisplayBoardSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = DisplayBoard
        fields = ["id", "department", "department_name", "name", "location",
                  "audio_enabled", "language", "is_active", "created_at"]
