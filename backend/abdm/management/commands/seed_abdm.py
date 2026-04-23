"""Seed a couple of ABHA profiles against existing patients (mock-mode demo data)."""
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Patient
from abdm.models import ABHAProfile


DEMO_PROFILES = [
    # (mrn, abha_number, abha_address, first, last, mobile)
    ("MRN001", "91-1234-5678-9012", "ali.raza@abdm",    "Ali",    "Raza",    "03001234567"),
    ("MRN002", "91-1234-5678-9013", "fatima.khan@abdm", "Fatima", "Khan",    "03007654321"),
]


class Command(BaseCommand):
    help = "Seed ABHA profiles (mock) for a couple of existing patients."

    def handle(self, *args, **opts):
        created = 0
        for mrn, abha_num, abha_addr, first, last, mobile in DEMO_PROFILES:
            try:
                patient = Patient.objects.get(mrn=mrn)
            except Patient.DoesNotExist:
                continue
            _, was_new = ABHAProfile.objects.update_or_create(
                patient=patient,
                defaults=dict(
                    abha_number=abha_num, abha_address=abha_addr,
                    first_name=first, last_name=last, mobile=mobile,
                    gender=patient.gender or "", date_of_birth=patient.date_of_birth,
                    kyc_verified=True, kyc_method="aadhaar",
                    linked_at=timezone.now(),
                ),
            )
            created += int(was_new)
        self.stdout.write(self.style.SUCCESS(f"ABHA profiles seeded ({created} new)."))
