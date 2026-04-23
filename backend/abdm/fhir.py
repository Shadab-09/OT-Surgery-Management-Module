"""Minimal FHIR R4 bundle builder for ABDM OPConsultation records.

We build just enough of the ABDM "OP Consult Record" profile so Eka Care's
HIP endpoint can accept it. This is not a complete IG implementation — it
covers: Composition, Patient, Practitioner, Encounter, Observation (vitals),
Condition (diagnosis), MedicationRequest (prescription), ServiceRequest (lab).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any


def _urn() -> str:
    return f"urn:uuid:{uuid.uuid4()}"


def _iso(dt) -> str:
    if isinstance(dt, datetime):
        return dt.isoformat()
    return datetime.utcnow().isoformat() + "Z"


def build_op_consult_bundle(visit) -> dict[str, Any]:
    """Turn an `opd.models.Visit` into a FHIR R4 Bundle (dict)."""
    patient = visit.patient
    doctor = visit.doctor
    abha = getattr(patient, "abha", None)

    patient_ref = _urn()
    practitioner_ref = _urn()
    encounter_ref = _urn()
    composition_ref = _urn()

    resources: list[dict] = []

    # Patient
    patient_identifiers = [
        {"system": "https://aiims.local/mrn", "value": patient.mrn},
    ]
    if abha:
        patient_identifiers.append(
            {"system": "https://healthid.abdm.gov.in", "value": abha.abha_number},
        )
    resources.append({
        "fullUrl": patient_ref,
        "resource": {
            "resourceType": "Patient",
            "id": str(patient.id),
            "identifier": patient_identifiers,
            "name": [{"text": patient.full_name}],
            "gender": {"M": "male", "F": "female", "O": "other"}.get(patient.gender, "unknown"),
            "birthDate": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
            "telecom": [t for t in [
                ({"system": "phone", "value": patient.phone} if patient.phone else None),
                ({"system": "email", "value": patient.email} if patient.email else None),
            ] if t],
        },
    })

    # Practitioner
    practitioner_identifiers = [
        {"system": "https://aiims.local/doctor", "value": doctor.registration_number},
    ]
    if doctor.hpr_id:
        practitioner_identifiers.append(
            {"system": "https://hpr.abdm.gov.in", "value": doctor.hpr_id},
        )
    resources.append({
        "fullUrl": practitioner_ref,
        "resource": {
            "resourceType": "Practitioner",
            "id": str(doctor.id),
            "identifier": practitioner_identifiers,
            "name": [{"text": doctor.full_name, "prefix": ["Dr."]}],
            "qualification": [{"code": {"text": doctor.qualifications or ""}}] if doctor.qualifications else [],
        },
    })

    # Encounter
    resources.append({
        "fullUrl": encounter_ref,
        "resource": {
            "resourceType": "Encounter",
            "id": visit.visit_number,
            "status": "finished" if visit.status == "closed" else "in-progress",
            "class": {"system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB", "display": "Ambulatory"},
            "subject": {"reference": patient_ref},
            "participant": [{"individual": {"reference": practitioner_ref}}],
            "period": {
                "start": _iso(visit.opened_at),
                "end": _iso(visit.closed_at) if visit.closed_at else None,
            },
            "reasonCode": [{"text": visit.chief_complaints}] if visit.chief_complaints else [],
        },
    })

    # Observations (Vitals)
    vitals_refs: list[str] = []
    vitals = getattr(visit, "vitals", None)
    if vitals:
        def obs(code: str, display: str, value: float | int | None, unit: str):
            if value is None:
                return None
            ref = _urn()
            vitals_refs.append(ref)
            return {
                "fullUrl": ref,
                "resource": {
                    "resourceType": "Observation", "status": "final",
                    "category": [{"coding": [{"system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs"}]}],
                    "code": {"coding": [{"system": "http://loinc.org", "code": code, "display": display}]},
                    "subject": {"reference": patient_ref},
                    "encounter": {"reference": encounter_ref},
                    "effectiveDateTime": _iso(visit.opened_at),
                    "valueQuantity": {"value": float(value), "unit": unit},
                },
            }

        for res in [
            obs("8310-5", "Body temperature", vitals.temperature_c, "Cel"),
            obs("8867-4", "Heart rate", vitals.pulse_bpm, "/min"),
            obs("8480-6", "Systolic blood pressure", vitals.systolic_bp, "mm[Hg]"),
            obs("8462-4", "Diastolic blood pressure", vitals.diastolic_bp, "mm[Hg]"),
            obs("9279-1", "Respiratory rate", vitals.respiratory_rate, "/min"),
            obs("59408-5", "Oxygen saturation", vitals.spo2, "%"),
            obs("8302-2", "Body height", vitals.height_cm, "cm"),
            obs("29463-7", "Body weight", vitals.weight_kg, "kg"),
            obs("39156-5", "BMI", vitals.bmi, "kg/m2"),
        ]:
            if res:
                resources.append(res)

    # Conditions (Diagnoses)
    diagnosis_refs: list[str] = []
    for dx in visit.diagnoses.all():
        ref = _urn()
        diagnosis_refs.append(ref)
        coding = []
        if dx.icd10_code:
            coding.append({"system": "http://hl7.org/fhir/sid/icd-10", "code": dx.icd10_code})
        if dx.snomed_code:
            coding.append({"system": "http://snomed.info/sct", "code": dx.snomed_code})
        resources.append({
            "fullUrl": ref,
            "resource": {
                "resourceType": "Condition",
                "verificationStatus": {"coding": [{"code": dx.kind}]},
                "code": {"coding": coding, "text": dx.description},
                "subject": {"reference": patient_ref},
                "encounter": {"reference": encounter_ref},
                "recordedDate": _iso(dx.created_at),
            },
        })

    # MedicationRequests (Prescription)
    medication_refs: list[str] = []
    rx = getattr(visit, "prescription", None)
    if rx:
        for item in rx.items.all():
            ref = _urn()
            medication_refs.append(ref)
            resources.append({
                "fullUrl": ref,
                "resource": {
                    "resourceType": "MedicationRequest",
                    "status": "active", "intent": "order",
                    "medicationCodeableConcept": {
                        "coding": ([{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": item.rx_norm_code}]
                                   if item.rx_norm_code else []),
                        "text": f"{item.drug_name} {item.strength}".strip(),
                    },
                    "subject": {"reference": patient_ref},
                    "encounter": {"reference": encounter_ref},
                    "authoredOn": _iso(rx.signed_at or rx.created_at),
                    "requester": {"reference": practitioner_ref},
                    "dosageInstruction": [{
                        "text": f"{item.frequency} for {item.duration_days} days. {item.instructions}".strip(),
                        "route": {"text": item.route},
                    }],
                },
            })

    # ServiceRequests (Lab orders)
    servicerequest_refs: list[str] = []
    for lab in visit.lab_orders.all():
        ref = _urn()
        servicerequest_refs.append(ref)
        resources.append({
            "fullUrl": ref,
            "resource": {
                "resourceType": "ServiceRequest",
                "status": "active", "intent": "order",
                "priority": "routine" if lab.urgency == "routine" else "urgent",
                "code": {
                    "coding": ([{"system": "http://loinc.org", "code": lab.test_code}] if lab.test_code else []),
                    "text": lab.test_name,
                },
                "subject": {"reference": patient_ref},
                "encounter": {"reference": encounter_ref},
                "authoredOn": _iso(lab.created_at),
                "requester": {"reference": practitioner_ref},
            },
        })

    # Composition (OP Consult)
    sections = [
        {"title": "Chief complaints", "code": {"text": "chief-complaints"},
         "text": {"status": "additional", "div": f"<div xmlns=\"http://www.w3.org/1999/xhtml\">{visit.chief_complaints or '—'}</div>"}},
    ]
    if vitals_refs:
        sections.append({"title": "Vital signs", "entry": [{"reference": r} for r in vitals_refs]})
    if diagnosis_refs:
        sections.append({"title": "Diagnoses", "entry": [{"reference": r} for r in diagnosis_refs]})
    if medication_refs:
        sections.append({"title": "Medications", "entry": [{"reference": r} for r in medication_refs]})
    if servicerequest_refs:
        sections.append({"title": "Investigations", "entry": [{"reference": r} for r in servicerequest_refs]})

    resources.insert(0, {
        "fullUrl": composition_ref,
        "resource": {
            "resourceType": "Composition",
            "status": "final",
            "type": {"coding": [{"system": "http://snomed.info/sct", "code": "371530004", "display": "Clinical consultation report"}]},
            "subject": {"reference": patient_ref},
            "encounter": {"reference": encounter_ref},
            "date": _iso(visit.closed_at or visit.opened_at),
            "author": [{"reference": practitioner_ref}],
            "title": f"OP Consultation — {visit.visit_number}",
            "section": sections,
        },
    })

    return {
        "resourceType": "Bundle",
        "id": str(uuid.uuid4()),
        "type": "document",
        "timestamp": _iso(visit.closed_at or datetime.utcnow()),
        "entry": resources,
    }
