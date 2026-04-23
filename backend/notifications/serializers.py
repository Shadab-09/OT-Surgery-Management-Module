from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    token_number = serializers.CharField(source="token.number", read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)

    class Meta:
        model = Notification
        fields = ["id", "token", "token_number", "patient", "patient_name",
                  "channel", "message", "recipient", "status",
                  "sent_at", "error", "created_at"]
        read_only_fields = ["sent_at", "status", "error"]
