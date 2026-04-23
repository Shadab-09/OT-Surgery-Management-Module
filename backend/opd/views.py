from datetime import date as date_cls
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import (
    Doctor, DoctorSchedule, Appointment, Visit, Vitals,
    Diagnosis, Prescription, PrescriptionItem, LabOrder,
)
from .serializers import (
    DoctorSerializer, DoctorScheduleSerializer,
    AppointmentSerializer, BookAppointmentSerializer,
    VisitSerializer, StartVisitSerializer,
    VitalsSerializer, DiagnosisSerializer,
    PrescriptionSerializer, UpsertPrescriptionSerializer,
    LabOrderSerializer,
)
from . import services as opd_services


class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.select_related("department", "user").prefetch_related("schedules").all()
    serializer_class = DoctorSerializer
    filterset_fields = ["department", "is_active", "specialisation"]
    search_fields = ["full_name", "registration_number", "specialisation", "abha_address"]
    ordering_fields = ["full_name", "created_at"]

    @action(detail=True, methods=["get"], url_path="slots")
    def slots(self, request, pk=None):
        """Generate slots for a given ?date=YYYY-MM-DD (defaults to today)."""
        doctor = self.get_object()
        raw = request.query_params.get("date")
        try:
            on = date_cls.fromisoformat(raw) if raw else timezone.localdate()
        except ValueError:
            return Response({"date": "Expected YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "doctor": doctor.id, "doctor_name": doctor.full_name,
            "date": on.isoformat(), "slots": opd_services.generate_slots(doctor, on),
        })


class DoctorScheduleViewSet(viewsets.ModelViewSet):
    queryset = DoctorSchedule.objects.select_related("doctor", "doctor__department").all()
    serializer_class = DoctorScheduleSerializer
    filterset_fields = ["doctor", "weekday", "is_active"]


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.select_related(
        "patient", "doctor", "doctor__department", "department",
    ).all()
    serializer_class = AppointmentSerializer
    filterset_fields = ["doctor", "department", "patient", "status", "type"]
    search_fields = ["patient__full_name", "patient__mrn", "doctor__full_name"]
    ordering_fields = ["scheduled_at", "created_at"]

    @action(detail=False, methods=["post"], url_path="book")
    def book(self, request):
        s = BookAppointmentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            appt = opd_services.book_appointment(
                patient=s.validated_data["patient"],
                doctor=s.validated_data["doctor"],
                scheduled_at=s.validated_data["scheduled_at"],
                reason=s.validated_data.get("reason", ""),
                appointment_type=s.validated_data.get("type", Appointment.TYPE_NEW),
                booked_via=s.validated_data.get("booked_via", "counter"),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(AppointmentSerializer(appt).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        appt = self.get_object()
        try:
            appt = opd_services.check_in_appointment(
                appt, actor=request.user if request.user.is_authenticated else None,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(AppointmentSerializer(appt).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        appt = self.get_object()
        reason = request.data.get("reason", "")
        try:
            appt = opd_services.cancel_appointment(appt, reason=reason)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(AppointmentSerializer(appt).data)

    @action(detail=False, methods=["get"], url_path="today")
    def today(self, request):
        today = timezone.localdate()
        qs = self.filter_queryset(self.get_queryset()).filter(scheduled_at__date=today)
        return Response(AppointmentSerializer(qs, many=True).data)


class VisitViewSet(viewsets.ModelViewSet):
    queryset = Visit.objects.select_related(
        "patient", "doctor", "department", "appointment",
    ).prefetch_related("diagnoses", "lab_orders", "prescription__items").all()
    serializer_class = VisitSerializer
    filterset_fields = ["doctor", "department", "patient", "status", "appointment"]
    search_fields = ["visit_number", "patient__full_name", "patient__mrn"]
    ordering_fields = ["opened_at", "closed_at"]

    @action(detail=False, methods=["post"], url_path="start")
    def start(self, request):
        s = StartVisitSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        visit = opd_services.start_visit(
            appointment=s.validated_data.get("appointment"),
            patient=s.validated_data.get("patient"),
            doctor=s.validated_data.get("doctor"),
        )
        return Response(VisitSerializer(visit).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        visit = self.get_object()
        push = request.data.get("push_to_abdm", True)
        visit = opd_services.close_visit(visit, push_to_abdm=bool(push))
        return Response(VisitSerializer(visit).data)

    @action(detail=True, methods=["post", "put"], url_path="vitals")
    def set_vitals(self, request, pk=None):
        visit = self.get_object()
        data = {**request.data, "visit": visit.id}
        try:
            instance = visit.vitals
            s = VitalsSerializer(instance, data=data, partial=True)
        except Vitals.DoesNotExist:
            s = VitalsSerializer(data=data)
        s.is_valid(raise_exception=True)
        s.save(visit=visit)
        return Response(s.data)

    @action(detail=True, methods=["post"], url_path="diagnoses")
    def add_diagnosis(self, request, pk=None):
        visit = self.get_object()
        data = {**request.data, "visit": visit.id}
        s = DiagnosisSerializer(data=data)
        s.is_valid(raise_exception=True)
        s.save(visit=visit)
        return Response(s.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post", "put"], url_path="prescription")
    def set_prescription(self, request, pk=None):
        visit = self.get_object()
        s = UpsertPrescriptionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        rx = opd_services.upsert_prescription(
            visit,
            notes=s.validated_data.get("notes", ""),
            items=s.validated_data.get("items") or [],
        )
        return Response(PrescriptionSerializer(rx).data)

    @action(detail=True, methods=["post"], url_path="lab-orders")
    def add_lab_order(self, request, pk=None):
        visit = self.get_object()
        data = {**request.data, "visit": visit.id}
        s = LabOrderSerializer(data=data)
        s.is_valid(raise_exception=True)
        s.save(visit=visit)
        return Response(s.data, status=status.HTTP_201_CREATED)


class DiagnosisViewSet(viewsets.ModelViewSet):
    queryset = Diagnosis.objects.select_related("visit").all()
    serializer_class = DiagnosisSerializer
    filterset_fields = ["visit", "kind"]


class PrescriptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Prescription.objects.prefetch_related("items").select_related("visit").all()
    serializer_class = PrescriptionSerializer
    filterset_fields = ["visit"]


class LabOrderViewSet(viewsets.ModelViewSet):
    queryset = LabOrder.objects.select_related("visit").all()
    serializer_class = LabOrderSerializer
    filterset_fields = ["visit", "status", "urgency"]
