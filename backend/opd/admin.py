from django.contrib import admin
from .models import (
    Doctor, DoctorSchedule, Appointment, Visit, Vitals,
    Diagnosis, Prescription, PrescriptionItem, LabOrder,
)


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ("full_name", "department", "specialisation", "registration_number", "is_active")
    list_filter = ("department", "is_active", "specialisation")
    search_fields = ("full_name", "registration_number", "abha_address")


@admin.register(DoctorSchedule)
class DoctorScheduleAdmin(admin.ModelAdmin):
    list_display = ("doctor", "weekday", "start_time", "end_time", "slot_minutes", "room", "is_active")
    list_filter = ("weekday", "is_active", "doctor__department")


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("patient", "doctor", "scheduled_at", "status", "type", "booked_via")
    list_filter = ("status", "type", "booked_via", "doctor__department")
    search_fields = ("patient__full_name", "patient__mrn", "doctor__full_name")
    date_hierarchy = "scheduled_at"


class DiagnosisInline(admin.TabularInline):
    model = Diagnosis
    extra = 0


class PrescriptionItemInline(admin.TabularInline):
    model = PrescriptionItem
    extra = 0


class LabOrderInline(admin.TabularInline):
    model = LabOrder
    extra = 0


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = ("visit_number", "patient", "doctor", "status", "opened_at", "closed_at", "abdm_synced_at")
    list_filter = ("status", "doctor__department")
    search_fields = ("visit_number", "patient__full_name", "patient__mrn")
    inlines = [DiagnosisInline, LabOrderInline]
    date_hierarchy = "opened_at"


@admin.register(Vitals)
class VitalsAdmin(admin.ModelAdmin):
    list_display = ("visit", "temperature_c", "pulse_bpm", "systolic_bp", "diastolic_bp", "spo2", "bmi")


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ("visit", "signed_at", "created_at")
    inlines = [PrescriptionItemInline]


@admin.register(LabOrder)
class LabOrderAdmin(admin.ModelAdmin):
    list_display = ("test_name", "visit", "status", "urgency", "created_at")
    list_filter = ("status", "urgency")
