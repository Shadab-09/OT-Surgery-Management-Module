from django.db import models
from core.models import TimestampedModel, Patient
from queues.models import Token


class Notification(TimestampedModel):
    CHANNEL_SMS = "sms"
    CHANNEL_APP = "app"
    CHANNEL_EMAIL = "email"
    CHANNEL_DISPLAY = "display"
    CHANNEL_AUDIO = "audio"
    CHANNEL_CHOICES = [
        (CHANNEL_SMS, "SMS"),
        (CHANNEL_APP, "Mobile App Push"),
        (CHANNEL_EMAIL, "Email"),
        (CHANNEL_DISPLAY, "Display Board"),
        (CHANNEL_AUDIO, "Audio Announcement"),
    ]

    STATUS_QUEUED = "queued"
    STATUS_SENT = "sent"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_QUEUED, "Queued"),
        (STATUS_SENT, "Sent"),
        (STATUS_FAILED, "Failed"),
    ]

    token = models.ForeignKey(Token, null=True, blank=True, on_delete=models.CASCADE, related_name="notifications")
    patient = models.ForeignKey(Patient, null=True, blank=True, on_delete=models.CASCADE, related_name="notifications")
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    message = models.TextField()
    recipient = models.CharField(max_length=160, blank=True, help_text="Phone/email/display-id depending on channel")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_QUEUED)
    sent_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.channel} → {self.recipient or '—'} [{self.status}]"
