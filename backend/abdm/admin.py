from django.contrib import admin
from .models import ABHAProfile, CareContext, HealthRecordLink, ConsentRequest, ABDMTransaction


@admin.register(ABHAProfile)
class ABHAProfileAdmin(admin.ModelAdmin):
    list_display = ("abha_address", "abha_number", "patient", "kyc_verified", "linked_at")
    search_fields = ("abha_number", "abha_address", "patient__full_name", "patient__mrn")
    list_filter = ("kyc_verified", "kyc_method")


@admin.register(CareContext)
class CareContextAdmin(admin.ModelAdmin):
    list_display = ("reference", "abha", "display", "linked_at", "eka_context_id")
    search_fields = ("reference", "display", "abha__abha_address")


@admin.register(HealthRecordLink)
class HealthRecordLinkAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "record_type", "status", "eka_request_id", "sent_at")
    list_filter = ("status", "record_type")
    search_fields = ("patient__full_name", "eka_request_id")


@admin.register(ConsentRequest)
class ConsentRequestAdmin(admin.ModelAdmin):
    list_display = ("consent_request_id", "patient", "purpose", "status", "expires_at")
    list_filter = ("status", "purpose")
    search_fields = ("consent_request_id", "patient__full_name")


@admin.register(ABDMTransaction)
class ABDMTransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "kind", "patient", "ok", "http_status", "created_at")
    list_filter = ("kind", "ok")
    search_fields = ("request_id", "endpoint", "patient__full_name")
    readonly_fields = ("request_body", "response_body")
