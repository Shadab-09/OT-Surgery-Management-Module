"""Seed doctors, weekly schedules, a handful of appointments and one closed visit.

Run AFTER `seed_queue` (which creates departments, services and patients).
"""
from datetime import date, datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Department, Patient
from opd.models import (
    Doctor, DoctorSchedule, Appointment, Visit, Vitals,
    Diagnosis, Prescription, PrescriptionItem, LabOrder,
)
from opd import services as opd_services


DOCTORS = [
    {
        "name": "Aisha Rahman", "reg": "PMDC-10001", "spec": "General Medicine",
        "qual": "MBBS, MD (Medicine)", "phone": "03001111111",
        "abha": "dr.aisha@abdm", "hpr": "HPR-10001",
    },
    {
        "name": "Usman Khalid", "reg": "PMDC-10002", "spec": "Paediatrics",
        "qual": "MBBS, FCPS (Paeds)", "phone": "03002222222",
        "abha": "dr.usman@abdm", "hpr": "HPR-10002",
    },
    {
        "name": "Sadia Malik", "reg": "PMDC-10003", "spec": "Cardiology",
        "qual": "MBBS, MD, DM (Cardio)", "phone": "03003333333",
        "abha": "dr.sadia@abdm", "hpr": "HPR-10003",
    },
]

# Mon–Sat, 09:00–13:00, 15-min slots
SCHEDULE_WEEKDAYS = [0, 1, 2, 3, 4, 5]


class Command(BaseCommand):
    help = "Seed OPD doctors, schedules, appointments, and a sample closed visit."

    def handle(self, *args, **opts):
        try:
            opd = Department.objects.get(code="OPD")
        except Department.DoesNotExist:
            self.stdout.write(self.style.ERROR("Run `seed_queue` first to create departments."))
            return

        self.stdout.write("Seeding doctors & schedules…")
        doctor_objs = []
        for d in DOCTORS:
            doc, _ = Doctor.objects.get_or_create(
                registration_number=d["reg"],
                defaults={
                    "department": opd, "full_name": d["name"],
                    "specialisation": d["spec"], "qualifications": d["qual"],
                    "phone": d["phone"], "abha_address": d["abha"], "hpr_id": d["hpr"],
                    "consultation_fee": 500, "avg_consult_minutes": 15,
                },
            )
            doctor_objs.append(doc)
            for wd in SCHEDULE_WEEKDAYS:
                DoctorSchedule.objects.get_or_create(
                    doctor=doc, weekday=wd, start_time=time(9, 0),
                    defaults={"end_time": time(13, 0), "slot_minutes": 15,
                              "room": f"Room {doc.id}"},
                )

        patients = list(Patient.objects.all()[:4])
        if not patients:
            self.stdout.write(self.style.WARNING("No patients to book — skipping appointments."))
            return

        self.stdout.write("Booking demo appointments…")
        today = timezone.localdate()
        base = datetime.combine(today, time(10, 0), tzinfo=timezone.get_current_timezone())
        demo_slots = [base + timedelta(minutes=15 * i) for i in range(len(patients))]
        created = 0
        for idx, p in enumerate(patients):
            doc = doctor_objs[idx % len(doctor_objs)]
            try:
                opd_services.book_appointment(
                    patient=p, doctor=doc, scheduled_at=demo_slots[idx],
                    reason="Routine OPD consultation", booked_via="web",
                )
                created += 1
            except ValueError:
                pass  # slot already booked from a previous run
        self.stdout.write(f"  booked {created} appointments")

        self.stdout.write("Creating a sample closed visit with vitals + prescription…")
        p = patients[0]
        doc = doctor_objs[0]
        visit = opd_services.start_visit(patient=p, doctor=doc, department=opd)
        visit.chief_complaints = "Fever and cough for 3 days"
        visit.history = "No known allergies. Non-smoker."
        visit.examination = "Throat: mildly congested. Chest: clear."
        visit.advice = "Plenty of fluids, rest. Return if fever persists >5 days."
        visit.follow_up_on = today + timedelta(days=7)
        visit.save()

        Vitals.objects.update_or_create(
            visit=visit, defaults=dict(
                temperature_c=38.2, pulse_bpm=92, systolic_bp=122, diastolic_bp=78,
                respiratory_rate=18, spo2=97, height_cm=170, weight_kg=68,
            ),
        )
        Diagnosis.objects.get_or_create(
            visit=visit, description="Acute viral pharyngitis",
            defaults={"kind": "provisional", "icd10_code": "J02.9", "snomed_code": "363746003"},
        )
        opd_services.upsert_prescription(visit, notes="Symptomatic therapy",
            items=[
                dict(drug_name="Paracetamol", strength="500 mg", route="oral",
                     frequency="TDS", duration_days=5,
                     instructions="After food. Stop if rash.", rx_norm_code="161"),
                dict(drug_name="Cetirizine", strength="10 mg", route="oral",
                     frequency="HS", duration_days=5, instructions="At bedtime"),
            ],
        )
        LabOrder.objects.get_or_create(
            visit=visit, test_name="Complete Blood Count",
            defaults={"test_code": "58410-2", "urgency": "routine"},
        )
        opd_services.close_visit(visit, push_to_abdm=False)
        self.stdout.write(self.style.SUCCESS(f"  visit {visit.visit_number} closed"))
        self.stdout.write(self.style.SUCCESS("OPD seed complete."))
