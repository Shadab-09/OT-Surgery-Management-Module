from datetime import datetime, timedelta
from django.db.models import Count, Avg, Q
from django.db.models.functions import TruncHour, TruncDate
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response

from core.models import Department
from queues.models import Token
from .models import DailyQueueStat
from .serializers import DailyQueueStatSerializer


class DailyQueueStatViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DailyQueueStat.objects.select_related("department").all()
    serializer_class = DailyQueueStatSerializer
    filterset_fields = ["department", "date"]


class DashboardOverview(APIView):
    """Live KPIs for the dashboard — computes on-the-fly from Token data."""

    def get(self, request):
        today = timezone.localdate()
        dept_id = request.query_params.get("department")
        qs = Token.objects.filter(issued_at__date=today)
        if dept_id:
            qs = qs.filter(department_id=dept_id)

        total = qs.count()
        served = qs.filter(status=Token.STATUS_COMPLETED).count()
        waiting = qs.filter(status=Token.STATUS_WAITING).count()
        in_service = qs.filter(status=Token.STATUS_IN_SERVICE).count()
        skipped = qs.filter(status=Token.STATUS_SKIPPED).count()
        cancelled = qs.filter(status=Token.STATUS_CANCELLED).count()
        priority = qs.exclude(priority=Token.PRIORITY_NORMAL).count()

        completed = qs.filter(status=Token.STATUS_COMPLETED, called_at__isnull=False)
        wait_secs, service_secs, tat_secs = [], [], []
        for t in completed:
            if t.called_at:
                wait_secs.append((t.called_at - t.issued_at).total_seconds())
            if t.started_at and t.completed_at:
                service_secs.append((t.completed_at - t.started_at).total_seconds())
            if t.completed_at:
                tat_secs.append((t.completed_at - t.issued_at).total_seconds())

        def avg(xs):
            return int(sum(xs) / len(xs)) if xs else 0

        by_hour = (qs.annotate(h=TruncHour("issued_at"))
                     .values("h").annotate(c=Count("id")).order_by("h"))

        by_department = (Token.objects.filter(issued_at__date=today)
                         .values("department__id", "department__name")
                         .annotate(
                             issued=Count("id"),
                             served=Count("id", filter=Q(status=Token.STATUS_COMPLETED)),
                             waiting=Count("id", filter=Q(status=Token.STATUS_WAITING)),
                         ).order_by("-issued"))

        return Response({
            "date": today,
            "totals": {
                "issued": total,
                "served": served,
                "waiting": waiting,
                "in_service": in_service,
                "skipped": skipped,
                "cancelled": cancelled,
                "priority": priority,
            },
            "averages": {
                "wait_seconds": avg(wait_secs),
                "service_seconds": avg(service_secs),
                "tat_seconds": avg(tat_secs),
            },
            "hourly_issuance": [{"hour": r["h"].hour if r["h"] else None, "count": r["c"]} for r in by_hour],
            "by_department": list(by_department),
        })


class TrendsView(APIView):
    """Daily trends for the last N days (default 7)."""

    def get(self, request):
        days = int(request.query_params.get("days", 7))
        start = timezone.localdate() - timedelta(days=days - 1)
        qs = Token.objects.filter(issued_at__date__gte=start)
        dept_id = request.query_params.get("department")
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        by_day = (qs.annotate(d=TruncDate("issued_at"))
                    .values("d").annotate(
                        issued=Count("id"),
                        served=Count("id", filter=Q(status=Token.STATUS_COMPLETED)),
                        skipped=Count("id", filter=Q(status=Token.STATUS_SKIPPED)),
                    ).order_by("d"))
        return Response({"days": days, "series": list(by_day)})
