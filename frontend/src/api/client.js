import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const lang = localStorage.getItem('ui-lang')
  if (lang) {
    config.headers['Accept-Language'] = lang
    config.params = { ...(config.params || {}), lang }
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
    }
    return Promise.reject(err)
  },
)

export default api

// ── Endpoint helpers ─────────────────────────────────────────────
export const Auth = {
  login: (username, password) => api.post('/auth/login/', { username, password }),
  me: () => api.get('/accounts/users/me/'),
}

export const Departments = {
  list: (params) => api.get('/core/departments/', { params }),
  get: (id) => api.get(`/core/departments/${id}/`),
  create: (data) => api.post('/core/departments/', data),
  update: (id, data) => api.patch(`/core/departments/${id}/`, data),
  remove: (id) => api.delete(`/core/departments/${id}/`),
}

export const Services = {
  list: (params) => api.get('/core/services/', { params }),
  create: (data) => api.post('/core/services/', data),
  update: (id, data) => api.patch(`/core/services/${id}/`, data),
  remove: (id) => api.delete(`/core/services/${id}/`),
}

export const Counters = {
  list: (params) => api.get('/core/counters/', { params }),
  create: (data) => api.post('/core/counters/', data),
  update: (id, data) => api.patch(`/core/counters/${id}/`, data),
  remove: (id) => api.delete(`/core/counters/${id}/`),
}

export const Patients = {
  list: (params) => api.get('/core/patients/', { params }),
  create: (data) => api.post('/core/patients/', data),
  update: (id, data) => api.patch(`/core/patients/${id}/`, data),
  remove: (id) => api.delete(`/core/patients/${id}/`),
  lookupUhid: (uhid) => api.get('/core/patients/lookup-uhid/', { params: { uhid } }),
}

export const DisplayBoards = {
  list: (params) => api.get('/core/display-boards/', { params }),
  create: (data) => api.post('/core/display-boards/', data),
}

export const Tokens = {
  list: (params) => api.get('/queues/tokens/', { params }),
  get: (id) => api.get(`/queues/tokens/${id}/`),
  issue: (data) => api.post('/queues/tokens/issue/', data),
  live: (params) => api.get('/queues/tokens/live/', { params }),
  callNext: (counterId) => api.post('/queues/tokens/call-next/', { counter: counterId }),
  start: (id) => api.post(`/queues/tokens/${id}/start/`),
  complete: (id, notes = '') => api.post(`/queues/tokens/${id}/complete/`, { notes }),
  recall: (id) => api.post(`/queues/tokens/${id}/recall/`),
  skip: (id) => api.post(`/queues/tokens/${id}/skip/`),
  cancel: (id, notes = '') => api.post(`/queues/tokens/${id}/cancel/`, { notes }),
  transfer: (id, counterId) => api.post(`/queues/tokens/${id}/transfer/`, { counter: counterId }),
  events: (id) => api.get(`/queues/tokens/${id}/events/`),
}

export const I18n = {
  bundle: (lang) => api.get('/queues/i18n/', { params: lang ? { lang } : {} }),
  languages: () => api.get('/queues/i18n/', { params: { list: 1 } }),
  announce: (payload) => api.post('/queues/announce/', payload),
}

export const Analytics = {
  overview: (params) => api.get('/analytics/overview/', { params }),
  trends: (params) => api.get('/analytics/trends/', { params }),
}

export const Notifications = {
  list: (params) => api.get('/notifications/notifications/', { params }),
  create: (data) => api.post('/notifications/notifications/', data),
}

// ── OPD ────────────────────────────────────────────────────────────
export const Doctors = {
  list: (params) => api.get('/opd/doctors/', { params }),
  get: (id) => api.get(`/opd/doctors/${id}/`),
  create: (data) => api.post('/opd/doctors/', data),
  update: (id, data) => api.patch(`/opd/doctors/${id}/`, data),
  remove: (id) => api.delete(`/opd/doctors/${id}/`),
  slots: (id, date) => api.get(`/opd/doctors/${id}/slots/`, { params: { date } }),
}

export const Schedules = {
  list: (params) => api.get('/opd/schedules/', { params }),
  create: (data) => api.post('/opd/schedules/', data),
  update: (id, data) => api.patch(`/opd/schedules/${id}/`, data),
  remove: (id) => api.delete(`/opd/schedules/${id}/`),
}

