from django.contrib import admin
from .models import Department, Service, Counter, Patient, DisplayBoard


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_active", "created_at")
    search_fields = ("name", "code")
    list_filter = ("is_active",)


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "department", "avg_service_minutes", "priority_enabled", "is_active")
    list_filter = ("department", "is_active", "priority_enabled")
    search_fields = ("name", "code")


@admin.register(Counter)
class CounterAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "department", "status", "operator")
    list_filter = ("department", "status")
    filter_horizontal = ("services",)


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("mrn", "full_name", "phone", "gender", "is_elderly", "is_disabled")
    list_filter = ("gender", "is_elderly", "is_disabled")
    search_fields = ("mrn", "full_name", "phone", "email")


@admin.register(DisplayBoard)
class DisplayBoardAdmin(admin.ModelAdmin):
    list_display = ("name", "department", "location", "audio_enabled", "is_active")
    list_filter = ("department", "audio_enabled", "is_active")
