from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from opd.models import Visit

from . import eka_client as eka
from . import services as abdm_services
from .models import ABHAProfile, CareContext, HealthRecordLink, ConsentRequest, ABDMTransaction
from .serializers import (
    ABHAProfileSerializer, CareContextSerializer, HealthRecordLinkSerializer,
    ConsentRequestSerializer, ABDMTransactionSerializer,
    StartAadhaarSerializer, VerifyAadhaarSerializer,
    StartMobileSerializer, VerifyMobileSerializer,
    ConsentInitSerializer,
)


class ABHAProfileViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ABHAProfile.objects.select_related("patient").all()
    serializer_class = ABHAProfileSerializer
    filterset_fields = ["patient", "kyc_verified"]
    search_fields = ["abha_number", "abha_address", "patient__full_name", "patient__mrn"]

    # ── Enrolment: Aadhaar flow ──────────────────────────────
    @action(detail=False, methods=["post"], url_path="aadhaar/start")
    def aadhaar_start(self, request):
        s = StartAadhaarSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            resp = abdm_services.start_aadhaar_enrolment(
                s.validated_data["patient"], aadhaar=s.validated_data["aadhaar"],
            )
        except eka.EkaCareError as e:
            return Response({"detail": str(e), "body": e.body}, status=status.HTTP_400_BAD_REQUEST)
        return Response(resp)

    @action(detail=False, methods=["post"], url_path="aadhaar/verify")
    def aadhaar_verify(self, request):
        s = VerifyAadhaarSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            profile = abdm_services.complete_aadhaar_enrolment(
                s.validated_data["patient"],
                txn_id=s.validated_data["txn_id"],
                otp=s.validated_data["otp"],
                mobile=s.validated_data.get("mobile", ""),
                preferred_abha_address=s.validated_data.get("preferred_abha_address", ""),
            )
        except eka.EkaCareError as e:
            return Response({"detail": str(e), "body": e.body}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ABHAProfileSerializer(profile).data, status=status.HTTP_201_CREATED)

    # ── Login: Mobile flow ───────────────────────────────────
    @action(detail=False, methods=["post"], url_path="mobile/start")
    def mobile_start(self, request):
        s = StartMobileSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            resp = abdm_services.start_mobile_login(
                s.validated_data["patient"], mobile=s.validated_data["mobile"],
            )
        except eka.EkaCareError as e:
            return Response({"detail": str(e), "body": e.body}, status=status.HTTP_400_BAD_REQUEST)
        return Response(resp)

    @action(detail=False, methods=["post"], url_path="mobile/verify")
    def mobile_verify(self, request):
        s = VerifyMobileSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            resp = abdm_services.complete_mobile_login(
                s.validated_data["patient"],
                txn_id=s.validated_data["txn_id"],
                otp=s.validated_data["otp"],
            )
        except eka.EkaCareError as e:
            return Response({"detail": str(e), "body": e.body}, status=status.HTTP_400_BAD_REQUEST)
        return Response(resp)

    # ── Profile helpers ──────────────────────────────────────
    @action(detail=True, methods=["post"])
    def refresh(self, request, pk=None):
        profile = abdm_services.refresh_profile(self.get_object())
        return Response(ABHAProfileSerializer(profile).data)

    @action(detail=True, methods=["get"], url_path="card")
    def card(self, request, pk=None):
        return Response(abdm_services.get_abha_card(self.get_object()))


class CareContextViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CareContext.objects.select_related("abha").all()
    serializer_class = CareContextSerializer
    filterset_fields = ["abha"]


class HealthRecordViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HealthRecordLink.objects.select_related("patient", "care_context").all()
    serializer_class = HealthRecordLinkSerializer
    filterset_fields = ["patient", "care_context", "record_type", "status"]
    search_fields = ["eka_request_id", "patient__full_name"]

    @action(detail=False, methods=["post"], url_path="push-visit")
    def push_visit(self, request):
        """Manually trigger a FHIR bundle push for an existing Visit."""
        visit_id = request.data.get("visit")
        if not visit_id:
            return Response({"visit": "Required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            visit = Visit.objects.get(pk=visit_id)
        except Visit.DoesNotExist:
            return Response({"detail": "Visit not found."}, status=status.HTTP_404_NOT_FOUND)
        hr = abdm_services.push_visit_to_abdm(visit)
        return Response(HealthRecordLinkSerializer(hr).data, status=status.HTTP_201_CREATED)


class ConsentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ConsentRequest.objects.select_related("patient").all()
    serializer_class = ConsentRequestSerializer
    filterset_fields = ["patient", "status", "purpose"]

    @action(detail=False, methods=["post"], url_path="request")
    def request_consent(self, request):
        s = ConsentInitSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            cr = abdm_services.request_patient_consent(
                s.validated_data["patient"],
                abha_address=s.validated_data["abha_address"],
                purpose=s.validated_data["purpose"],
                hi_types=s.validated_data.get("hi_types") or ["OPConsultation", "Prescription", "DiagnosticReport"],
                days_valid=s.validated_data["days_valid"],
            )
        except eka.EkaCareError as e:
            return Response({"detail": str(e), "body": e.body}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ConsentRequestSerializer(cr).data, status=status.HTTP_201_CREATED)


class TransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ABDMTransaction.objects.select_related("patient").all()
    serializer_class = ABDMTransactionSerializer
    filterset_fields = ["kind", "ok", "patient"]
    ordering_fields = ["created_at"]
