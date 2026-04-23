import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import api from '../../api/client'

const SURGERY_CATEGORIES = [
  { value: 'general', label: 'General Surgery' },
  { value: 'ortho', label: 'Orthopaedic' },
  { value: 'cardiac', label: 'Cardiac' },
  { value: 'neuro', label: 'Neurosurgery' },
  { value: 'ent', label: 'ENT' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'urology', label: 'Urology' },
  { value: 'gynaecology', label: 'Gynaecology & Obstetrics' },
  { value: 'paediatric', label: 'Paediatric Surgery' },
  { value: 'plastic', label: 'Plastic & Reconstructive' },
  { value: 'transplant', label: 'Transplant' },
  { value: 'laparoscopy', label: 'Laparoscopy' },
  { value: 'endoscopy', label: 'Endoscopy' },
  { value: 'other', label: 'Other' },
]

const BLANK_FORM = {
  patient_mrn: '',
  patient_name: '',
  patient_id: '',
  room: '',
  surgery_name: '',
  surgery_category: '',
  priority: 'elective',
  scheduled_date: new Date().toISOString().slice(0, 10),
  scheduled_start: '',
  scheduled_end: '',
  primary_surgeon: '',
  anaesthesiologist: '',
  ward: '',
  bed_number: '',
  diagnosis: '',
  planned_procedure: '',
  special_requirements: '',
  booking_notes: '',
}

