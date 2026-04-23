from django.utils import timezone
from django.db.models import Count, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Department, Counter
from .models import Token, TokenEvent
from .serializers import (
    TokenSerializer, TokenEventSerializer,
    IssueTokenSerializer, CallNextSerializer, CounterActionSerializer,
)
from . import services as qs
from . import i18n


class TokenViewSet(viewsets.ModelViewSet):
    queryset = Token.objects.select_related("department", "service", "counter", "patient").all()
    serializer_class = TokenSerializer
    filterset_fields = ["department", "service", "counter", "status", "priority", "channel"]
    search_fields = ["number", "patient__full_name", "patient__mrn"]
    ordering_fields = ["issued_at", "called_at", "sequence", "priority"]

    # ── Token Generation ─────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="issue")
    def issue(self, request):
        s = IssueTokenSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        patient = s.resolve_patient()
        token = qs.issue_token(
            department=s.validated_data["department"],
            service=s.validated_data["service"],
            patient=patient,
            channel=s.validated_data["channel"],
            priority=s.validated_data["priority"],
            actor=request.user if request.user.is_authenticated else None,
            notes=s.validated_data.get("notes", ""),
        )
        return Response(TokenSerializer(token).data, status=status.HTTP_201_CREATED)

    # ── Live Queue Snapshot (for Display Board & Dashboard) ──────────
    @action(detail=False, methods=["get"], url_path="live")
    def live(self, request):
        dept_id = request.query_params.get("department")
        qset = Token.objects.select_related("department", "service", "counter", "patient")
        today = timezone.localdate()
        qset = qset.filter(issued_at__date=today)
        if dept_id:
            qset = qset.filter(department_id=dept_id)

        waiting = qset.filter(status=Token.STATUS_WAITING)
        now_serving = qset.filter(status__in=[Token.STATUS_CALLED, Token.STATUS_IN_SERVICE])
        completed = qset.filter(status=Token.STATUS_COMPLETED)

        return Response({
            "waiting_count": waiting.count(),
            "priority_count": waiting.exclude(priority=Token.PRIORITY_NORMAL).count(),
            "now_serving": TokenSerializer(now_serving.order_by("called_at"), many=True).data,
            "next_up": TokenSerializer(waiting.order_by("priority", "issued_at")[:10], many=True).data,
            "recently_completed": TokenSerializer(completed.order_by("-completed_at")[:10], many=True).data,
        })

    # ── Counter Actions ─────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="call-next")
    def call_next(self, request):
        s = CallNextSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        token = qs.call_next(s.validated_data["counter"], actor=request.user if request.user.is_authenticated else None)
        if not token:
            return Response({"detail": "Queue is empty."}, status=status.HTTP_204_NO_CONTENT)
        return Response(TokenSerializer(token).data)

    @action(detail=True, methods=["post"])
    def recall(self, request, pk=None):
        token = self.get_object()
        token = qs.recall(token, actor=request.user if request.user.is_authenticated else None)
        return Response(TokenSerializer(token).data)

    @action(detail=True, methods=["post"])
    def skip(self, request, pk=None):
        token = self.get_object()
        token = qs.skip_token(token, actor=request.user if request.user.is_authenticated else None)
        return Response(TokenSerializer(token).data)

    @action(detail=True, methods=["post"], url_path="start")
    def start_service(self, request, pk=None):
        token = self.get_object()
        token = qs.start_service(token, actor=request.user if request.user.is_authenticated else None)
        return Response(TokenSerializer(token).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        s = CounterActionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        token = self.get_object()
        token = qs.complete_service(
            token,
            actor=request.user if request.user.is_authenticated else None,
            notes=s.validated_data.get("notes", ""),
        )
        return Response(TokenSerializer(token).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        s = CounterActionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        token = self.get_object()
        token = qs.cancel_token(
            token,
            actor=request.user if request.user.is_authenticated else None,
            reason=s.validated_data.get("notes", ""),
        )
        return Response(TokenSerializer(token).data)

    @action(detail=True, methods=["post"])
    def transfer(self, request, pk=None):
        s = CounterActionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        if "counter" not in s.validated_data:
            return Response({"counter": "Required."}, status=status.HTTP_400_BAD_REQUEST)
        token = self.get_object()
        token = qs.transfer_token(
            token,
            counter=s.validated_data["counter"],
            actor=request.user if request.user.is_authenticated else None,
        )
        return Response(TokenSerializer(token).data)

    @action(detail=True, methods=["get"])
    def events(self, request, pk=None):
        token = self.get_object()
        return Response(TokenEventSerializer(token.events.all(), many=True).data)


class TokenEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = TokenEvent.objects.select_related("token", "actor", "counter").all()
    serializer_class = TokenEventSerializer
    filterset_fields = ["token", "event", "actor", "counter"]


class LanguageView(APIView):
    """GET /api/queues/i18n/  → translation bundle + supported languages.

    Query params:
      • ``lang`` — BCP-47 code (hi, ta, bn-IN, …). Defaults to Accept-Language.
      • ``list=1`` — return only the supported-languages catalogue.
    """
    def get(self, request):
        if request.query_params.get("list"):
            return Response({"languages": i18n.supported_languages()})
        lang = i18n.resolve_request_language(request)
        return Response({
            **i18n.bundle(lang),
            "languages": i18n.supported_languages(),
        })


class AnnounceView(APIView):
    """POST /api/queues/announce/ — build a localised announcement string.

    Used by the display board / TTS pipeline to fetch a pre-rendered phrase
    in the chosen language without embedding templates on the client.
    """
    def post(self, request):
        key = request.data.get("key", "announce.call")
        lang = request.data.get("lang") or i18n.resolve_request_language(request)
        params = {k: v for k, v in request.data.items() if k not in {"key", "lang"}}
        return Response({
            "language": i18n.normalize_language(lang),
            "key": key,
            "text": i18n.announce(key, lang, **params),
        })
