from django.contrib import admin
from .models import DailyQueueStat


@admin.register(DailyQueueStat)
class DailyQueueStatAdmin(admin.ModelAdmin):
    list_display = ("date", "department", "tokens_issued", "tokens_served",
                    "avg_wait_seconds", "avg_tat_seconds")
    list_filter = ("department", "date")
