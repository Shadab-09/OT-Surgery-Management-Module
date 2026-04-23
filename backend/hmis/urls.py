from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    HMISProviderViewSet, HMISPatientLinkViewSet,
    HMISAppointmentViewSet, HMISEncounterViewSet,
    HMISTransactionViewSet,
    HMISWebhookView, HMISHealthView,
)

router = DefaultRouter()
router.register("providers", HMISProviderViewSet, basename="hmis-provider")
router.register("patient-links", HMISPatientLinkViewSet, basename="hmis-patient-link")
router.register("appointments", HMISAppointmentViewSet, basename="hmis-appointment")
router.register("encounters", HMISEncounterViewSet, basename="hmis-encounter")
router.register("transactions", HMISTransactionViewSet, basename="hmis-transaction")

urlpatterns = router.urls + [
    path("webhook/<str:provider_code>/", HMISWebhookView.as_view(), name="hmis-webhook"),
    path("health/", HMISHealthView.as_view(), name="hmis-health"),
]
