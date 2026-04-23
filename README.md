# Digital AIIMS — Queue + OPD + ABDM (Eka Care)

An API-first hospital platform with three composed modules:

1. **Queue Management** — token issuance, priority routing, counters, display boards.
2. **OPD (Out-Patient Department)** — doctors, schedules, appointments, clinical visits
   (vitals · diagnoses · prescriptions · lab orders).
3. **ABDM / Eka Care integration** — ABHA (Ayushman Bharat Health Account) enrolment
   via Aadhaar or mobile OTP, care-context linking, and FHIR bundle push to the
   Eka Care HIP gateway when a visit is closed.

Stack: Django 5 + DRF backend, React 18 + Vite + Redux Toolkit + Router v7 frontend.

## Structure

```
backend/                  Django 5 + DRF
  config/                 project (settings, urls)
  accounts/               custom User (admin/operator/doctor/manager/patient)
  core/                   Department, Service, Counter, Patient, DisplayBoard
  queues/                 Token, TokenEvent, QueueCounter + business-logic service layer
  notifications/          Notification log (SMS / App / Display / Audio)
  analytics/              DailyQueueStat + live overview/trends endpoints
  opd/                    Doctor, DoctorSchedule, Appointment, Visit, Vitals,
                          Diagnosis, Prescription/PrescriptionItem, LabOrder
  abdm/                   ABHAProfile, CareContext, HealthRecordLink, ConsentRequest,
                          ABDMTransaction — plus `eka_client.py` (REST client),
                          `fhir.py` (R4 bundle builder), `services.py` (orchestration).

frontend/                 Vite + React 18 + Redux Toolkit + Router v7 + Recharts
  src/api/client.js       axios client + typed endpoint helpers
  src/pages/              Dashboard, Kiosk, Counter, Display, Tokens,
                          Departments, Services, CountersPage, Patients,
                          AnalyticsPage, NotificationsPage,
                          Doctors, Appointments, Visits, VisitDetail,
                          ABHA, HealthRecords
```

## Backend setup

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_queue    # departments, services, counters, patients, tokens, admin
python manage.py seed_opd      # doctors, schedules, demo appointments, one closed visit
python manage.py seed_abdm     # two demo ABHA profiles against MRN001 / MRN002
python manage.py runserver     # http://127.0.0.1:8000
```

Admin: `admin / admin12345` — API docs: `/api/docs/`

### Key endpoints

#### Queue (existing)
| Method | URL | Purpose |
|--------|-----|---------|
| POST   | `/api/auth/login/` | JWT login |
| GET    | `/api/core/{departments,services,counters,patients,display-boards}/` | Master-data CRUD |
| POST   | `/api/queues/tokens/issue/` | Token generation |
| GET    | `/api/queues/tokens/live/?department=` | Live queue snapshot |
| POST   | `/api/queues/tokens/call-next/` | Pull next token |
| POST   | `/api/queues/tokens/{id}/{start,complete,recall,skip,cancel,transfer}/` | Counter actions |
| GET    | `/api/analytics/{overview,trends}/` | KPIs & trends |

#### OPD
| Method | URL | Purpose |
|--------|-----|---------|
| GET/POST | `/api/opd/doctors/` | Doctor CRUD |
| GET    | `/api/opd/doctors/{id}/slots/?date=YYYY-MM-DD` | Available slots for a day |
| GET/POST | `/api/opd/schedules/` | Weekly recurring OPD schedule |
| GET    | `/api/opd/appointments/today/` | All of today's appointments |
| POST   | `/api/opd/appointments/book/` | Book appointment (clash-checked) |
| POST   | `/api/opd/appointments/{id}/check-in/` | Check-in — **issues a queue token** |
| POST   | `/api/opd/appointments/{id}/cancel/` | Cancel |
| POST   | `/api/opd/visits/start/` | Start a clinical visit |
| POST   | `/api/opd/visits/{id}/vitals/` | Record/update vitals |
| POST   | `/api/opd/visits/{id}/diagnoses/` | Add a diagnosis |
| POST   | `/api/opd/visits/{id}/prescription/` | Create/replace prescription + items |
| POST   | `/api/opd/visits/{id}/lab-orders/` | Order a lab/radiology test |
| POST   | `/api/opd/visits/{id}/close/` | Close visit (and auto-push to ABDM) |

#### ABDM / Eka Care
| Method | URL | Purpose |
|--------|-----|---------|
| POST   | `/api/abdm/abha/aadhaar/start/`  | Request Aadhaar OTP |
| POST   | `/api/abdm/abha/aadhaar/verify/` | Verify OTP → create ABHA & link to patient |
| POST   | `/api/abdm/abha/mobile/start/`   | Request mobile OTP |
| POST   | `/api/abdm/abha/mobile/verify/`  | Verify OTP → return linked ABHA addresses |
| GET    | `/api/abdm/abha/{id}/card/` | Download ABHA card (base64 PNG) |
| POST   | `/api/abdm/abha/{id}/refresh/` | Re-sync profile from gateway |
| POST   | `/api/abdm/consents/request/`    | HIU consent request |
| POST   | `/api/abdm/health-records/push-visit/` | Manually (re-)push a visit to ABDM |
| GET    | `/api/abdm/health-records/` | FHIR bundles shipped |
| GET    | `/api/abdm/transactions/`   | Full audit of every Eka Care API call |
| GET    | `/api/abdm/care-contexts/`  | Care contexts announced to ABDM |

### Eka Care configuration

`abdm/eka_client.py` supports two modes, switched by the `EKA_CARE_MODE` env var:

| Mode | Behaviour | When to use |
|------|-----------|-------------|
| `mock` *(default)* | No network calls. Returns plausible OTPs/IDs. OTP `123456` is always accepted. | Local dev, demos, tests, CI. |
| `live` | Real HTTPS to Eka Care. Needs `EKA_CARE_CLIENT_ID` / `EKA_CARE_CLIENT_SECRET` / `EKA_CARE_HIP_ID` / `EKA_CARE_HIU_ID`. Base URL defaults to `https://api.eka.care`. | Staging / production. |

