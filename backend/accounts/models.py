from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_ADMIN = "admin"
    ROLE_OPERATOR = "operator"       # kiosk / counter staff
    ROLE_DOCTOR = "doctor"
    ROLE_MANAGER = "manager"
    ROLE_PATIENT = "patient"
    ROLE_CHOICES = [
        (ROLE_ADMIN, "Admin"),
        (ROLE_OPERATOR, "Counter Operator"),
        (ROLE_DOCTOR, "Doctor"),
        (ROLE_MANAGER, "Dept Manager"),
        (ROLE_PATIENT, "Patient"),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_OPERATOR)
    phone = models.CharField(max_length=20, blank=True)
    department = models.ForeignKey(
        "core.Department", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="staff",
    )

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
