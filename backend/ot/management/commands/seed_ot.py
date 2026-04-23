"""Seed OT module with demo rooms, team members, bookings, and clinical records.

Run AFTER `seed_queue` and `seed_opd` (which create patients and the admin user).
"""
from datetime import date, datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Patient
from ot.models import (
    OTRoom,
    SurgicalTeamMember,
    PreOpAssessment,
    SurgicalSafetyChecklist,
    IntraoperativeRecord,
    IntraopVital,
    DrugAdministration,
    AnaesthesiaRecord,
    OperativeNote,
    SurgicalOutcome,
    OTInventoryItem,
    CSSDBatch,
)
from ot import services as ot_services


# ---------------------------------------------------------------------------
# Static data
# ---------------------------------------------------------------------------

ROOMS = [
    {
        "name": "Major OT 1",
        "room_number": "OT-01",
        "room_type": "major",
        "equipment": ["Anaesthesia Machine", "Electrosurgical Unit", "OT Table", "Surgical Lights"],
    },
    {
        "name": "Major OT 2",
        "room_number": "OT-02",
        "room_type": "major",
        "equipment": ["Anaesthesia Machine", "C-Arm", "Orthopaedic Table"],
    },
    {
        "name": "Minor OT 1",
        "room_number": "OT-03",
        "room_type": "minor",
        "equipment": ["Electrosurgical Unit", "Minor OT Table"],
    },
    {
        "name": "Emergency OT",
        "room_number": "OT-04",
        "room_type": "emergency",
        "equipment": ["Anaesthesia Machine", "Defibrillator", "Emergency Trolley"],
    },
]

INVENTORY_ITEMS = [
    {"name": "Suture Vicryl 0",           "category": "suture",      "sku": "SUT-VIC-0",  "unit": "box",   "qty": 50,  "reorder": 10, "cost": 250},
    {"name": "Sterile Gloves Size 7",      "category": "gloves",      "sku": "GLV-SZ7",    "unit": "box",   "qty": 80,  "reorder": 20, "cost": 180},
    {"name": "Scrub Solution Betadine",    "category": "consumable",  "sku": "SCRB-BET",   "unit": "pack",  "qty": 30,  "reorder": 10, "cost": 120},
    {"name": "Surgical Drape Set",         "category": "drape",       "sku": "DRP-SET",    "unit": "set",   "qty": 40,  "reorder": 15, "cost": 350},
    {"name": "Propofol 200mg",             "category": "anaesthesia", "sku": "DRUG-PRO200","unit": "vial",  "qty": 60,  "reorder": 20, "cost": 450},
    {"name": "Knee Implant Total System",  "category": "implant",     "sku": "IMP-KNEE-TKR","unit": "set",  "qty": 8,   "reorder": 3,  "cost": 85000},
    {"name": "Bone Cement",                "category": "implant",     "sku": "IMP-BCMT",   "unit": "pack",  "qty": 12,  "reorder": 4,  "cost": 4500},
    {"name": "Surgical Blade No.22",       "category": "consumable",  "sku": "BLD-22",     "unit": "box",   "qty": 100, "reorder": 25, "cost": 60},
    {"name": "Electrosurgical Pencil",     "category": "consumable",  "sku": "ESU-PEN",    "unit": "piece", "qty": 45,  "reorder": 15, "cost": 220},
    {"name": "Laparoscopic Trocar 5mm",    "category": "instrument",  "sku": "LAP-TRC5",   "unit": "piece", "qty": 20,  "reorder": 5,  "cost": 1800},
]


