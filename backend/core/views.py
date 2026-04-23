from datetime import datetime

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .medvantage import UhidLookupError, fetch_uhid, normalise
from .models import Counter, Department, DisplayBoard, Patient, Service
from .serializers import (
    CounterSerializer, DepartmentSerializer, DisplayBoardSerializer,
    PatientSerializer, ServiceSerializer,
)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    filterset_fields = ["is_active"]
    search_fields = ["name", "code", "description"]
    ordering_fields = ["name", "code", "created_at"]


class ServiceViewSet(viewsets.ModelViewSet):
    queryset = Service.objects.select_related("department").all()
    serializer_class = ServiceSerializer
    filterset_fields = ["department", "is_active", "priority_enabled"]
    search_fields = ["name", "code"]


class CounterViewSet(viewsets.ModelViewSet):
    queryset = Counter.objects.select_related("department", "operator").prefetch_related("services").all()
    serializer_class = CounterSerializer
    filterset_fields = ["department", "status", "operator"]
    search_fields = ["name", "code", "location"]


def _dob_to_date(dob: str):
    """MedVantage returns dob as DD/MM/YYYY. Return a date or None."""
    if not dob:
        return None
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(dob, fmt).date()
        except ValueError:
            continue
    return None


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    filterset_fields = ["gender", "is_elderly", "is_disabled"]
    search_fields = ["mrn", "full_name", "phone", "email"]

    @action(detail=False, methods=["get", "post"], url_path="lookup-uhid")
    def lookup_uhid(self, request):
        """Fetch patient identity from MedVantage by UHID and upsert locally.

        GET/POST /api/core/patients/lookup-uhid/?uhid=UHID03121

        Used by the kiosk at token-generation time to pre-fill name / age /
        gender so the patient never retypes identity they've already given the
        HMIS. If ``upsert=true`` (default), we persist a local Patient keyed on
        UHID so the subsequent token issuance can attach ``patient_mrn=<uhid>``
        and skip registration entirely.
        """
        uhid = (request.query_params.get("uhid")
                or request.data.get("uhid") or "").strip()
        if not uhid:
            return Response({"uhid": "Required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            raw = fetch_uhid(uhid)
        except UhidLookupError as e:
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        norm = normalise(raw)
        upsert_flag = request.query_params.get("upsert", "true").lower()
        upsert = upsert_flag not in {"0", "false", "no"}
        patient_payload = None
        if upsert:
            elderly = bool(norm["age"] and norm["age"] >= 60)
            defaults = {
                "full_name": norm["full_name"] or "Unknown",
                "phone": norm["phone"],
                "email": norm["email"],
                "gender": norm["gender"],
                "date_of_birth": _dob_to_date(norm["dob"]),
                "is_elderly": elderly,
            }
            patient, _ = Patient.objects.update_or_create(mrn=norm["uhid"], defaults=defaults)
            patient_payload = PatientSerializer(patient).data

        return Response({
            "uhid": norm["uhid"],
            "source": "medvantage",
            "patient": norm,
            "local_patient": patient_payload,
        })


class DisplayBoardViewSet(viewsets.ModelViewSet):
    queryset = DisplayBoard.objects.select_related("department").all()
    serializer_class = DisplayBoardSerializer
    filterset_fields = ["department", "is_active"]
    search_fields = ["name", "location"]
