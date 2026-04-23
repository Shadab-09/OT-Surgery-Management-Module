"""Seed realistic demo data — departments, services, counters, patients, and a few live tokens."""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from core.models import Department, Service, Counter, Patient, DisplayBoard
from queues.services import issue_token

User = get_user_model()


DEPARTMENTS = [
    {
        "code": "OPD", "name": "Out-Patient Department",
        "services": [("REG", "Registration", 5), ("CONS", "Consultation", 15), ("FUP", "Follow-up", 10)],
    },
    {
        "code": "LAB", "name": "Clinical Laboratory",
        "services": [("SAMP", "Sample Collection", 6), ("REP", "Report Collection", 3)],
    },
    {
        "code": "RAD", "name": "Radiology",
        "services": [("XRAY", "X-Ray", 10), ("USG", "Ultrasound", 20), ("CT", "CT Scan", 30)],
    },
    {
        "code": "PHR", "name": "Pharmacy",
        "services": [("DISP", "Medicine Dispensing", 7)],
    },
    {
        "code": "BIL", "name": "Billing & Cash",
        "services": [("PAY", "Payment", 5), ("INS", "Insurance Claim", 12)],
    },
]


class Command(BaseCommand):
    help = "Populate the database with demo departments, services, counters, patients and tokens."

    def handle(self, *args, **opts):
        self.stdout.write("Seeding departments & services…")
        dept_objs = {}
        for d in DEPARTMENTS:
            dept, _ = Department.objects.get_or_create(
                code=d["code"], defaults={"name": d["name"], "description": d["name"]},
            )
            dept_objs[d["code"]] = dept
            for code, name, mins in d["services"]:
                Service.objects.get_or_create(
                    department=dept, code=code,
                    defaults={"name": name, "avg_service_minutes": mins},
                )
            for i in range(1, 3):
                Counter.objects.get_or_create(
                    department=dept, code=f"C{i}",
                    defaults={"name": f"{d['code']} Counter {i}", "location": f"Ground Floor"},
                )
            DisplayBoard.objects.get_or_create(
                department=dept, name=f"{d['code']} Main Display",
                defaults={"location": "Reception", "language": "en"},
            )

        self.stdout.write("Seeding patients…")
        patients = [
            ("MRN001", "Ali Raza", "03001234567", False, False),
            ("MRN002", "Fatima Khan", "03007654321", True, False),  # elderly
            ("MRN003", "Ahmed Bilal", "03331112233", False, True),  # disabled
            ("MRN004", "Sara Iqbal", "03159998888", False, False),
            ("MRN005", "Zara Siddiqui", "03445556677", False, False),
            ("MRN006", "Bilal Hussain", "03001119999", True, False),
        ]
        patient_objs = []
        for mrn, name, phone, elderly, disabled in patients:
            p, _ = Patient.objects.get_or_create(
                mrn=mrn, defaults={
                    "full_name": name, "phone": phone,
                    "is_elderly": elderly, "is_disabled": disabled,
                },
            )
            patient_objs.append(p)

        self.stdout.write("Issuing demo tokens…")
        opd = dept_objs["OPD"]
        reg = Service.objects.get(department=opd, code="REG")
        cons = Service.objects.get(department=opd, code="CONS")
        for p in patient_objs[:4]:
            issue_token(department=opd, service=reg, patient=p, channel="counter")
        for p in patient_objs[4:]:
            issue_token(department=opd, service=cons, patient=p, channel="kiosk")

        admin_username = "admin"
        if not User.objects.filter(username=admin_username).exists():
            User.objects.create_superuser(
                username=admin_username, email="admin@aiims.local", password="admin12345",
                role=User.ROLE_ADMIN, first_name="AIIMS", last_name="Admin",
            )
            self.stdout.write(self.style.SUCCESS("Created admin user (admin / admin12345)"))

        self.stdout.write(self.style.SUCCESS("Seed complete."))
