from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from queues.models import Token
from queues.serializers import TokenSerializer
from .models import (
    HMISProvider, HMISPatientLink, HMISAppointment,
    HMISEncounter, HMISTransaction,
)
from .serializers import (
    HMISProviderSerializer, HMISPatientLinkSerializer,
    HMISAppointmentSerializer, HMISEncounterSerializer,
    HMISTransactionSerializer,
    PatientLookupSerializer, PullAppointmentsSerializer,
    CheckInAppointmentSerializer, WebhookEventSerializer,
)
from . import services as hmis_services
from . import client as hmis_client


class HMISProviderViewSet(viewsets.ModelViewSet):
    queryset = HMISProvider.objects.all()
    serializer_class = HMISProviderSerializer
    filterset_fields = ["kind", "is_active", "is_primary"]
    search_fields = ["code", "name"]


class HMISPatientLinkViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HMISPatientLink.objects.select_related("provider", "patient").all()
    serializer_class = HMISPatientLinkSerializer
    filterset_fields = ["provider", "patient"]
    search_fields = ["hmis_patient_id", "hmis_mrn", "patient__full_name", "patient__mrn"]

    @action(detail=False, methods=["post"], url_path="lookup")
    def lookup(self, request):
        """POST /api/hmis/patient-links/lookup/ — pull a patient from HMIS and upsert locally."""
        s = PatientLookupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        patient = hmis_services.sync_patient_from_hmis(
            mrn=s.validated_data.get("mrn", ""),
            hmis_patient_id=s.validated_data.get("hmis_patient_id", ""),
            phone=s.validated_data.get("phone", ""),
            provider=s.validated_data.get("provider") or None,
        )
        link = patient.hmis_links.order_by("-last_synced_at").first()
        return Response(
            HMISPatientLinkSerializer(link).data if link else {"patient_id": patient.id},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="push")
    def push(self, request, pk=None):
        """Register a local patient with the HMIS (walk-in → HMIS)."""
        link = self.get_object()
        link = hmis_services.push_patient_to_hmis(link.patient, provider=link.provider)
        return Response(HMISPatientLinkSerializer(link).data)


class HMISAppointmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HMISAppointment.objects.select_related(
        "provider", "patient", "token",
    ).all()
    serializer_class = HMISAppointmentSerializer
    filterset_fields = ["provider", "status", "department_code", "doctor_hmis_id"]
    search_fields = ["hmis_appointment_id", "doctor_name", "patient__full_name"]

    @action(detail=False, methods=["post"], url_path="pull")
    def pull(self, request):
        """Pull the day's appointments from HMIS into the local store."""
        s = PullAppointmentsSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        stored = hmis_services.pull_appointments(
            department_code=s.validated_data.get("department_code", ""),
            date=s.validated_data.get("date", ""),
            provider=s.validated_data.get("provider") or None,
        )
        return Response(HMISAppointmentSerializer(stored, many=True).data)

    @action(detail=True, methods=["post"], url_path="check-in")
    def check_in(self, request, pk=None):
        """Patient has arrived — issue a queue token and flip the appointment."""
        s = CheckInAppointmentSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        appt = self.get_object()
        try:
            token = hmis_services.issue_token_from_appointment(
                appt,
                channel=s.validated_data.get("channel") or Token.CHANNEL_COUNTER,
                actor=request.user if request.user.is_authenticated else None,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            "appointment": HMISAppointmentSerializer(appt).data,
            "token": TokenSerializer(token, context={"request": request}).data,
        })


class HMISEncounterViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HMISEncounter.objects.select_related("provider", "patient", "token").all()
    serializer_class = HMISEncounterSerializer
    filterset_fields = ["provider", "status", "patient"]

    @action(detail=False, methods=["post"], url_path="push-token")
    def push_token(self, request):
        """POST /api/hmis/encounters/push-token/ {token_id, provider?} → push encounter."""
        token_id = request.data.get("token_id") or request.data.get("token")
        if not token_id:
            return Response({"token_id": "Required."}, status=status.HTTP_400_BAD_REQUEST)
        token = Token.objects.filter(pk=token_id).select_related(
            "patient", "department", "service",
        ).first()
        if not token:
            return Response({"detail": "Token not found."}, status=status.HTTP_404_NOT_FOUND)
        enc = hmis_services.push_token_encounter(
            token, provider=request.data.get("provider") or None,
            extra=request.data.get("extra") or None,
        )
        return Response(HMISEncounterSerializer(enc).data)


class HMISTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HMISTransaction.objects.select_related("provider", "patient").all()
    serializer_class = HMISTransactionSerializer
    filterset_fields = ["provider", "direction", "operation"]
    ordering_fields = ["created_at", "response_status"]


class HMISWebhookView(APIView):
    """POST /api/hmis/webhook/<provider_code>/ — inbound HMIS events.

    Verifies the HMAC signature in ``X-HMIS-Signature`` (when live), journals
    the request, and applies the event to local state.
    """
    authentication_classes: list = []  # webhook auth is HMAC-based, not DRF
    permission_classes: list = []

    def post(self, request, provider_code: str):
        provider = HMISProvider.objects.filter(code=provider_code, is_active=True).first()
        if not provider:
            return Response({"detail": "Unknown provider."}, status=status.HTTP_404_NOT_FOUND)

        signature = request.headers.get("X-HMIS-Signature", "")
        raw_body = request.body or b""
        if not hmis_client.verify_webhook_signature(
            provider, raw_body=raw_body, signature=signature,
        ):
            return Response({"detail": "Invalid signature."}, status=status.HTTP_401_UNAUTHORIZED)

        s = WebhookEventSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        HMISTransaction.objects.create(
            provider=provider,
            direction=HMISTransaction.DIRECTION_IN,
            operation=f"webhook.{s.validated_data['event']}",
            method="POST",
            url=request.build_absolute_uri(),
            request_body=request.data,
            response_status=200,
        )
        summary = hmis_services.apply_webhook(
            provider, event=s.validated_data["event"],
            data=s.validated_data.get("data") or {},
        )
        return Response(summary)


class HMISHealthView(APIView):
    """GET /api/hmis/health/ — integration self-test.

    Returns the configured mode, provider list, and attempts a token fetch so
    operators can tell at a glance whether the HMIS is reachable.
    """
    def get(self, request):
        providers = HMISProvider.objects.filter(is_active=True)
        reachable = []
        for p in providers:
            try:
                hmis_client._call(p, operation="auth.token", path="oauth/token",
                                  body={"client_id": p.client_id})
                reachable.append({"code": p.code, "ok": True})
            except hmis_client.HMISError as e:
                reachable.append({"code": p.code, "ok": False, "error": str(e)})
        return Response({
            "mode": hmis_client.mode(),
            "provider_count": providers.count(),
            "providers": reachable,
        })
