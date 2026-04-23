from rest_framework.routers import DefaultRouter
from .views import (
    ABHAProfileViewSet, CareContextViewSet, HealthRecordViewSet,
    ConsentViewSet, TransactionViewSet,
)

router = DefaultRouter()
router.register("abha", ABHAProfileViewSet, basename="abha")
router.register("care-contexts", CareContextViewSet, basename="care-context")
router.register("health-records", HealthRecordViewSet, basename="health-record")
router.register("consents", ConsentViewSet, basename="consent")
router.register("transactions", TransactionViewSet, basename="abdm-transaction")

urlpatterns = router.urls
