from django.contrib import admin
from .models import Token, TokenEvent, QueueCounter


@admin.register(Token)
class TokenAdmin(admin.ModelAdmin):
    list_display = ("number", "department", "service", "priority", "status", "counter", "issued_at", "called_at", "completed_at")
    list_filter = ("status", "priority", "channel", "department", "service")
    search_fields = ("number", "patient__full_name", "patient__mrn")
    readonly_fields = ("number", "sequence", "issued_at", "called_at", "started_at", "completed_at")


@admin.register(TokenEvent)
class TokenEventAdmin(admin.ModelAdmin):
    list_display = ("token", "event", "actor", "counter", "created_at")
    list_filter = ("event",)


@admin.register(QueueCounter)
class QueueCounterAdmin(admin.ModelAdmin):
    list_display = ("department", "date", "last_normal_seq", "last_priority_seq")
    list_filter = ("department", "date")
