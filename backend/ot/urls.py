from rest_framework.routers import DefaultRouter

from .views import (
    OTRoomViewSet,
    SurgicalTeamMemberViewSet,
    OTBookingViewSet,
    PreOpAssessmentViewSet,
    SurgicalSafetyChecklistViewSet,
    IntraoperativeRecordViewSet,
    ImplantLogViewSet,
    AnaesthesiaRecordViewSet,
    PostOpOrderViewSet,
    RecoveryRoomRecordViewSet,
    OperativeNoteViewSet,
    OTBillViewSet,
    SurgicalOutcomeViewSet,
    OTInventoryViewSet,
    CSSDBatchViewSet,
)

router = DefaultRouter()
router.register("rooms", OTRoomViewSet, basename="ot-room")
router.register("team-members", SurgicalTeamMemberViewSet, basename="ot-team-member")
router.register("bookings", OTBookingViewSet, basename="ot-booking")
router.register("pre-op-assessments", PreOpAssessmentViewSet, basename="ot-pre-op")
router.register("safety-checklists", SurgicalSafetyChecklistViewSet, basename="ot-checklist")
router.register("intraop-records", IntraoperativeRecordViewSet, basename="ot-intraop")
router.register("implants", ImplantLogViewSet, basename="ot-implant")
router.register("anaesthesia-records", AnaesthesiaRecordViewSet, basename="ot-anaesthesia")
router.register("post-op-orders", PostOpOrderViewSet, basename="ot-post-op")
router.register("recovery-records", RecoveryRoomRecordViewSet, basename="ot-recovery")
router.register("operative-notes", OperativeNoteViewSet, basename="ot-operative-note")
router.register("bills", OTBillViewSet, basename="ot-bill")
router.register("outcomes", SurgicalOutcomeViewSet, basename="ot-outcome")
router.register("inventory", OTInventoryViewSet, basename="ot-inventory")
router.register("cssd", CSSDBatchViewSet, basename="ot-cssd")

urlpatterns = router.urls
