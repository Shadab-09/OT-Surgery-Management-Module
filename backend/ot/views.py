"""OT ViewSets — thin REST layer that delegates business logic to ot.services."""
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import (
    OTRoom,
    SurgicalTeamMember,
    OTBooking,
    PreOpAssessment,
    SurgicalSafetyChecklist,
    IntraoperativeRecord,
    IntraopVital,
    DrugAdministration,
    BloodProductUsed,
    SpecimenCollected,
    ImplantLog,
    AnaesthesiaRecord,
    PostOpOrder,
    RecoveryRoomRecord,
    OperativeNote,
    OTBill,
    SurgicalOutcome,
    OTInventoryItem,
    CSSDBatch,
)
from .serializers import (
    OTRoomSerializer,
    SurgicalTeamMemberSerializer,
    OTBookingListSerializer,
    OTBookingSerializer,
    PreOpAssessmentSerializer,
    SurgicalSafetyChecklistSerializer,
    IntraoperativeRecordSerializer,
    IntraopVitalSerializer,
    DrugAdministrationSerializer,
    BloodProductUsedSerializer,
    SpecimenCollectedSerializer,
    ImplantLogSerializer,
    AnaesthesiaRecordSerializer,
    PostOpOrderSerializer,
    RecoveryRoomRecordSerializer,
    OperativeNoteSerializer,
    OTBillSerializer,
    SurgicalOutcomeSerializer,
    OTInventoryItemSerializer,
    CSSDBatchSerializer,
)
from . import services as ot_services


# ---------------------------------------------------------------------------
# OT Room
# ---------------------------------------------------------------------------

