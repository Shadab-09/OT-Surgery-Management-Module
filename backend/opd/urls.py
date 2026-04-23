from rest_framework.routers import DefaultRouter
from .views import (
    DoctorViewSet, DoctorScheduleViewSet, AppointmentViewSet,
    VisitViewSet, DiagnosisViewSet, PrescriptionViewSet, LabOrderViewSet,
)

router = DefaultRouter()
router.register("doctors", DoctorViewSet, basename="doctor")
router.register("schedules", DoctorScheduleViewSet, basename="doctor-schedule")
router.register("appointments", AppointmentViewSet, basename="appointment")
router.register("visits", VisitViewSet, basename="visit")
router.register("diagnoses", DiagnosisViewSet, basename="diagnosis")
router.register("prescriptions", PrescriptionViewSet, basename="prescription")
router.register("lab-orders", LabOrderViewSet, basename="lab-order")

urlpatterns = router.urls
