from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("channel", "recipient", "status", "token", "sent_at", "created_at")
    list_filter = ("channel", "status")
    search_fields = ("recipient", "message")