class Command(BaseCommand):
    help = "Seed OT module with demo data."

    def handle(self, *args, **options):
        User = get_user_model()

        # ── 1. Admin user ────────────────────────────────────────────────
        admin = User.objects.filter(is_superuser=True).first()
        if not admin:
            self.stdout.write(self.style.WARNING(
                "No superuser found. Run `seed_queue` first to create the admin user."
            ))

        # ── 2. OT Rooms ──────────────────────────────────────────────────
        self.stdout.write("Creating OT rooms…")
        room_objs = {}
        for r in ROOMS:
            room, _ = OTRoom.objects.get_or_create(
                room_number=r["room_number"],
                defaults={
                    "name": r["name"],
                    "room_type": r["room_type"],
                    "equipment": r["equipment"],
                    "status": "available",
                    "is_active": True,
                },
            )
            room_objs[r["room_number"]] = room
        self.stdout.write(self.style.SUCCESS(f"  Created/found {len(room_objs)} OT rooms"))

        # ── 3. Surgical team members ─────────────────────────────────────
        self.stdout.write("Creating surgical team members…")

        team_specs = [
            {
                "username": "surgeon1",
                "first_name": "Arjun",
                "last_name": "Mehta",
                "role": "primary_surgeon",
                "specialization": "General & Laparoscopic Surgery",
                "reg_number": "MCI-GS-0001",
            },
            {
                "username": "anaesthesia1",
                "first_name": "Priya",
                "last_name": "Sharma",
                "role": "anaesthesiologist",
                "specialization": "Cardiac & Regional Anaesthesia",
                "reg_number": "MCI-ANAE-0001",
            },
            {
                "username": "nurse1",
                "first_name": "Sunita",
                "last_name": "Verma",
                "role": "scrub_nurse",
                "specialization": "OT Scrub Nursing",
                "reg_number": "NCI-SN-0001",
            },
        ]

        team_objs = {}
        for spec in team_specs:
            user, _ = User.objects.get_or_create(
                username=spec["username"],
                defaults={
                    "first_name": spec["first_name"],
                    "last_name": spec["last_name"],
                    "email": f"{spec['username']}@hospital.local",
                },
            )
            member, _ = SurgicalTeamMember.objects.get_or_create(
                user=user,
                role=spec["role"],
                defaults={
                    "specialization": spec["specialization"],
                    "registration_number": spec["reg_number"],
                    "is_active": True,
                },
            )
            team_objs[spec["role"]] = member
        self.stdout.write(self.style.SUCCESS(f"  Created/found {len(team_objs)} team members"))

        surgeon = team_objs["primary_surgeon"]
        anaesthesiologist = team_objs["anaesthesiologist"]

        # ── 4. Patient ───────────────────────────────────────────────────
        patient = Patient.objects.first()
        if not patient:
            self.stdout.write(self.style.WARNING(
                "No patients found. Run `seed_queue` first to create demo patients."
            ))
            return

        # ── 5. OT Bookings ───────────────────────────────────────────────
        self.stdout.write("Creating OT bookings…")
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        tz = timezone.get_current_timezone()

        room_major1 = room_objs["OT-01"]
        room_major2 = room_objs["OT-02"]
        room_emergency = room_objs["OT-04"]

        # Booking 1 — elective appendectomy today
        try:
            booking_elective = ot_services.create_booking(
                room=room_major1,
                patient=patient,
                surgery_name="Laparoscopic Appendicectomy",
                surgery_category="general",
                priority="elective",
                scheduled_date=today,
                scheduled_start=time(9, 0),
                scheduled_end=time(11, 0),
                primary_surgeon=surgeon,
                anaesthesiologist=anaesthesiologist,
                diagnosis="Acute appendicitis",
                planned_procedure="Laparoscopic appendicectomy under general anaesthesia",
                booked_by=admin,
                booking_notes="Patient pre-op assessed and cleared.",
            )
            self.stdout.write(f"  Created elective booking: {booking_elective.booking_number}")
        except ValueError as exc:
            self.stdout.write(self.style.WARNING(f"  Elective booking skipped: {exc}"))
            booking_elective = None

        # Booking 2 — completed knee replacement (yesterday)
        # Use a second patient if available, otherwise re-use the first
        patients_all = list(Patient.objects.all()[:2])
        patient2 = patients_all[1] if len(patients_all) > 1 else patient

        try:
            booking_completed = ot_services.create_booking(
                room=room_major2,
                patient=patient2,
                surgery_name="Total Knee Replacement (Right)",
                surgery_category="ortho",
                priority="elective",
                scheduled_date=yesterday,
                scheduled_start=time(8, 0),
                scheduled_end=time(12, 0),
                primary_surgeon=surgeon,
                anaesthesiologist=anaesthesiologist,
                diagnosis="Severe osteoarthritis right knee (Kellgren-Lawrence Grade IV)",
                planned_procedure="Total knee arthroplasty under spinal anaesthesia",
                booked_by=admin,
            )
            self.stdout.write(f"  Created completed booking: {booking_completed.booking_number}")
        except ValueError as exc:
            self.stdout.write(self.style.WARNING(f"  Completed booking skipped: {exc}"))
            booking_completed = None

        # Booking 3 — emergency today
        try:
            booking_emergency = ot_services.create_booking(
                room=room_emergency,
                patient=patient,
                surgery_name="Emergency Exploratory Laparotomy",
                surgery_category="general",
                priority="emergency",
                scheduled_date=today,
                scheduled_start=time(14, 0),
                scheduled_end=time(17, 0),
                primary_surgeon=surgeon,
                diagnosis="Hollow viscus perforation — peritonitis",
                planned_procedure="Emergency exploratory laparotomy",
                booked_by=admin,
                booking_notes="Brought via A&E. Consent obtained from next of kin.",
            )
            self.stdout.write(f"  Created emergency booking: {booking_emergency.booking_number}")
        except ValueError as exc:
            self.stdout.write(self.style.WARNING(f"  Emergency booking skipped: {exc}"))
            booking_emergency = None

        # ── 6. Full clinical record for the completed booking ────────────
        if booking_completed:
            self.stdout.write("Creating clinical records for completed booking…")

            # Simulate start + completion to set actual timestamps
            if booking_completed.status == "scheduled":
                booking_completed = ot_services.start_surgery(booking_completed)
                # Backdate actual_start to yesterday
                booking_completed.actual_start = datetime.combine(
                    yesterday, time(8, 10), tzinfo=tz
                )
                booking_completed.save()
                booking_completed = ot_services.complete_surgery(booking_completed)
                # Backdate actual_end to yesterday
                booking_completed.actual_end = datetime.combine(
                    yesterday, time(11, 50), tzinfo=tz
                )
                booking_completed.save()

            # Pre-Op Assessment
            PreOpAssessment.objects.get_or_create(
                booking=booking_completed,
                defaults={
                    "asa_grade": "II",
                    "fitness_status": "fit",
                    "weight": 72.0,
                    "height": 168.0,
                    "bmi": 25.5,
                    "blood_group": "B+",
                    "allergies": "NKDA",
                    "drug_allergies": [],
                    "latex_allergy": False,
                    "comorbidities": ["Type 2 Diabetes Mellitus", "Hypertension"],
                    "haemoglobin": 11.8,
                    "platelet_count": 210,
                    "inr": 1.0,
                    "anaesthesia_type": "Spinal anaesthesia",
                    "informed_consent_obtained": True,
                    "consent_date": yesterday,
                    "fitness_notes": "Cleared for surgery. HbA1c 7.2%. BP controlled.",
                    "assessed_by": surgeon,
                },
            )

            # Safety checklists — all phases completed
            checklist_items = {
                "sign_in": {
                    "patient_identity_confirmed": True,
                    "site_marked": True,
                    "allergies_checked": True,
                    "anaesthesia_equipment_checked": True,
                    "pulse_oximeter_attached": True,
                    "consent_obtained": True,
                },
                "timeout": {
                    "team_confirmed_patient": True,
                    "site_and_procedure_confirmed": True,
                    "antibiotic_prophylaxis_given": True,
                    "critical_steps_reviewed": True,
                    "imaging_displayed": True,
                },
                "sign_out": {
                    "procedure_recorded": True,
                    "instrument_count_complete": True,
                    "specimen_labelled": True,
                    "equipment_issues_addressed": True,
                    "post_op_plan_communicated": True,
                },
            }
            for phase, items in checklist_items.items():
                SurgicalSafetyChecklist.objects.get_or_create(
                    booking=booking_completed,
                    phase=phase,
                    defaults={
                        "completed": True,
                        "completed_at": datetime.combine(yesterday, time(8, 5), tzinfo=tz),
                        "items": items,
                        "completed_by": admin,
                    },
                )

            # Intraoperative Record + vitals + drugs
            intraop, _ = IntraoperativeRecord.objects.get_or_create(
                booking=booking_completed,
                defaults={
                    "operative_findings": "Severely degenerated articular cartilage, osteophytes present. No neurovascular injury.",
                    "procedure_performed": "Total knee arthroplasty (cemented). Patella resurfaced.",
                    "iv_fluids_ml": 1500,
                    "estimated_blood_loss_ml": 350,
                    "urine_output_ml": 400,
                    "wound_classification": "clean",
                    "drain_placed": True,
                    "drain_details": "1 × Romovac drain placed in joint space",
                    "instrument_count_correct": True,
                    "sponge_count_correct": True,
                    "needle_count_correct": True,
                    "closure_technique": "Subcutaneous and skin closure with staples",
                    "suture_material": "Vicryl 1-0 subcutaneous; staples skin",
                    "documented_by": admin,
                },
            )

            # Vitals every 30 minutes
            vital_times = [time(8, 10), time(8, 40), time(9, 10), time(9, 40), time(10, 10), time(10, 40), time(11, 20)]
            for vt in vital_times:
                IntraopVital.objects.get_or_create(
                    intraop_record=intraop,
                    recorded_at=datetime.combine(yesterday, vt, tzinfo=tz),
                    defaults={
                        "bp_systolic": 128,
                        "bp_diastolic": 76,
                        "heart_rate": 74,
                        "spo2": 99,
                        "temperature": 36.6,
                        "etco2": None,
                        "respiratory_rate": 14,
                    },
                )

            # Drug administrations
            drug_data = [
                {
                    "drug_name": "Bupivacaine 0.5%",
                    "dose": "15",
                    "unit": "mg",
                    "route": "it",
                    "administered_at": datetime.combine(yesterday, time(8, 5), tzinfo=tz),
                    "indication": "Spinal anaesthesia induction",
                    "administered_by": admin,
                },
                {
                    "drug_name": "Fentanyl",
                    "dose": "25",
                    "unit": "mcg",
                    "route": "it",
                    "administered_at": datetime.combine(yesterday, time(8, 5), tzinfo=tz),
                    "indication": "Intrathecal adjuvant for analgesia",
                    "administered_by": admin,
                },
                {
                    "drug_name": "Cefazolin",
                    "dose": "2",
                    "unit": "g",
                    "route": "iv",
                    "administered_at": datetime.combine(yesterday, time(7, 50), tzinfo=tz),
                    "indication": "Antibiotic prophylaxis",
                    "administered_by": admin,
                },
            ]
            for dd in drug_data:
                DrugAdministration.objects.get_or_create(
                    intraop_record=intraop,
                    drug_name=dd["drug_name"],
                    administered_at=dd["administered_at"],
                    defaults={k: v for k, v in dd.items() if k not in ("drug_name", "administered_at")},
                )

            # Anaesthesia Record
            AnaesthesiaRecord.objects.get_or_create(
                booking=booking_completed,
                defaults={
                    "anaesthesiologist": anaesthesiologist,
                    "anaesthesia_type": "spinal",
                    "airway_management": "none",
                    "induction_time": datetime.combine(yesterday, time(8, 5), tzinfo=tz),
                    "induction_agents": ["Bupivacaine 0.5% heavy 15mg", "Fentanyl 25mcg IT"],
                    "maintenance_agents": ["Spinal block maintained"],
                    "reversal_agents": [],
                    "regional_block_details": "L3-L4 interspinous approach, 25G Quincke needle, 3 mL injected",
                    "nerve_stimulator_used": False,
                    "ultrasound_guided": False,
                    "monitoring_used": ["ECG", "SpO2", "NIBP", "Temperature"],
                    "lines_placed": ["18G PIV right forearm"],
                    "complications": "None",
                    "difficult_intubation": False,
                    "intubation_attempts": 1,
                    "recovery_score_at_transfer": "Aldrete 9/10",
                    "post_op_pain_score": 3,
                    "nausea_vomiting": False,
                    "notes": "Uneventful spinal anaesthesia. Patient co-operative throughout.",
                },
            )

            # Operative Note
            OperativeNote.objects.get_or_create(
                booking=booking_completed,
                defaults={
                    "procedure_name": "Total Knee Replacement (Right) — Cemented",
                    "indication": "Severe osteoarthritis right knee, failed conservative management for 2 years.",
                    "anaesthesia_given": "Spinal anaesthesia (Bupivacaine 0.5% heavy + Fentanyl)",
                    "patient_position": "Supine with right knee flexed on leg holder",
                    "incision": "Midline anterior knee incision, 12 cm",
                    "operative_findings": "Severely degenerated articular cartilage all compartments; large medial osteophytes. Intact ligaments.",
                    "steps_performed": (
                        "1. Standard medial parapatellar arthrotomy.\n"
                        "2. Distal femoral resection — 5° valgus, 3° flexion.\n"
                        "3. Proximal tibial resection — 3° posterior slope.\n"
                        "4. Trial components fitted — good alignment, balance achieved.\n"
                        "5. Pulsatile lavage.\n"
                        "6. Bone cement mixed and applied. Final components impacted.\n"
                        "7. Patella resurfaced.\n"
                        "8. Romovac drain placed.\n"
                        "9. Wound closed in layers."
                    ),
                    "implants_used": "Knee implant total system (Batch: IMP-2024-KNEE-01), Bone cement (Batch: CEM-2024-01)",
                    "specimens_sent": "None",
                    "blood_loss": "350 mL",
                    "complications": "None",
                    "closure": "Vicryl 1-0 subcutaneous; skin staples",
                    "post_op_instructions": "Elevate limb. Physiotherapy from Day 1. Romovac drain removal at 48 h.",
                    "dictated_by": surgeon,
                    "signed_at": datetime.combine(yesterday, time(13, 0), tzinfo=tz),
                },
            )

            # OT Bill
            ot_services.calculate_ot_bill(booking_completed)
            self.stdout.write(f"  OT bill calculated for {booking_completed.booking_number}")

            # Surgical Outcome
            SurgicalOutcome.objects.get_or_create(
                booking=booking_completed,
                defaults={
                    "wound_class": "I",
                    "ssi_occurred": False,
                    "intraop_complications": "None",
                    "postop_complications": "Mild post-op pain — managed with analgesics.",
                    "reoperation_required": False,
                    "icu_admission": False,
                    "hospital_stay_days": 4,
                    "thirty_day_outcome": "recovered",
                    "thirty_day_mortality": False,
                    "audit_notes": "Uncomplicated primary TKR. Good ROM at discharge.",
                    "recorded_by": admin,
                },
            )
            self.stdout.write(self.style.SUCCESS(f"  Full clinical record created for {booking_completed.booking_number}"))

        # ── 7. OT Inventory ──────────────────────────────────────────────
        self.stdout.write("Creating OT inventory items…")
        for item in INVENTORY_ITEMS:
            OTInventoryItem.objects.get_or_create(
                sku=item["sku"],
                defaults={
                    "name": item["name"],
                    "category": item["category"],
                    "unit": item["unit"],
                    "quantity_in_stock": item["qty"],
                    "reorder_level": item["reorder"],
                    "unit_cost": item["cost"],
                    "is_active": True,
                },
            )
        self.stdout.write(self.style.SUCCESS(f"  Created/found {len(INVENTORY_ITEMS)} inventory items"))

        # ── 8. CSSD Batches ──────────────────────────────────────────────
        self.stdout.write("Creating CSSD batches…")
        cssd_data = [
            {
                "batch_number": "CSSD-2026-0001",
                "instrument_set_name": "General Surgery Instrument Set",
                "sterilization_method": "Autoclave",
                "sterilization_date": today,
                "expiry_date": today + timedelta(days=7),
                "status": "ready",
                "ot_booking": booking_elective,
                "notes": "Class 4 indicator passed. Ready for Major OT 1.",
            },
            {
                "batch_number": "CSSD-2026-0002",
                "instrument_set_name": "Orthopaedic Power Drill Set",
                "sterilization_method": "Plasma",
                "sterilization_date": yesterday,
                "expiry_date": yesterday + timedelta(days=7),
                "status": "used",
                "ot_booking": booking_completed,
                "notes": "Used for TKR case. Returned to CSSD for reprocessing.",
            },
        ]
        for cd in cssd_data:
            CSSDBatch.objects.get_or_create(
                batch_number=cd["batch_number"],
                defaults={k: v for k, v in cd.items() if k != "batch_number"},
            )
        self.stdout.write(self.style.SUCCESS("  Created/found 2 CSSD batches"))

        self.stdout.write(self.style.SUCCESS("\nOT module seeded successfully."))
