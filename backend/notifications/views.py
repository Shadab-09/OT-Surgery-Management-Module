from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.select_related("token", "patient").all()
    serializer_class = NotificationSerializer
    filterset_fields = ["channel", "status", "token", "patient"]
    search_fields = ["message", "recipient"]

    @action(detail=True, methods=["post"], url_path="mark-sent")
    def mark_sent(self, request, pk=None):
        n = self.get_object()
        n.status = Notification.STATUS_SENT
        n.sent_at = timezone.now()
        n.error = ""
        n.save(update_fields=["status", "sent_at", "error"])
        return Response(self.get_serializer(n).data)

    @action(detail=True, methods=["post"], url_path="mark-failed")
    def mark_failed(self, request, pk=None):
        n = self.get_object()
        n.status = Notification.STATUS_FAILED
        n.error = request.data.get("error", "")
        n.save(update_fields=["status", "error"])
        return Response(self.get_serializer(n).data)
