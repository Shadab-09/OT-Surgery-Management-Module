from django.contrib import admin

from .models import (
    HMISProvider, HMISPatientLink, HMISAppointment,
    HMISEncounter, HMISTransaction,
)


@admin.register(HMISProvider)
class HMISProviderAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "kind", "is_primary", "is_active")
    list_filter = ("kind", "is_primary", "is_active")
    search_fields = ("code", "name", "base_url")


@admin.register(HMISPatientLink)
class HMISPatientLinkAdmin(admin.ModelAdmin):
    list_display = ("hmis_patient_id", "hmis_mrn", "patient", "provider", "last_synced_at")
    search_fields = ("hmis_patient_id", "hmis_mrn", "patient__full_name", "patient__mrn")
    list_filter = ("provider",)
    raw_id_fields = ("patient",)


@admin.register(HMISAppointment)
class HMISAppointmentAdmin(admin.ModelAdmin):
    list_display = ("hmis_appointment_id", "patient", "department_code", "doctor_name",
                    "scheduled_at", "status")
    list_filter = ("provider", "status", "department_code")
    search_fields = ("hmis_appointment_id", "patient__full_name", "doctor_name")
    raw_id_fields = ("patient", "token")


@admin.register(HMISEncounter)
class HMISEncounterAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "token", "status", "sent_at", "acked_at")
    list_filter = ("provider", "status")
    search_fields = ("hmis_encounter_id", "patient__full_name", "patient__mrn")
    raw_id_fields = ("patient", "token")


@admin.register(HMISTransaction)
class HMISTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "provider", "direction", "operation", "response_status", "created_at")
    list_filter = ("provider", "direction", "operation")
    search_fields = ("url", "operation")
    readonly_fields = ("request_headers", "request_body", "response_body")
