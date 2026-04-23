from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import TokenViewSet, TokenEventViewSet, LanguageView, AnnounceView

router = DefaultRouter()
router.register("tokens", TokenViewSet, basename="token")
router.register("events", TokenEventViewSet, basename="token-event")

urlpatterns = router.urls + [
    path("i18n/", LanguageView.as_view(), name="queues-i18n"),
    path("announce/", AnnounceView.as_view(), name="queues-announce"),
]
