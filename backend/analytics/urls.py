from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import DailyQueueStatViewSet, DashboardOverview, TrendsView

router = DefaultRouter()
router.register("daily-stats", DailyQueueStatViewSet, basename="daily-stat")

urlpatterns = [
    path("overview/", DashboardOverview.as_view(), name="analytics-overview"),
    path("trends/", TrendsView.as_view(), name="analytics-trends"),
] + router.urls