export const Appointments = {
  list: (params) => api.get('/opd/appointments/', { params }),
  get: (id) => api.get(`/opd/appointments/${id}/`),
  today: () => api.get('/opd/appointments/today/'),
  book: (data) => api.post('/opd/appointments/book/', data),
  checkIn: (id) => api.post(`/opd/appointments/${id}/check-in/`),
  cancel: (id, reason = '') => api.post(`/opd/appointments/${id}/cancel/`, { reason }),
}

export const Visits = {
  list: (params) => api.get('/opd/visits/', { params }),
  get: (id) => api.get(`/opd/visits/${id}/`),
  update: (id, data) => api.patch(`/opd/visits/${id}/`, data),
  start: (data) => api.post('/opd/visits/start/', data),
  close: (id, push = true) => api.post(`/opd/visits/${id}/close/`, { push_to_abdm: push }),
  setVitals: (id, data) => api.post(`/opd/visits/${id}/vitals/`, data),
  addDiagnosis: (id, data) => api.post(`/opd/visits/${id}/diagnoses/`, data),
  setPrescription: (id, data) => api.post(`/opd/visits/${id}/prescription/`, data),
  addLabOrder: (id, data) => api.post(`/opd/visits/${id}/lab-orders/`, data),
}

export const LabOrders = {
  list: (params) => api.get('/opd/lab-orders/', { params }),
  update: (id, data) => api.patch(`/opd/lab-orders/${id}/`, data),
}

// ── ABDM / Eka Care ────────────────────────────────────────────────
export const ABHA = {
  list: (params) => api.get('/abdm/abha/', { params }),
  get: (id) => api.get(`/abdm/abha/${id}/`),
  aadhaarStart: (data) => api.post('/abdm/abha/aadhaar/start/', data),
  aadhaarVerify: (data) => api.post('/abdm/abha/aadhaar/verify/', data),
  mobileStart: (data) => api.post('/abdm/abha/mobile/start/', data),
  mobileVerify: (data) => api.post('/abdm/abha/mobile/verify/', data),
  refresh: (id) => api.post(`/abdm/abha/${id}/refresh/`),
  card: (id) => api.get(`/abdm/abha/${id}/card/`),
}

export const HealthRecords = {
  list: (params) => api.get('/abdm/health-records/', { params }),
  pushVisit: (visit) => api.post('/abdm/health-records/push-visit/', { visit }),
}

export const Consents = {
  list: (params) => api.get('/abdm/consents/', { params }),
  request: (data) => api.post('/abdm/consents/request/', data),
}

export const ABDMTransactions = {
  list: (params) => api.get('/abdm/transactions/', { params }),
}

export const CareContexts = {
  list: (params) => api.get('/abdm/care-contexts/', { params }),
}

// ── OT (Operation Theatre) ────────────────────────────────────────
export const OTRooms = {
  list: (params) => api.get('/ot/rooms/', { params }),
  get: (id) => api.get(`/ot/rooms/${id}/`),
  create: (data) => api.post('/ot/rooms/', data),
  update: (id, data) => api.patch(`/ot/rooms/${id}/`, data),
  available: () => api.get('/ot/rooms/available/'),
}

export const OTTeam = {
  list: (params) => api.get('/ot/team-members/', { params }),
  create: (data) => api.post('/ot/team-members/', data),
  update: (id, data) => api.patch(`/ot/team-members/${id}/`, data),
}

export const OTBookings = {
  list: (params) => api.get('/ot/bookings/', { params }),
  get: (id) => api.get(`/ot/bookings/${id}/`),
  create: (data) => api.post('/ot/bookings/', data),
  update: (id, data) => api.patch(`/ot/bookings/${id}/`, data),
  today: () => api.get('/ot/bookings/today/'),
  dashboard: () => api.get('/ot/bookings/dashboard/'),
  timeline: (id) => api.get(`/ot/bookings/${id}/timeline/`),
  start: (id) => api.post(`/ot/bookings/${id}/start/`),
  complete: (id) => api.post(`/ot/bookings/${id}/complete/`),
  cancel: (id, reason = '') => api.post(`/ot/bookings/${id}/cancel/`, { reason }),
  postpone: (id, data) => api.post(`/ot/bookings/${id}/postpone/`, data),
  initChecklist: (id) => api.post(`/ot/bookings/${id}/init-checklist/`),
}