Every call — mock or live — is journalled to `ABDMTransaction` so you can audit the
full Eka Care conversation from the Django admin or `/api/abdm/transactions/`.

### OPD → ABDM flow (verified end-to-end)

```
1) Book appointment            POST /api/opd/appointments/book/
2) Patient arrives: check-in   POST /api/opd/appointments/{id}/check-in/    → queue token issued
3) Doctor starts visit         POST /api/opd/visits/start/                  → Visit opened
4) Capture vitals/dx/rx/labs   POST /api/opd/visits/{id}/{vitals,diagnoses,prescription,lab-orders}/
5) Close visit                 POST /api/opd/visits/{id}/close/ {push_to_abdm:true}
      ├─ builds FHIR R4 bundle (OPConsultation Composition + Patient + Practitioner
      │  + Encounter + Observation(vitals) + Condition + MedicationRequest + ServiceRequest)
      ├─ POST /abdm/hip/v1/care-contexts/link                (Eka Care)
      ├─ POST /abdm/hip/v1/health-information/notify         (Eka Care HIP push)
      └─ records HealthRecordLink(status=acked, eka_request_id=...)
```

## Frontend setup

```bash
cd frontend
yarn install
yarn dev              # http://localhost:5173 (proxies /api → 127.0.0.1:8000)
yarn build
```

### Screens

**Queue:** Dashboard, Counter Service, Tokens, Kiosk, Display Board, Analytics, Notifications.

**OPD:**
- `/doctors` — Doctor CRUD, view slots per date.
- `/appointments` — Book, check-in, cancel; one-click **Start Consultation** jumps to the visit screen.
- `/visits` — All OPD visits with ABDM sync status.
- `/visits/:id` — Clinical chart: notes, vitals, diagnoses, prescription (multi-drug), lab orders; **Close & Push to ABDM**.

**ABDM:**
- `/abha` — Linked ABHA profiles; **Create via Aadhaar** (3-step OTP wizard); **Login via Mobile** (lists addresses linked to a phone); view ABHA card; refresh from gateway.
- `/health-records` — FHIR bundles shipped + raw payload viewer; full Eka Care API audit log.

## Tips for a demo

1. Run the three seed commands, start the server and `yarn dev`.
2. Book an appointment for **Ahmed Bilal (MRN003)** — he has no ABHA yet.
3. Go to **/abha → Create via Aadhaar** and enrol him. Aadhaar = `123456789012`, OTP = `123456`.
4. Back in **/appointments**, click check-in then ▶ to start the visit.
5. Fill vitals / diagnosis / rx / lab; click **Close & Push to ABDM**.
6. Jump to **/health-records** — the FHIR bundle is listed with `status=acked` and a mock `eka_request_id`. Toggle the Transactions tab to see every Eka Care API call the backend made.

## What's not built (yet)

- WebSocket live-push (Django Channels) instead of polling.
- Real SMS integration (Twilio/local gateway).
- Role-based permissions (all endpoints are `AllowAny` for dev; flip to `IsAuthenticated` in production).
- Eka Care `live` mode hits the real endpoints, but the ABDM production checklist (HIP/HIU onboarding, callback webhooks, signed artefacts) is out of scope for this demo repo.
