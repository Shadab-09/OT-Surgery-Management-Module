from django.db import models
from core.models import TimestampedModel, Department


class DailyQueueStat(TimestampedModel):
    """Rolled-up daily metrics per department (populated on demand or by scheduled task)."""
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="daily_stats")
    date = models.DateField()
    tokens_issued = models.PositiveIntegerField(default=0)
    tokens_served = models.PositiveIntegerField(default=0)
    tokens_skipped = models.PositiveIntegerField(default=0)
    tokens_no_show = models.PositiveIntegerField(default=0)
    avg_wait_seconds = models.PositiveIntegerField(default=0)
    avg_service_seconds = models.PositiveIntegerField(default=0)
    avg_tat_seconds = models.PositiveIntegerField(default=0)
    peak_hour = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        unique_together = [("department", "date")]
        ordering = ["-date"]