export const OTPreOp = {
  list: (params) => api.get('/ot/pre-op-assessments/', { params }),
  create: (data) => api.post('/ot/pre-op-assessments/', data),
  update: (id, data) => api.patch(`/ot/pre-op-assessments/${id}/`, data),
}

export const OTChecklist = {
  list: (params) => api.get('/ot/safety-checklists/', { params }),
  completePhase: (id, data) => api.post(`/ot/safety-checklists/${id}/complete-phase/`, data),
}

export const OTIntraop = {
  list: (params) => api.get('/ot/intraop-records/', { params }),
  get: (id) => api.get(`/ot/intraop-records/${id}/`),
  create: (data) => api.post('/ot/intraop-records/', data),
  update: (id, data) => api.patch(`/ot/intraop-records/${id}/`, data),
  addVital: (id, data) => api.post(`/ot/intraop-records/${id}/add-vital/`, data),
  addDrug: (id, data) => api.post(`/ot/intraop-records/${id}/add-drug/`, data),
  addBloodProduct: (id, data) => api.post(`/ot/intraop-records/${id}/add-blood-product/`, data),
  addSpecimen: (id, data) => api.post(`/ot/intraop-records/${id}/add-specimen/`, data),
}

export const OTAnaesthesia = {
  list: (params) => api.get('/ot/anaesthesia-records/', { params }),
  create: (data) => api.post('/ot/anaesthesia-records/', data),
  update: (id, data) => api.patch(`/ot/anaesthesia-records/${id}/`, data),
}

export const OTImplants = {
  list: (params) => api.get('/ot/implants/', { params }),
  create: (data) => api.post('/ot/implants/', data),
  update: (id, data) => api.patch(`/ot/implants/${id}/`, data),
  remove: (id) => api.delete(`/ot/implants/${id}/`),
}

export const OTPostOpOrders = {
  list: (params) => api.get('/ot/post-op-orders/', { params }),
  create: (data) => api.post('/ot/post-op-orders/', data),
  update: (id, data) => api.patch(`/ot/post-op-orders/${id}/`, data),
}

export const OTRecovery = {
  list: (params) => api.get('/ot/recovery-records/', { params }),
  create: (data) => api.post('/ot/recovery-records/', data),
  update: (id, data) => api.patch(`/ot/recovery-records/${id}/`, data),
}

export const OTOperativeNotes = {
  list: (params) => api.get('/ot/operative-notes/', { params }),
  create: (data) => api.post('/ot/operative-notes/', data),
  update: (id, data) => api.patch(`/ot/operative-notes/${id}/`, data),
  sign: (id) => api.post(`/ot/operative-notes/${id}/sign/`),
}

export const OTBills = {
  list: (params) => api.get('/ot/bills/', { params }),
  create: (data) => api.post('/ot/bills/', data),
  update: (id, data) => api.patch(`/ot/bills/${id}/`, data),
  finalize: (id) => api.post(`/ot/bills/${id}/finalize/`),
  recalculate: (id) => api.post(`/ot/bills/${id}/recalculate/`),
}

export const OTOutcomes = {
  list: (params) => api.get('/ot/outcomes/', { params }),
  create: (data) => api.post('/ot/outcomes/', data),
  update: (id, data) => api.patch(`/ot/outcomes/${id}/`, data),
}

export const OTInventory = {
  list: (params) => api.get('/ot/inventory/', { params }),
  create: (data) => api.post('/ot/inventory/', data),
  update: (id, data) => api.patch(`/ot/inventory/${id}/`, data),
  lowStock: () => api.get('/ot/inventory/low-stock/'),
  adjustStock: (id, data) => api.post(`/ot/inventory/${id}/adjust-stock/`, data),
}

export const OTCssd = {
  list: (params) => api.get('/ot/cssd/', { params }),
  create: (data) => api.post('/ot/cssd/', data),
  update: (id, data) => api.patch(`/ot/cssd/${id}/`, data),
}