export default function OTBookingForm() {
  const { id } = useParams()
  const nav = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({ ...BLANK_FORM })
  const [rooms, setRooms] = useState([])
  const [surgeons, setSurgeons] = useState([])
  const [anaesthesiologists, setAnaesthesiologists] = useState([])
  const [patientSearching, setPatientSearching] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    // Load rooms, surgeons, anaesthesiologists in parallel
    Promise.all([
      api.get('/ot/rooms/available/').catch(() => api.get('/ot/rooms/')),
      api.get('/ot/team-members/', { params: { role: 'primary_surgeon' } }),
      api.get('/ot/team-members/', { params: { role: 'anaesthesiologist' } }),
    ]).then(([rRes, sRes, aRes]) => {
      setRooms(Array.isArray(rRes.data) ? rRes.data : (rRes.data.results || []))
      setSurgeons(Array.isArray(sRes.data) ? sRes.data : (sRes.data.results || []))
      setAnaesthesiologists(Array.isArray(aRes.data) ? aRes.data : (aRes.data.results || []))
    }).catch(() => {})

    if (isEdit) {
      api.get(`/ot/bookings/${id}/`).then(res => {
        const d = res.data
        setForm({
          patient_mrn: d.patient_mrn || '',
          patient_name: d.patient_name || '',
          patient_id: d.patient || '',
          room: d.room || '',
          surgery_name: d.surgery_name || '',
          surgery_category: d.surgery_category || '',
          priority: d.priority || 'elective',
          scheduled_date: d.scheduled_date || new Date().toISOString().slice(0, 10),
          scheduled_start: d.scheduled_start ? d.scheduled_start.slice(0, 5) : '',
          scheduled_end: d.scheduled_end ? d.scheduled_end.slice(0, 5) : '',
          primary_surgeon: d.primary_surgeon || '',
          anaesthesiologist: d.anaesthesiologist || '',
          ward: d.ward || '',
          bed_number: d.bed_number || '',
          diagnosis: d.diagnosis || '',
          planned_procedure: d.planned_procedure || '',
          special_requirements: d.special_requirements || '',
          booking_notes: d.booking_notes || '',
        })
        setLoading(false)
      }).catch(() => setLoading(false))
    }
  }, [id, isEdit])

  const setF = (key, val) => {
    setForm(f => ({ ...f, [key]: val }))
    setErrors(e => ({ ...e, [key]: '' }))
  }

  const lookupPatient = async () => {
    if (!form.patient_mrn.trim()) return
    setPatientSearching(true)
    try {
      const res = await api.get('/core/patients/', { params: { search: form.patient_mrn } })
      const results = Array.isArray(res.data) ? res.data : (res.data.results || [])
      const p = results[0]
      if (!p) throw new Error('not found')
      setForm(f => ({ ...f, patient_name: p.full_name || '', patient_id: p.id }))
      setErrors(e => ({ ...e, patient_mrn: '' }))
    } catch {
      setErrors(e => ({ ...e, patient_mrn: 'No patient found for this MRN. Check the MRN and try again.' }))
      setForm(f => ({ ...f, patient_name: '', patient_id: '' }))
    } finally {
      setPatientSearching(false)
    }
  }

  const validate = () => {
    const e = {}
    if (!form.patient_mrn) e.patient_mrn = 'Patient MRN is required.'
    else if (!form.patient_id) e.patient_mrn = 'Click Search to verify the patient before saving.'
    if (!form.room) e.room = 'Please select a room.'
    if (!form.surgery_name) e.surgery_name = 'Surgery name is required.'
    if (!form.scheduled_date) e.scheduled_date = 'Scheduled date is required.'
    if (!form.scheduled_start) e.scheduled_start = 'Start time is required.'
    if (!form.primary_surgeon) e.primary_surgeon = 'Primary surgeon is required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patient_id && form.patient_mrn) await lookupPatient()
    if (!validate()) return
    setSaving(true)
    try {
      const payload = {
        patient: form.patient_id,
        room: form.room,
        surgery_name: form.surgery_name,
        surgery_category: form.surgery_category || '',
        priority: form.priority,
        scheduled_date: form.scheduled_date,
        scheduled_start: form.scheduled_start,
        scheduled_end: form.scheduled_end || form.scheduled_start,
        primary_surgeon: form.primary_surgeon,
        ...(form.anaesthesiologist ? { anaesthesiologist: form.anaesthesiologist } : {}),
        ward: form.ward,
        bed_number: form.bed_number,
        diagnosis: form.diagnosis,
        planned_procedure: form.planned_procedure,
        special_requirements: form.special_requirements,
        booking_notes: form.booking_notes,
      }
      let res
      if (isEdit) {
        res = await api.patch(`/ot/bookings/${id}/`, payload)
      } else {
        res = await api.post('/ot/bookings/', payload)
      }
      nav(`/ot/bookings/${res.data.id}`)
    } catch (err) {
      const d = err.response?.data
      if (d && typeof d === 'object') {
        const mapped = {}
        Object.entries(d).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v.join(' ') : String(v) })
        setErrors(mapped)
      } else {
        setErrors({ __general: d?.detail || 'Failed to save booking.' })
      }
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = (field) => ({
    border: `1px solid ${errors[field] ? '#ef4444' : '#d1d5db'}`,
    borderRadius: 6, padding: '9px 12px', fontSize: '0.875rem',
    color: '#1f2937', background: '#fff', width: '100%',
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#6b7280' }}>Loading…</span>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.4rem', color: '#1f2937' }}>
            {isEdit ? 'Edit Booking' : 'New OT Booking'}
          </h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
            {isEdit ? `Editing booking #${id}` : 'Schedule a new operation theatre procedure'}
          </p>
        </div>
        <Link to={isEdit ? `/ot/bookings/${id}` : '/ot/schedule'} className="btn">
          <i className="bi bi-arrow-left" /> {isEdit ? 'Back to Booking' : 'Back to Schedule'}
        </Link>
      </div>

      {errors.__general && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          <i className="bi bi-exclamation-triangle" /> {errors.__general}
        </div>
      )}
      {successMsg && (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          <i className="bi bi-check-circle" /> {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
          {/* LEFT COLUMN */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 18px', fontSize: '0.95rem', fontWeight: 700, color: '#1f2937', paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
              <i className="bi bi-clipboard-pulse" style={{ marginRight: 8, color: '#2563eb' }} />
              Procedure Details
            </h3>

            {/* Patient MRN */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Patient MRN <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={form.patient_mrn}
                  onChange={e => setF('patient_mrn', e.target.value)}
                  onBlur={lookupPatient}
                  placeholder="Enter MRN and press Tab"
                  style={inputStyle('patient_mrn')}
                />
                <button type="button" onClick={lookupPatient} disabled={patientSearching} className="btn" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {patientSearching ? <i className="bi bi-hourglass-split" /> : <i className="bi bi-search" />}
                </button>
              </div>
              {errors.patient_mrn && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{errors.patient_mrn}</div>}
              {form.patient_name && (
                <div style={{ marginTop: 6, padding: '6px 10px', background: '#f0f9ff', borderRadius: 6, fontSize: '0.82rem', color: '#0369a1', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="bi bi-person-check-fill" /> {form.patient_name}
                </div>
              )}
            </div>

            {/* Room */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                OT Room <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select value={form.room} onChange={e => setF('room', e.target.value)} style={inputStyle('room')}>
                <option value="">— Select Room —</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name} {r.room_type ? `(${r.room_type})` : ''}</option>)}
              </select>
              {errors.room && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{errors.room}</div>}
            </div>

            {/* Surgery Name */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Surgery Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={form.surgery_name}
                onChange={e => setF('surgery_name', e.target.value)}
                placeholder="e.g. Right Inguinal Hernia Repair"
                style={inputStyle('surgery_name')}
              />
              {errors.surgery_name && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{errors.surgery_name}</div>}
            </div>

            {/* Surgery Category */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Surgery Category</label>
              <select value={form.surgery_category} onChange={e => setF('surgery_category', e.target.value)} style={inputStyle('surgery_category')}>
                <option value="">— Select Category —</option>
                {SURGERY_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            {/* Priority */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Priority</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { value: 'elective', label: 'Elective', color: '#2563eb', bg: '#dbeafe' },
                  { value: 'urgent', label: 'Urgent', color: '#d97706', bg: '#fef3c7' },
                  { value: 'emergency', label: 'Emergency', color: '#dc2626', bg: '#fee2e2' },
                ].map(opt => (
                  <label key={opt.value} style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '7px 14px', borderRadius: 8, border: `2px solid ${form.priority === opt.value ? opt.color : '#e5e7eb'}`,
                    background: form.priority === opt.value ? opt.bg : '#fff',
                    color: form.priority === opt.value ? opt.color : '#374151',
                    fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.15s',
                  }}>
                    <input
                      type="radio" name="priority" value={opt.value}
                      checked={form.priority === opt.value}
                      onChange={() => setF('priority', opt.value)}
                      style={{ display: 'none' }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Dates & Times */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Scheduled Date <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={e => setF('scheduled_date', e.target.value)}
                style={inputStyle('scheduled_date')}
              />
              {errors.scheduled_date && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{errors.scheduled_date}</div>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Start Time <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input type="time" value={form.scheduled_start} onChange={e => setF('scheduled_start', e.target.value)} style={inputStyle('scheduled_start')} />
                {errors.scheduled_start && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{errors.scheduled_start}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>End Time</label>
                <input type="time" value={form.scheduled_end} onChange={e => setF('scheduled_end', e.target.value)} style={inputStyle('scheduled_end')} />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 18px', fontSize: '0.95rem', fontWeight: 700, color: '#1f2937', paddingBottom: 10, borderBottom: '1px solid #f3f4f6' }}>
              <i className="bi bi-people" style={{ marginRight: 8, color: '#7c3aed' }} />
              Team & Clinical Details
            </h3>

            {/* Primary Surgeon */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Primary Surgeon <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select value={form.primary_surgeon} onChange={e => setF('primary_surgeon', e.target.value)} style={inputStyle('primary_surgeon')}>
                <option value="">— Select Surgeon —</option>
                {surgeons.map(s => (
                  <option key={s.id} value={s.id}>
                    Dr. {s.full_name || s.name} {s.specialisation ? `(${s.specialisation})` : ''}
                  </option>
                ))}
              </select>
              {errors.primary_surgeon && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 4 }}>{errors.primary_surgeon}</div>}
            </div>

            {/* Anaesthesiologist */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Anaesthesiologist</label>
              <select value={form.anaesthesiologist} onChange={e => setF('anaesthesiologist', e.target.value)} style={inputStyle('anaesthesiologist')}>
                <option value="">— Select Anaesthesiologist —</option>
                {anaesthesiologists.map(a => (
                  <option key={a.id} value={a.id}>Dr. {a.full_name || a.name}</option>
                ))}
              </select>
            </div>

            {/* Ward & Bed */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Ward</label>
                <input type="text" value={form.ward} onChange={e => setF('ward', e.target.value)} placeholder="e.g. Surgical Ward B" style={inputStyle('ward')} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Bed Number</label>
                <input type="text" value={form.bed_number} onChange={e => setF('bed_number', e.target.value)} placeholder="e.g. B-12" style={inputStyle('bed_number')} />
              </div>
            </div>

            {/* Diagnosis */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Diagnosis</label>
              <textarea
                value={form.diagnosis} onChange={e => setF('diagnosis', e.target.value)}
                placeholder="Pre-operative diagnosis"
                rows={2}
                style={{ ...inputStyle('diagnosis'), resize: 'vertical', minHeight: 60 }}
              />
            </div>

            {/* Planned Procedure */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Planned Procedure</label>
              <textarea
                value={form.planned_procedure} onChange={e => setF('planned_procedure', e.target.value)}
                placeholder="Describe the planned surgical procedure"
                rows={2}
                style={{ ...inputStyle('planned_procedure'), resize: 'vertical', minHeight: 60 }}
              />
            </div>

            {/* Special Requirements */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Special Requirements</label>
              <textarea
                value={form.special_requirements} onChange={e => setF('special_requirements', e.target.value)}
                placeholder="Implants, special equipment, blood products, etc."
                rows={2}
                style={{ ...inputStyle('special_requirements'), resize: 'vertical', minHeight: 60 }}
              />
            </div>

            {/* Booking Notes */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Booking Notes</label>
              <textarea
                value={form.booking_notes} onChange={e => setF('booking_notes', e.target.value)}
                placeholder="Additional notes for the OT team"
                rows={2}
                style={{ ...inputStyle('booking_notes'), resize: 'vertical', minHeight: 60 }}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Link to={isEdit ? `/ot/bookings/${id}` : '/ot/schedule'} className="btn">Cancel</Link>
          <button
            type="submit"
            disabled={saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: saving ? '#93c5fd' : '#1d4999', color: '#fff',
              fontWeight: 600, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {saving
              ? <><i className="bi bi-hourglass-split" /> Saving…</>
              : <><i className="bi bi-check2-circle" /> {isEdit ? 'Update Booking' : 'Save Booking'}</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
