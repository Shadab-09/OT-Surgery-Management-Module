from rest_framework import serializers
from .models import DailyQueueStat


class DailyQueueStatSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = DailyQueueStat
        fields = ["id", "department", "department_name", "date",
                  "tokens_issued", "tokens_served", "tokens_skipped", "tokens_no_show",
                  "avg_wait_seconds", "avg_service_seconds", "avg_tat_seconds",
                  "peak_hour"]
