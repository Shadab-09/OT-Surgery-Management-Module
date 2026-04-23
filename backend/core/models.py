from django.db import models
from django.conf import settings


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Department(TimestampedModel):
    """A hospital department e.g. OPD, Radiology, Lab, Pharmacy."""
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=20, unique=True, help_text="Short prefix used in token numbers, e.g. OPD")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.code} – {self.name}"


class Service(TimestampedModel):
    """A service offered within a department (e.g. Registration, Consultation, X-Ray)."""
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="services")
    name = models.CharField(max_length=120)
    code = models.CharField(max_length=20)
    avg_service_minutes = models.PositiveIntegerField(default=10)
    priority_enabled = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["department__name", "name"]
        unique_together = [("department", "code")]

    def __str__(self):
        return f"{self.department.code}/{self.code} – {self.name}"


class Counter(TimestampedModel):
    """A physical or virtual counter at which a token is served."""
    STATUS_AVAILABLE = "available"
    STATUS_BUSY = "busy"
    STATUS_PAUSED = "paused"
    STATUS_CLOSED = "closed"
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, "Available"),
        (STATUS_BUSY, "Busy"),
        (STATUS_PAUSED, "Paused"),
        (STATUS_CLOSED, "Closed"),
    ]

    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="counters")
    services = models.ManyToManyField(Service, related_name="counters", blank=True)
    name = models.CharField(max_length=60)
    code = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_AVAILABLE)
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="counters",
    )
    location = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ["department__name", "name"]
        unique_together = [("department", "code")]

    def __str__(self):
        return f"{self.department.code}/{self.code} – {self.name}"


class Patient(TimestampedModel):
    """A patient who can be issued queue tokens."""
    GENDER_CHOICES = [("M", "Male"), ("F", "Female"), ("O", "Other")]

    mrn = models.CharField(max_length=30, unique=True, help_text="Medical Record Number")
    full_name = models.CharField(max_length=160)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, blank=True)
    # Priority flags drive routing (Elderly / Disabled / Emergency).
    is_elderly = models.BooleanField(default=False)
    is_disabled = models.BooleanField(default=False)
    preferred_language = models.CharField(max_length=20, default="en")

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.mrn} – {self.full_name}"


class DisplayBoard(TimestampedModel):
    """A screen that displays currently-serving tokens for a dept (and plays audio)."""
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="display_boards")
    name = models.CharField(max_length=80)
    location = models.CharField(max_length=120, blank=True)
    audio_enabled = models.BooleanField(default=True)
    language = models.CharField(max_length=20, default="en")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.department.code} – {self.name}"
