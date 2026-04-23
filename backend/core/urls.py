from rest_framework.routers import DefaultRouter
from .views import (
    DepartmentViewSet, ServiceViewSet, CounterViewSet,
    PatientViewSet, DisplayBoardViewSet,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("services", ServiceViewSet, basename="service")
router.register("counters", CounterViewSet, basename="counter")
router.register("patients", PatientViewSet, basename="patient")
router.register("display-boards", DisplayBoardViewSet, basename="display-board")

urlpatterns = router.urls