class OTRoomViewSet(viewsets.ModelViewSet):
    queryset = OTRoom.objects.select_related("department").all()
    serializer_class = OTRoomSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["room_type", "status", "is_active", "department"]
    search_fields = ["name", "room_number"]
    ordering_fields = ["room_number", "name"]

    @action(detail=False, methods=["get"], url_path="available")
    def available(self, request):
        """Return rooms that are currently available and active."""
        qs = self.get_queryset().filter(status="available", is_active=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Surgical Team Member
# ---------------------------------------------------------------------------

class SurgicalTeamMemberViewSet(viewsets.ModelViewSet):
    queryset = SurgicalTeamMember.objects.select_related("user").all()
    serializer_class = SurgicalTeamMemberSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["role", "is_active"]
    search_fields = ["user__first_name", "user__last_name", "registration_number"]


# ---------------------------------------------------------------------------
# OT Booking
# ---------------------------------------------------------------------------

class OTBookingViewSet(viewsets.ModelViewSet):
    queryset = OTBooking.objects.select_related(
        "patient",
        "room",
        "primary_surgeon",
        "primary_surgeon__user",
        "anaesthesiologist",
        "anaesthesiologist__user",
        "booked_by",
    ).all()
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "priority", "room", "surgery_category", "scheduled_date", "primary_surgeon"]
    search_fields = ["booking_number", "patient__full_name", "patient__mrn", "surgery_name"]
    ordering_fields = ["scheduled_date", "scheduled_start", "created_at"]

    def get_serializer_class(self):
        if self.action == "list":
            return OTBookingListSerializer
        return OTBookingSerializer

    def create(self, request, *args, **kwargs):
        """Delegate booking creation to the service layer for conflict checking."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        vd = serializer.validated_data

        try:
            booking = ot_services.create_booking(
                room=vd["room"],
                patient=vd["patient"],
                surgery_name=vd["surgery_name"],
                surgery_category=vd.get("surgery_category", ""),
                priority=vd.get("priority", "elective"),
                scheduled_date=vd["scheduled_date"],
                scheduled_start=vd["scheduled_start"],
                scheduled_end=vd.get("scheduled_end", vd["scheduled_start"]),
                primary_surgeon=vd["primary_surgeon"],
                diagnosis=vd.get("diagnosis", ""),
                planned_procedure=vd.get("planned_procedure", ""),
                booked_by=request.user if request.user.is_authenticated else None,
                # Forward any optional fields present in validated data
                **{
                    k: v for k, v in vd.items()
                    if k not in {
                        "room", "patient", "surgery_name", "surgery_category",
                        "priority", "scheduled_date", "scheduled_start",
                        "scheduled_end", "primary_surgeon", "diagnosis",
                        "planned_procedure",
                    }
                },
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        out = OTBookingSerializer(booking, context=self.get_serializer_context())
        return Response(out.data, status=status.HTTP_201_CREATED)

    # ── Custom actions ────────────────────────────────────────────────────

    @action(detail=False, methods=["get"], url_path="today")
    def today(self, request):
        """Return today's bookings ordered by room and start time."""
        today = timezone.localdate()
        qs = ot_services.get_daily_ot_schedule(today)
        serializer = OTBookingListSerializer(qs, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        """Return aggregated OT dashboard statistics."""
        return Response(ot_services.get_ot_dashboard_stats())

    @action(detail=True, methods=["post"], url_path="start")
    def start(self, request, pk=None):
        """Start the surgery — transitions booking to in_progress."""
        booking = self.get_object()
        try:
            booking = ot_services.start_surgery(booking)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OTBookingSerializer(booking, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        """Mark surgery as completed."""
        booking = self.get_object()
        try:
            booking = ot_services.complete_surgery(booking)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OTBookingSerializer(booking, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Cancel a booking."""
        booking = self.get_object()
        reason = request.data.get("reason", "")
        booking = ot_services.cancel_booking(booking, reason=reason)
        return Response(OTBookingSerializer(booking, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="postpone")
    def postpone(self, request, pk=None):
        """Postpone a booking to a new date/time slot."""
        booking = self.get_object()
        new_date = request.data.get("new_date")
        new_start = request.data.get("new_start")
        new_end = request.data.get("new_end")
        reason = request.data.get("reason", "")

        if not all([new_date, new_start, new_end]):
            return Response(
                {"detail": "new_date, new_start, and new_end are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            booking = ot_services.postpone_booking(
                booking,
                new_date=new_date,
                new_start=new_start,
                new_end=new_end,
                reason=reason,
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OTBookingSerializer(booking, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"], url_path="init-checklist")
    def init_checklist(self, request, pk=None):
        """Initialise all three WHO safety checklist phases for this booking."""
        booking = self.get_object()
        created = ot_services.initialize_safety_checklist(booking)
        serializer = SurgicalSafetyChecklistSerializer(
            created, many=True, context=self.get_serializer_context()
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        """Return the full clinical timeline for a booking."""
        booking = self.get_object()
        ctx = self.get_serializer_context()

        # OneToOne relations use try/except to handle DoesNotExist gracefully
        def _one_to_one(attr, serializer_cls):
            try:
                obj = getattr(booking, attr)
                return serializer_cls(obj, context=ctx).data
            except Exception:
                return None

        safety_checklists = SurgicalSafetyChecklistSerializer(
            booking.safety_checklists.all(), many=True, context=ctx
        ).data

        return Response({
            "booking": OTBookingSerializer(booking, context=ctx).data,
            "pre_op_assessment": _one_to_one("pre_op_assessment", PreOpAssessmentSerializer),
            "safety_checklists": safety_checklists,
            "intraop_record": _one_to_one("intraop_record", IntraoperativeRecordSerializer),
            "anaesthesia_record": _one_to_one("anaesthesia_record", AnaesthesiaRecordSerializer),
            "operative_note": _one_to_one("operative_note", OperativeNoteSerializer),
            "recovery_record": _one_to_one("recovery_record", RecoveryRoomRecordSerializer),
            "ot_bill": _one_to_one("ot_bill", OTBillSerializer),
            "surgical_outcome": _one_to_one("surgical_outcome", SurgicalOutcomeSerializer),
        })


# ---------------------------------------------------------------------------
# Pre-Op Assessment
# ---------------------------------------------------------------------------

class PreOpAssessmentViewSet(viewsets.ModelViewSet):
    queryset = PreOpAssessment.objects.select_related("booking", "assessed_by").all()
    serializer_class = PreOpAssessmentSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["booking", "fitness_status", "asa_grade"]


# ---------------------------------------------------------------------------
# Surgical Safety Checklist
# ---------------------------------------------------------------------------

class SurgicalSafetyChecklistViewSet(viewsets.ModelViewSet):
    queryset = SurgicalSafetyChecklist.objects.select_related("booking", "completed_by").all()
    serializer_class = SurgicalSafetyChecklistSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["booking", "phase", "completed"]

    @action(detail=True, methods=["post"], url_path="complete-phase")
    def complete_phase(self, request, pk=None):
        """Mark a checklist phase as completed, optionally updating item values."""
        checklist = self.get_object()
        checklist.completed = True
        checklist.completed_by = request.user if request.user.is_authenticated else None
        checklist.completed_at = timezone.now()

        # Merge any supplied item values into the stored items dict
        incoming_items = request.data.get("items", {})
        if isinstance(incoming_items, dict):
            current_items = dict(checklist.items or {})
            current_items.update(incoming_items)
            checklist.items = current_items

        checklist.save()
        serializer = self.get_serializer(checklist)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Intraoperative Record
# ---------------------------------------------------------------------------

class IntraoperativeRecordViewSet(viewsets.ModelViewSet):
    queryset = IntraoperativeRecord.objects.select_related(
        "booking", "documented_by",
    ).prefetch_related(
        "vitals", "drug_administrations", "blood_products", "specimens",
    ).all()
    serializer_class = IntraoperativeRecordSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["booking"]

    @action(detail=True, methods=["post"], url_path="add-vital")
    def add_vital(self, request, pk=None):
        """Add a vital-signs reading to this intraoperative record."""
        intraop = self.get_object()
        data = {**request.data, "intraop_record": intraop.pk}
        serializer = IntraopVitalSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(intraop_record=intraop)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-drug")
    def add_drug(self, request, pk=None):
        """Record a drug administration event."""
        intraop = self.get_object()
        data = {**request.data, "intraop_record": intraop.pk}
        serializer = DrugAdministrationSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(intraop_record=intraop)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-blood-product")
    def add_blood_product(self, request, pk=None):
        """Record a blood product transfusion."""
        intraop = self.get_object()
        data = {**request.data, "intraop_record": intraop.pk}
        serializer = BloodProductUsedSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(intraop_record=intraop)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="add-specimen")
    def add_specimen(self, request, pk=None):
        """Record a specimen collected during the procedure."""
        intraop = self.get_object()
        data = {**request.data, "intraop_record": intraop.pk}
        serializer = SpecimenCollectedSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(intraop_record=intraop)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Implant Log
# ---------------------------------------------------------------------------

class ImplantLogViewSet(viewsets.ModelViewSet):
    queryset = ImplantLog.objects.select_related("booking", "recorded_by").all()
    serializer_class = ImplantLogSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["booking"]


# ---------------------------------------------------------------------------
# Anaesthesia Record
# ---------------------------------------------------------------------------

class AnaesthesiaRecordViewSet(viewsets.ModelViewSet):
    queryset = AnaesthesiaRecord.objects.select_related("booking", "anaesthesiologist").all()
    serializer_class = AnaesthesiaRecordSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["booking"]


# ---------------------------------------------------------------------------
# Post-Op Orders
# ---------------------------------------------------------------------------

class PostOpOrderViewSet(viewsets.ModelViewSet):
    queryset = PostOpOrder.objects.select_related("booking", "ordered_by").all()
    serializer_class = PostOpOrderSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["booking", "order_type", "is_active"]


# ---------------------------------------------------------------------------
# Recovery Room Record
# ---------------------------------------------------------------------------

class RecoveryRoomRecordViewSet(viewsets.ModelViewSet):
    queryset = RecoveryRoomRecord.objects.select_related("booking", "nurse_in_charge").all()
    serializer_class = RecoveryRoomRecordSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["booking"]


# ---------------------------------------------------------------------------
# Operative Note
# ---------------------------------------------------------------------------

class OperativeNoteViewSet(viewsets.ModelViewSet):
    queryset = OperativeNote.objects.select_related("booking", "dictated_by").all()
    serializer_class = OperativeNoteSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["booking"]

    @action(detail=True, methods=["post"], url_path="sign")
    def sign(self, request, pk=None):
        """Electronically sign the operative note."""
        note = self.get_object()
        note.signed_at = timezone.now()
        note.save()
        return Response(self.get_serializer(note).data)


# ---------------------------------------------------------------------------
# OT Bill
# ---------------------------------------------------------------------------

class OTBillViewSet(viewsets.ModelViewSet):
    queryset = OTBill.objects.select_related("booking", "prepared_by").all()
    serializer_class = OTBillSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["booking", "status"]

    @action(detail=True, methods=["post"], url_path="finalize")
    def finalize(self, request, pk=None):
        """Finalize the bill: recalculate total and lock status to 'finalized'."""
        bill = self.get_object()
        bill.status = "finalized"
        bill.calculate_and_save_total()
        return Response(self.get_serializer(bill).data)

    @action(detail=True, methods=["post"], url_path="recalculate")
    def recalculate(self, request, pk=None):
        """Recalculate all charge components from source data."""
        bill = self.get_object()
        updated_bill = ot_services.calculate_ot_bill(bill.booking)
        return Response(self.get_serializer(updated_bill).data)


# ---------------------------------------------------------------------------
# Surgical Outcome
# ---------------------------------------------------------------------------

class SurgicalOutcomeViewSet(viewsets.ModelViewSet):
    queryset = SurgicalOutcome.objects.select_related(
        "booking", "recorded_by", "trainee_surgeon"
    ).all()
    serializer_class = SurgicalOutcomeSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["booking", "ssi_occurred", "reoperation_required", "thirty_day_mortality"]


# ---------------------------------------------------------------------------
# OT Inventory
# ---------------------------------------------------------------------------

class OTInventoryViewSet(viewsets.ModelViewSet):
    queryset = OTInventoryItem.objects.all()
    serializer_class = OTInventoryItemSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["category", "is_active"]
    search_fields = ["name", "sku", "manufacturer"]
    ordering_fields = ["name", "category", "quantity_in_stock"]

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        """Return items where current stock is at or below the reorder level."""
        qs = self.get_queryset().extra(where=["quantity_in_stock <= reorder_level"])
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="adjust-stock")
    def adjust_stock(self, request, pk=None):
        """Add or subtract from current stock quantity (never goes below zero)."""
        item = self.get_object()
        try:
            qty = int(request.data.get("quantity", 0))
        except (TypeError, ValueError):
            return Response(
                {"detail": "quantity must be an integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action_type = request.data.get("action", "add")
        if action_type == "add":
            item.quantity_in_stock += qty
        elif action_type == "subtract":
            item.quantity_in_stock = max(0, item.quantity_in_stock - qty)
        else:
            return Response(
                {"detail": "action must be 'add' or 'subtract'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        item.save()
        return Response(self.get_serializer(item).data)


# ---------------------------------------------------------------------------
# CSSD Batch
# ---------------------------------------------------------------------------

class CSSDBatchViewSet(viewsets.ModelViewSet):
    queryset = CSSDBatch.objects.select_related("ot_booking").all()
    serializer_class = CSSDBatchSerializer
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["status", "ot_booking"]
    search_fields = ["batch_number", "instrument_set_name"]
    ordering_fields = ["sterilization_date", "expiry_date"]
