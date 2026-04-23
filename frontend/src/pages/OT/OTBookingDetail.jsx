import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../../api/client'
import SafetyChecklist from './SafetyChecklist'
import IntraopRecord from './IntraopRecord'

// ── Helpers ────────────────────────────────────────────────────────────────
const PRIORITY_COLORS = {
  elective: { bg: '#dbeafe', color: '#1e40af' },
  urgent: { bg: '#fef3c7', color: '#92400e' },
  emergency: { bg: '#fee2e2', color: '#991b1b' },
}
const STATUS_COLORS = {
  scheduled: { bg: '#f1f5f9', color: '#475569' },
  confirmed: { bg: '#e0f2fe', color: '#0369a1' },
  prep: { bg: '#fef3c7', color: '#92400e' },
  in_progress: { bg: '#fef3c7', color: '#92400e' },
  completed: { bg: '#d1fae5', color: '#065f46' },
  cancelled: { bg: '#fee2e2', color: '#991b1b' },
  postponed: { bg: '#ede9fe', color: '#6d28d9' },
}
const ASA_CONFIG = {
  'I': { color: '#16a34a', bg: '#d1fae5', label: 'ASA I — Normal Healthy' },
  'II': { color: '#2563eb', bg: '#dbeafe', label: 'ASA II — Mild Disease' },
  'III': { color: '#d97706', bg: '#fef3c7', label: 'ASA III — Severe Disease' },
  'IV': { color: '#ea580c', bg: '#ffedd5', label: 'ASA IV — Life-Threatening' },
  'V': { color: '#dc2626', bg: '#fee2e2', label: 'ASA V — Moribund' },
}

function PriorityBadge({ priority }) {
  const c = PRIORITY_COLORS[priority] || { bg: '#f1f5f9', color: '#475569' }
  return <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700, background: c.bg, color: c.color, textTransform: 'capitalize' }}>{priority}</span>
}
function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: '#f1f5f9', color: '#475569' }
  return <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700, background: c.bg, color: c.color }}>{String(status || '').replaceAll('_', ' ').toUpperCase()}</span>
}
function fmtDT(dt) { return dt ? new Date(dt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—' }
function fmtTime(dt) { return dt ? new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—' }

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '30px 0', justifyContent: 'center' }}>
    <div style={{ width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</span>
  </div>
)

const SectionCard = ({ title, icon, children, action }) => (
  <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 16, overflow: 'hidden' }}>
    <div style={{ padding: '13px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon && <i className={`bi ${icon}`} style={{ color: '#6b7280' }} />} {title}
      </span>
      {action}
    </div>
    <div style={{ padding: '18px' }}>{children}</div>
  </div>
)

const DetailRow = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 14 }}>
    <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
    <span style={{ fontSize: '0.875rem', color: '#1f2937', fontWeight: 500 }}>{value || '—'}</span>
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab({ booking }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <SectionCard title="Booking Details" icon="bi-info-circle">
        <DetailRow label="Booking Number" value={booking.booking_number} />
        <DetailRow label="OT Room" value={booking.room_name || booking.room} />
        <DetailRow label="Date" value={booking.scheduled_date} />
        <DetailRow label="Time" value={`${fmtTime(booking.scheduled_start)} – ${fmtTime(booking.scheduled_end)}`} />
        <DetailRow label="Surgery Category" value={booking.surgery_category} />
        <DetailRow label="Ward / Bed" value={`${booking.ward || '—'} / ${booking.bed_number || '—'}`} />
      </SectionCard>
      <SectionCard title="Surgical Team" icon="bi-people">
        <DetailRow label="Primary Surgeon" value={booking.primary_surgeon_name ? `Dr. ${booking.primary_surgeon_name}` : null} />
        <DetailRow label="Anaesthesiologist" value={booking.anaesthesiologist_name ? `Dr. ${booking.anaesthesiologist_name}` : null} />
        {booking.team_members?.length > 0 && (
          <div>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Support Team</span>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {booking.team_members.map((m, i) => (
                <span key={i} style={{ background: '#f1f5f9', color: '#475569', padding: '3px 10px', borderRadius: 9999, fontSize: '0.75rem' }}>{m.name || m}</span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
      <SectionCard title="Clinical Details" icon="bi-clipboard-pulse">
        <DetailRow label="Diagnosis" value={booking.diagnosis} />
        <DetailRow label="Planned Procedure" value={booking.planned_procedure} />
        <DetailRow label="Special Requirements" value={booking.special_requirements} />
        <DetailRow label="Booking Notes" value={booking.booking_notes} />
      </SectionCard>
      <SectionCard title="Timeline" icon="bi-clock-history">
        {[
          { label: 'Booking Created', time: booking.created_at, done: true },
          { label: 'Surgery Started', time: booking.actual_start, done: !!booking.actual_start },
          { label: 'Surgery Completed', time: booking.actual_end, done: !!booking.actual_end },
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: step.done ? '#d1fae5' : '#f1f5f9', color: step.done ? '#16a34a' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className={`bi ${step.done ? 'bi-check-circle-fill' : 'bi-circle'}`} style={{ fontSize: 14 }} />
            </div>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: step.done ? '#1f2937' : '#9ca3af' }}>{step.label}</div>
              {step.time && <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{fmtDT(step.time)}</div>}
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  )
}

function PreOpTab({ bookingId }) {
  const [assessment, setAssessment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/ot/pre-op-assessments/', { params: { booking: bookingId } })
      const list = Array.isArray(res.data) ? res.data : (res.data.results || [])
      setAssessment(list[0] || null)
    } catch { } finally { setLoading(false) }
  }, [bookingId])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />

  if (!assessment && !showForm) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
        <i className="bi bi-clipboard-x" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.35 }} />
        <p style={{ fontSize: '1rem', marginBottom: 16 }}>No pre-operative assessment recorded yet.</p>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-plus-circle" /> Add Assessment
        </button>
      </div>
    )
  }

  if (showForm) {
    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <button className="btn btn-sm" onClick={() => setShowForm(false)}><i className="bi bi-arrow-left" /> Back</button>
        </div>
        <PreOpInlineForm bookingId={bookingId} onSaved={() => { setShowForm(false); load() }} />
      </div>
    )
  }

  const asa = assessment.asa_grade
  const asaCfg = ASA_CONFIG[asa] || {}

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-sm" onClick={() => setShowForm(true)}><i className="bi bi-pencil" /> Edit Assessment</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SectionCard title="Physical Status" icon="bi-heart-pulse">
          {asa && (
            <div style={{ background: asaCfg.bg, color: asaCfg.color, padding: '14px 18px', borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 900 }}>{asa}</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{asaCfg.label}</span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[['Weight', assessment.weight_kg, 'kg'], ['Height', assessment.height_cm, 'cm'], ['BMI', assessment.bmi, '']].map(([l, v, u]) => (
              <div key={l} style={{ background: '#f8f9fc', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1f2937' }}>{v ? `${v}${u}` : '—'}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{l}</div>
              </div>
            ))}
          </div>
          <DetailRow label="Blood Group" value={assessment.blood_group} />
          <DetailRow label="Airway Assessment" value={assessment.airway_assessment} />
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fitness Status</span>
            <div style={{ marginTop: 6 }}>
              <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, background: assessment.fitness_status === 'fit' ? '#d1fae5' : '#fee2e2', color: assessment.fitness_status === 'fit' ? '#065f46' : '#991b1b' }}>
                {assessment.fitness_status || '—'}
              </span>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Clinical Notes" icon="bi-journal-text">
          <DetailRow label="Comorbidities" value={
            assessment.comorbidities?.length
              ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{assessment.comorbidities.map((c, i) => <span key={i} style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600 }}>{c}</span>)}</div>
              : 'None'
          } />
          <DetailRow label="Drug Allergies" value={
            assessment.drug_allergies?.length
              ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>{assessment.drug_allergies.map((a, i) => <span key={i} style={{ background: '#fef3c7', color: '#92400e', padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600 }}>{a}</span>)}</div>
              : 'NKDA'
          } />
          <DetailRow label="Anaesthesia Plan" value={assessment.anaesthesia_plan} />
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Consent Status</span>
            <div style={{ marginTop: 6 }}>
              <span style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, background: assessment.consent_obtained ? '#d1fae5' : '#fee2e2', color: assessment.consent_obtained ? '#065f46' : '#991b1b' }}>
                {assessment.consent_obtained ? 'Consent Obtained' : 'Consent Pending'}
              </span>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Investigations" icon="bi-activity">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              ['Hb', assessment.hb, 'g/dL'],
              ['Platelets', assessment.platelets, 'k/µL'],
              ['INR', assessment.inr, ''],
              ['Creatinine', assessment.creatinine, 'mg/dL'],
            ].map(([l, v, u]) => (
              <div key={l} style={{ background: '#f8f9fc', borderRadius: 8, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1f2937' }}>{v ? `${v}${u ? ' ' + u : ''}` : '—'}</div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
          {assessment.other_investigations && (
            <div style={{ marginTop: 12 }}>
              <DetailRow label="Other Investigations" value={assessment.other_investigations} />
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

function PreOpInlineForm({ bookingId, onSaved }) {
  const [form, setForm] = useState({
    asa_grade: 'I', weight_kg: '', height_cm: '', blood_group: '', airway_assessment: '',
    comorbidities: [], drug_allergies: [], anaesthesia_plan: '', consent_obtained: false,
    fitness_status: 'fit', hb: '', platelets: '', inr: '', creatinine: '', other_investigations: '',
  })
  const [comorTag, setComorTag] = useState('')
  const [allergyTag, setAllergyTag] = useState('')
  const [saving, setSaving] = useState(false)

  const addTag = (field, val, setter) => {
    if (!val.trim()) return
    setForm(f => ({ ...f, [field]: [...f[field], val.trim()] }))
    setter('')
  }
  const removeTag = (field, i) => setForm(f => ({ ...f, [field]: f[field].filter((_, idx) => idx !== i) }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/ot/pre-op-assessments/', { ...form, booking: bookingId })
      onSaved()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save assessment.')
    } finally { setSaving(false) }
  }

  const inp = { border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: '0.875rem', width: '100%' }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <SectionCard title="Physical Status" icon="bi-heart-pulse">
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>ASA Grade</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(ASA_CONFIG).map(([grade, cfg]) => (
                <label key={grade} style={{ cursor: 'pointer', padding: '6px 14px', borderRadius: 8, border: `2px solid ${form.asa_grade === grade ? cfg.color : '#e5e7eb'}`, background: form.asa_grade === grade ? cfg.bg : '#fff', color: form.asa_grade === grade ? cfg.color : '#374151', fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.15s' }}>
                  <input type="radio" name="asa_grade" value={grade} checked={form.asa_grade === grade} onChange={() => setForm(f => ({ ...f, asa_grade: grade }))} style={{ display: 'none' }} />
                  {grade}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[['weight_kg', 'Weight (kg)'], ['height_cm', 'Height (cm)']].map(([k, l]) => (
              <div key={k}>
                <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{l}</label>
                <input type="number" step="0.1" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Blood Group</label>
            <select value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))} style={inp}>
              <option value="">— Select —</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Airway Assessment</label>
            <input type="text" value={form.airway_assessment} onChange={e => setForm(f => ({ ...f, airway_assessment: e.target.value }))} placeholder="Mallampati, Thyromental distance, etc." style={inp} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Fitness Status</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {['fit', 'fit_with_optimization', 'unfit'].map(opt => (
                <label key={opt} style={{ cursor: 'pointer', padding: '6px 12px', borderRadius: 8, border: `2px solid ${form.fitness_status === opt ? '#2563eb' : '#e5e7eb'}`, background: form.fitness_status === opt ? '#dbeafe' : '#fff', color: form.fitness_status === opt ? '#1e40af' : '#374151', fontWeight: 600, fontSize: '0.78rem', textTransform: 'capitalize', transition: 'all 0.15s' }}>
                  <input type="radio" name="fitness_status" value={opt} checked={form.fitness_status === opt} onChange={() => setForm(f => ({ ...f, fitness_status: opt }))} style={{ display: 'none' }} />
                  {opt.replaceAll('_', ' ')}
                </label>
              ))}
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Clinical Notes" icon="bi-journal-text">
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Comorbidities</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {form.comorbidities.map((c, i) => (
                <span key={i} style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: 9999, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {c} <button type="button" onClick={() => removeTag('comorbidities', i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={comorTag} onChange={e => setComorTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('comorbidities', comorTag, setComorTag))} placeholder="Type & press Enter" style={{ ...inp, width: 'auto', flex: 1 }} />
              <button type="button" onClick={() => addTag('comorbidities', comorTag, setComorTag)} className="btn btn-sm"><i className="bi bi-plus" /></button>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Drug Allergies</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {form.drug_allergies.map((a, i) => (
                <span key={i} style={{ background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 9999, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {a} <button type="button" onClick={() => removeTag('drug_allergies', i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={allergyTag} onChange={e => setAllergyTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag('drug_allergies', allergyTag, setAllergyTag))} placeholder="Type & press Enter" style={{ ...inp, width: 'auto', flex: 1 }} />
              <button type="button" onClick={() => addTag('drug_allergies', allergyTag, setAllergyTag)} className="btn btn-sm"><i className="bi bi-plus" /></button>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Anaesthesia Plan</label>
            <textarea value={form.anaesthesia_plan} onChange={e => setForm(f => ({ ...f, anaesthesia_plan: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical', minHeight: 60 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 12px', borderRadius: 8, background: form.consent_obtained ? '#d1fae5' : '#f9fafb', border: '1px solid #e5e7eb' }}>
            <input type="checkbox" checked={form.consent_obtained} onChange={e => setForm(f => ({ ...f, consent_obtained: e.target.checked }))} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: form.consent_obtained ? '#065f46' : '#374151' }}>Informed Consent Obtained</span>
          </label>
        </SectionCard>
        <SectionCard title="Investigations" icon="bi-activity">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[['hb', 'Hb (g/dL)'], ['platelets', 'Platelets (k/µL)'], ['inr', 'INR'], ['creatinine', 'Creatinine (mg/dL)']].map(([k, l]) => (
              <div key={k}>
                <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{l}</label>
                <input type="number" step="0.01" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp} />
              </div>
            ))}
          </div>
          <div>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Other Investigations</label>
            <textarea value={form.other_investigations} onChange={e => setForm(f => ({ ...f, other_investigations: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
          </div>
        </SectionCard>
      </div>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {saving ? <i className="bi bi-hourglass-split" /> : <i className="bi bi-check2-circle" />}
          {saving ? 'Saving…' : 'Save Assessment'}
        </button>
      </div>
    </form>
  )
}

function AnaesthesiaTab({ bookingId }) {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ anaesthesia_type: '', airway_management: '', induction_agents: '', maintenance_agents: '', reversal_agents: '', complications: '', monitoring: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/ot/anaesthesia-records/', { params: { booking: bookingId } })
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data.results || [])
        setRecord(list[0] || null)
      }).catch(() => {}).finally(() => setLoading(false))
  }, [bookingId])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await api.post('/ot/anaesthesia-records/', { ...form, booking: bookingId })
      setRecord(res.data)
      setShowForm(false)
    } catch (err) { alert(err.response?.data?.detail || 'Failed to save.') }
    finally { setSaving(false) }
  }

  const inp = { border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: '0.875rem', width: '100%' }

  if (loading) return <Spinner />
  if (!record && !showForm) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
        <i className="bi bi-lungs" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.35 }} />
        <p style={{ marginBottom: 16 }}>No anaesthesia record yet.</p>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-plus-circle" /> Create Anaesthesia Record
        </button>
      </div>
    )
  }
  if (showForm) {
    return (
      <form onSubmit={handleCreate}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          {[['anaesthesia_type', 'Type (GA / Spinal / Epidural…)'], ['airway_management', 'Airway Management']].map(([k, l]) => (
            <div key={k}>
              <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{l}</label>
              <input type="text" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp} />
            </div>
          ))}
          {[['induction_agents', 'Induction Agents'], ['maintenance_agents', 'Maintenance Agents'], ['reversal_agents', 'Reversal Agents'], ['monitoring', 'Monitoring']].map(([k, l]) => (
            <div key={k}>
              <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{l}</label>
              <input type="text" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder="Comma-separated" style={inp} />
            </div>
          ))}
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Complications</label>
            <textarea value={form.complications} onChange={e => setForm(f => ({ ...f, complications: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {saving ? 'Saving…' : <><i className="bi bi-check2-circle" /> Save</>}
          </button>
        </div>
      </form>
    )
  }
  const tagList = (str) => str ? str.split(',').map(s => s.trim()).filter(Boolean) : []
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <SectionCard title="Anaesthesia Details" icon="bi-lungs">
        <DetailRow label="Type" value={record.anaesthesia_type} />
        <DetailRow label="Airway Management" value={record.airway_management} />
        <DetailRow label="Complications" value={record.complications} />
      </SectionCard>
      <SectionCard title="Agents & Monitoring" icon="bi-capsule">
        {[['Induction Agents', 'induction_agents'], ['Maintenance Agents', 'maintenance_agents'], ['Reversal Agents', 'reversal_agents'], ['Monitoring', 'monitoring']].map(([label, key]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {tagList(record[key]).length ? tagList(record[key]).map((t, i) => (
                <span key={i} style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 10px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600 }}>{t}</span>
              )) : <span style={{ color: '#9ca3af', fontSize: '0.82rem' }}>—</span>}
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  )
}

function OperativeNoteTab({ bookingId }) {
  const [note, setNote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ findings: '', procedure_performed: '', haemostasis: '', closure: '', drain_info: '', post_op_instructions: '' })
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/ot/operative-notes/', { params: { booking: bookingId } })
      const list = Array.isArray(res.data) ? res.data : (res.data.results || [])
      setNote(list[0] || null)
    } catch { } finally { setLoading(false) }
  }, [bookingId])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/ot/operative-notes/', { ...form, booking: bookingId })
      setShowForm(false); load()
    } catch (err) { alert(err.response?.data?.detail || 'Failed.') } finally { setSaving(false) }
  }

  const signNote = async () => {
    if (!confirm('Sign this operative note? This action cannot be undone.')) return
    setSigning(true)
    try { await api.post(`/ot/operative-notes/${note.id}/sign/`); load() }
    catch (err) { alert(err.response?.data?.detail || 'Failed to sign.') } finally { setSigning(false) }
  }

  const inp = { border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: '0.875rem', width: '100%', resize: 'vertical', minHeight: 70 }

  if (loading) return <Spinner />
  if (!note && !showForm) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
        <i className="bi bi-file-earmark-text" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.35 }} />
        <p style={{ marginBottom: 16 }}>No operative note dictated yet.</p>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-plus-circle" /> Dictate Note
        </button>
      </div>
    )
  }
  if (showForm) {
    return (
      <form onSubmit={handleCreate}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['findings', 'Operative Findings'], ['procedure_performed', 'Procedure Performed'], ['haemostasis', 'Haemostasis'], ['closure', 'Wound Closure'], ['drain_info', 'Drain Information'], ['post_op_instructions', 'Post-Op Instructions']].map(([k, l]) => (
            <div key={k}>
              <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{l}</label>
              <textarea value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {saving ? 'Saving…' : <><i className="bi bi-check2-circle" /> Save Note</>}
          </button>
        </div>
      </form>
    )
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
        {!note.signed_at && (
          <button className="btn btn-success" onClick={signNote} disabled={signing} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-pen" /> {signing ? 'Signing…' : 'Sign Note'}
          </button>
        )}
        {note.signed_at && (
          <span style={{ background: '#d1fae5', color: '#065f46', padding: '6px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-shield-check" /> Signed {fmtDT(note.signed_at)}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[['Operative Findings', note.findings], ['Procedure Performed', note.procedure_performed], ['Haemostasis', note.haemostasis], ['Wound Closure', note.closure], ['Drain Information', note.drain_info], ['Post-Op Instructions', note.post_op_instructions]].map(([label, val]) => (
          val ? (
            <SectionCard key={label} title={label}>
              <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#374151' }}>{val}</p>
            </SectionCard>
          ) : null
        ))}
      </div>
    </div>
  )
}

function PostOpOrdersTab({ bookingId }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ order_type: 'medication', order_text: '', frequency: '', duration: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/ot/post-op-orders/', { params: { booking: bookingId } })
      setOrders(Array.isArray(res.data) ? res.data : (res.data.results || []))
    } catch { setOrders([]) } finally { setLoading(false) }
  }, [bookingId])

  useEffect(() => { load() }, [load])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.order_text.trim()) return
    setSaving(true)
    try {
      await api.post('/ot/post-op-orders/', { ...form, booking: bookingId })
      setForm({ order_type: 'medication', order_text: '', frequency: '', duration: '' })
      load()
    } catch (err) { alert(err.response?.data?.detail || 'Failed.') } finally { setSaving(false) }
  }

  const inp = { border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: '0.875rem' }
  const orderTypes = ['medication', 'iv_fluid', 'diet', 'activity', 'monitoring', 'wound_care', 'other']

  if (loading) return <Spinner />
  return (
    <div>
      <SectionCard title="Add Post-Op Order" icon="bi-plus-circle">
        <form onSubmit={handleAdd}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 120px 120px auto', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Type</label>
              <select value={form.order_type} onChange={e => setForm(f => ({ ...f, order_type: e.target.value }))} style={{ ...inp, width: '100%' }}>
                {orderTypes.map(t => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Order</label>
              <input type="text" value={form.order_text} onChange={e => setForm(f => ({ ...f, order_text: e.target.value }))} placeholder="Order details" style={{ ...inp, width: '100%' }} required />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Frequency</label>
              <input type="text" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} placeholder="e.g. BD" style={{ ...inp, width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Duration</label>
              <input type="text" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="e.g. 5 days" style={{ ...inp, width: '100%' }} />
            </div>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <i className="bi bi-plus" /> Add
            </button>
          </div>
        </form>
      </SectionCard>
      {orders.length > 0 ? (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Type', 'Order', 'Frequency', 'Duration', 'Added By', 'At'].map(h => <th key={h} style={{ textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', padding: '11px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '11px 14px' }}><span style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>{o.order_type?.replaceAll('_', ' ')}</span></td>
                  <td style={{ padding: '11px 14px', fontSize: '0.875rem' }}>{o.order_text}</td>
                  <td style={{ padding: '11px 14px', fontSize: '0.875rem' }}>{o.frequency || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: '0.875rem' }}>{o.duration || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: '0.8rem', color: '#6b7280' }}>{o.added_by_name || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: '0.75rem', color: '#9ca3af' }}>{fmtDT(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '0.9rem' }}>No post-op orders yet.</div>
      )}
    </div>
  )
}

function RecoveryTab({ bookingId }) {
  const [recovery, setRecovery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ admission_time: '', discharge_time: '', aldrete_on_admission: '', aldrete_on_discharge: '', pain_score: '', transfer_destination: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/ot/recovery-records/', { params: { booking: bookingId } })
      const list = Array.isArray(res.data) ? res.data : (res.data.results || [])
      setRecovery(list[0] || null)
    } catch { setRecovery(null) } finally { setLoading(false) }
  }, [bookingId])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (recovery) {
        await api.patch(`/ot/recovery-records/${recovery.id}/`, { ...form, booking: bookingId })
      } else {
        await api.post('/ot/recovery-records/', { ...form, booking: bookingId })
      }
      setEditing(false); load()
    } catch (err) { alert(err.response?.data?.detail || 'Failed.') } finally { setSaving(false) }
  }

  const inp = { border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: '0.875rem', width: '100%' }

  if (loading) return <Spinner />
  if (!recovery && !editing) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
        <i className="bi bi-hospital" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.35 }} />
        <p style={{ marginBottom: 16 }}>No recovery record yet.</p>
        <button className="btn btn-primary" onClick={() => setEditing(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-plus-circle" /> Add Recovery Record
        </button>
      </div>
    )
  }
  if (editing) {
    return (
      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[['admission_time', 'Admission to Recovery', 'datetime-local'], ['discharge_time', 'Discharge from Recovery', 'datetime-local']].map(([k, l, t]) => (
            <div key={k}>
              <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{l}</label>
              <input type={t} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp} />
            </div>
          ))}
          {[['aldrete_on_admission', 'Aldrete Score (Admission)'], ['aldrete_on_discharge', 'Aldrete Score (Discharge)'], ['pain_score', 'Pain Score (0–10)']].map(([k, l]) => (
            <div key={k}>
              <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>{l}</label>
              <input type="number" min="0" max="10" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} style={inp} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Transfer Destination</label>
            <select value={form.transfer_destination} onChange={e => setForm(f => ({ ...f, transfer_destination: e.target.value }))} style={inp}>
              <option value="">— Select —</option>
              {['ward', 'icu', 'hdcu', 'home', 'other'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Recovery Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {saving ? 'Saving…' : <><i className="bi bi-check2-circle" /> Save</>}
          </button>
        </div>
      </form>
    )
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-sm" onClick={() => { setForm({ admission_time: recovery.admission_time || '', discharge_time: recovery.discharge_time || '', aldrete_on_admission: recovery.aldrete_on_admission || '', aldrete_on_discharge: recovery.aldrete_on_discharge || '', pain_score: recovery.pain_score || '', transfer_destination: recovery.transfer_destination || '', notes: recovery.notes || '' }); setEditing(true) }}>
          <i className="bi bi-pencil" /> Edit
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {[['Admission to Recovery', fmtDT(recovery.admission_time)], ['Discharge from Recovery', fmtDT(recovery.discharge_time)], ['Transfer Destination', recovery.transfer_destination?.toUpperCase()]].map(([l, v]) => (
          <div key={l} style={{ background: '#f8f9fc', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2937' }}>{v || '—'}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>{l}</div>
          </div>
        ))}
        <div style={{ background: '#f8f9fc', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#2563eb' }}>{recovery.aldrete_on_admission ?? '—'}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>Aldrete (Admission)</div>
        </div>
        <div style={{ background: '#f8f9fc', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#16a34a' }}>{recovery.aldrete_on_discharge ?? '—'}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>Aldrete (Discharge)</div>
        </div>
        <div style={{ background: '#f8f9fc', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: Number(recovery.pain_score) >= 7 ? '#dc2626' : '#374151' }}>{recovery.pain_score ?? '—'}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>Pain Score</div>
        </div>
      </div>
      {recovery.notes && <SectionCard title="Recovery Notes" icon="bi-journal"><p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.7 }}>{recovery.notes}</p></SectionCard>}
    </div>
  )
}

function BillingTab({ bookingId }) {
  const [bill, setBill] = useState(null)
  const [loading, setLoading] = useState(true)
  const [charges, setCharges] = useState({})
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [recalculating, setRecalculating] = useState(false)

  const CHARGE_FIELDS = [
    ['ot_charge', 'OT Charges'], ['surgeon_fee', 'Surgeon Fee'], ['anaesthesia_fee', 'Anaesthesia Fee'],
    ['nursing_charge', 'Nursing Charges'], ['supplies_charge', 'Supplies'], ['implants_charge', 'Implants'],
    ['blood_products_charge', 'Blood Products'], ['other_charges', 'Other Charges'],
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/ot/bills/', { params: { booking: bookingId } })
      const list = Array.isArray(res.data) ? res.data : (res.data.results || [])
      const b = list[0] || null
      setBill(b)
      if (b) {
        const c = {}
        CHARGE_FIELDS.forEach(([k]) => { c[k] = b[k] ?? '' })
        setCharges(c)
      }
    } catch { setBill(null) } finally { setLoading(false) }
  }, [bookingId])

  useEffect(() => { load() }, [load])

  const createBill = async () => {
    setSaving(true)
    try {
      const res = await api.post('/ot/bills/', { booking: bookingId })
      setBill(res.data); load()
    } catch (err) { alert(err.response?.data?.detail || 'Failed.') } finally { setSaving(false) }
  }
  const recalc = async () => {
    setRecalculating(true)
    try { await api.post(`/ot/bills/${bill.id}/recalculate/`); load() }
    catch (err) { alert(err.response?.data?.detail || 'Failed.') } finally { setRecalculating(false) }
  }
  const finalize = async () => {
    if (!confirm('Finalize this bill? This cannot be undone.')) return
    setFinalizing(true)
    try { await api.post(`/ot/bills/${bill.id}/finalize/`); load() }
    catch (err) { alert(err.response?.data?.detail || 'Failed.') } finally { setFinalizing(false) }
  }
  const saveCharges = async () => {
    setSaving(true)
    try { await api.patch(`/ot/bills/${bill.id}/`, charges); load() }
    catch (err) { alert(err.response?.data?.detail || 'Failed.') } finally { setSaving(false) }
  }

  if (loading) return <Spinner />
  if (!bill) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
        <i className="bi bi-receipt" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.35 }} />
        <p style={{ marginBottom: 16 }}>No bill created yet.</p>
        <button className="btn btn-primary" onClick={createBill} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-plus-circle" /> Create Bill
        </button>
      </div>
    )
  }

  const isDraft = bill.status === 'draft'
  const total = CHARGE_FIELDS.reduce((s, [k]) => s + (Number(charges[k]) || 0), 0)
  const billStatusColor = { draft: { bg: '#f1f5f9', color: '#475569' }, finalized: { bg: '#fef3c7', color: '#92400e' }, paid: { bg: '#d1fae5', color: '#065f46' } }[bill.status] || { bg: '#f1f5f9', color: '#475569' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ background: billStatusColor.bg, color: billStatusColor.color, padding: '5px 16px', borderRadius: 9999, fontWeight: 700, fontSize: '0.82rem' }}>
          {bill.status?.toUpperCase() || 'DRAFT'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {isDraft && <button onClick={recalc} disabled={recalculating} className="btn btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i className="bi bi-arrow-clockwise" /> {recalculating ? 'Recalculating…' : 'Recalculate'}</button>}
          {isDraft && <button onClick={saveCharges} disabled={saving} className="btn btn-sm btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i className="bi bi-floppy" /> {saving ? 'Saving…' : 'Save'}</button>}
          {isDraft && <button onClick={finalize} disabled={finalizing} className="btn btn-sm btn-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i className="bi bi-check2-circle" /> {finalizing ? 'Finalizing…' : 'Finalize Bill'}</button>}
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Charge Description', 'Amount (₹)'].map(h => <th key={h} style={{ textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', padding: '11px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {CHARGE_FIELDS.map(([key, label]) => (
              <tr key={key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 500 }}>{label}</td>
                <td style={{ padding: '8px 16px' }}>
                  {isDraft ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={charges[key]}
                      onChange={e => setCharges(c => ({ ...c, [key]: e.target.value }))}
                      style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: '0.875rem', width: 130, textAlign: 'right' }}
                    />
                  ) : (
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>₹ {Number(charges[key] || 0).toLocaleString()}</span>
                  )}
                </td>
              </tr>
            ))}
            <tr style={{ background: '#f0f9ff', borderTop: '2px solid #2563eb' }}>
              <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: '1rem', color: '#1e40af' }}>TOTAL</td>
              <td style={{ padding: '14px 16px', fontWeight: 800, fontSize: '1.1rem', color: '#1e40af' }}>
                ₹ {(isDraft ? total : Number(bill.total_amount || 0)).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OutcomeTab({ bookingId }) {
  const [outcome, setOutcome] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ wound_classification: 'clean', ssi: false, ssi_details: '', complications: '', reoperation: false, icu_admission: false, outcome_30d: 'alive' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/ot/outcomes/', { params: { booking: bookingId } })
      const list = Array.isArray(res.data) ? res.data : (res.data.results || [])
      setOutcome(list[0] || null)
    } catch { setOutcome(null) } finally { setLoading(false) }
  }, [bookingId])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/ot/outcomes/', { ...form, booking: bookingId })
      setShowForm(false); load()
    } catch (err) { alert(err.response?.data?.detail || 'Failed.') } finally { setSaving(false) }
  }

  const inp = { border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 10px', fontSize: '0.875rem', width: '100%' }

  if (loading) return <Spinner />
  if (!outcome && !showForm) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
        <i className="bi bi-clipboard2-pulse" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.35 }} />
        <p style={{ marginBottom: 16 }}>No outcome recorded yet.</p>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-plus-circle" /> Record Outcome
        </button>
      </div>
    )
  }
  if (showForm) {
    return (
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Wound Classification</label>
            <select value={form.wound_classification} onChange={e => setForm(f => ({ ...f, wound_classification: e.target.value }))} style={inp}>
              {['clean', 'clean_contaminated', 'contaminated', 'dirty'].map(w => <option key={w} value={w}>{w.replaceAll('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>30-Day Outcome</label>
            <select value={form.outcome_30d} onChange={e => setForm(f => ({ ...f, outcome_30d: e.target.value }))} style={inp}>
              {['alive', 'deceased', 'unknown'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Complications</label>
            <textarea value={form.complications} onChange={e => setForm(f => ({ ...f, complications: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
          </div>
          {[['ssi', 'Surgical Site Infection (SSI)'], ['reoperation', 'Reoperation Required'], ['icu_admission', 'ICU Admission']].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: form[k] ? '#fee2e2' : '#f9fafb', border: '1px solid #e5e7eb' }}>
              <input type="checkbox" checked={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: form[k] ? '#991b1b' : '#374151' }}>{l}</span>
            </label>
          ))}
          {form.ssi && (
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>SSI Details</label>
              <textarea value={form.ssi_details} onChange={e => setForm(f => ({ ...f, ssi_details: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
            </div>
          )}
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {saving ? 'Saving…' : <><i className="bi bi-check2-circle" /> Save Outcome</>}
          </button>
        </div>
      </form>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {[
        ['Wound Classification', outcome.wound_classification?.replaceAll('_', ' '), '#e0e7ff', '#4338ca'],
        ['30-Day Outcome', outcome.outcome_30d, outcome.outcome_30d === 'alive' ? '#d1fae5' : '#fee2e2', outcome.outcome_30d === 'alive' ? '#065f46' : '#991b1b'],
      ].map(([l, v, bg, c]) => (
        <div key={l} style={{ background: bg, borderRadius: 10, padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: c, textTransform: 'capitalize' }}>{v || '—'}</div>
          <div style={{ fontSize: '0.72rem', color: c, marginTop: 4, opacity: 0.7 }}>{l}</div>
        </div>
      ))}
      {[['SSI', outcome.ssi], ['Reoperation', outcome.reoperation], ['ICU Admission', outcome.icu_admission]].map(([l, v]) => (
        <div key={l} style={{ background: v ? '#fee2e2' : '#f0fdf4', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: v ? '#dc2626' : '#16a34a' }}>{v ? 'Yes' : 'No'}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 4 }}>{l}</div>
        </div>
      ))}
      {outcome.complications && (
        <div style={{ gridColumn: 'span 3' }}>
          <SectionCard title="Complications"><p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.7 }}>{outcome.complications}</p></SectionCard>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'bi-info-circle' },
  { key: 'preop', label: 'Pre-Op', icon: 'bi-clipboard-pulse' },
  { key: 'checklist', label: 'Safety Checklist', icon: 'bi-shield-check' },
  { key: 'intraop', label: 'Intraop', icon: 'bi-activity' },
  { key: 'anaesthesia', label: 'Anaesthesia', icon: 'bi-lungs' },
  { key: 'opnote', label: 'Operative Note', icon: 'bi-file-earmark-text' },
  { key: 'postop', label: 'Post-Op Orders', icon: 'bi-list-check' },
  { key: 'recovery', label: 'Recovery', icon: 'bi-hospital' },
  { key: 'billing', label: 'Billing', icon: 'bi-receipt' },
  { key: 'outcome', label: 'Outcome', icon: 'bi-clipboard2-pulse' },
]

export default function OTBookingDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [booking, setBooking] = useState(null)
  const [checklists, setChecklists] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [actionLoading, setActionLoading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get(`/ot/bookings/${id}/`)
      setBooking(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load booking.')
    } finally { setLoading(false) }
  }, [id])

  const loadChecklists = useCallback(async () => {
    try {
      const res = await api.get('/ot/safety-checklists/', { params: { booking: id } })
      setChecklists(Array.isArray(res.data) ? res.data : (res.data.results || []))
    } catch { setChecklists([]) }
  }, [id])

  useEffect(() => { load(); loadChecklists() }, [load, loadChecklists])

  const doAction = async (action) => {
    if (action === 'cancel') {
      const reason = prompt('Enter cancellation reason:')
      if (!reason) return
      setActionLoading(action)
      try { await api.post(`/ot/bookings/${id}/cancel/`, { reason }); load() }
      catch (e) { alert(e.response?.data?.detail || 'Cancel failed.') } finally { setActionLoading(null) }
      return
    }
    if (action === 'complete' && !confirm('Mark this surgery as complete?')) return
    if (action === 'postpone') {
      const newDate = prompt('Enter new date (YYYY-MM-DD):')
      if (!newDate) return
      setActionLoading(action)
      try { await api.post(`/ot/bookings/${id}/postpone/`, { new_date: newDate }); load() }
      catch (e) { alert(e.response?.data?.detail || 'Postpone failed.') } finally { setActionLoading(null) }
      return
    }
    setActionLoading(action)
    try { await api.post(`/ot/bookings/${id}/${action}/`); load() }
    catch (e) { alert(e.response?.data?.detail || `Action failed.`) } finally { setActionLoading(null) }
  }

  const initChecklist = async () => {
    try { await api.post(`/ot/bookings/${id}/init-checklist/`); loadChecklists() }
    catch (e) { alert(e.response?.data?.detail || 'Failed to initialize checklist.') }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: '#6b7280' }}>Loading booking…</span>
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '16px 20px', borderRadius: 10, display: 'inline-block' }}>
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
        <br /><Link to="/ot/schedule" className="btn" style={{ marginTop: 14 }}><i className="bi bi-arrow-left" /> Back to Schedule</Link>
      </div>
    )
  }
  if (!booking) return null

  const s = booking.status
  const canStart = ['scheduled', 'confirmed', 'prep'].includes(s)
  const canComplete = s === 'in_progress'
  const canCancel = !['completed', 'cancelled'].includes(s)
  const canPostpone = !['completed', 'cancelled', 'in_progress'].includes(s)

  return (
    <div>
      {/* Header */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <Link to="/ot/schedule" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: '#6b7280', textDecoration: 'none' }}>
            <i className="bi bi-arrow-left" /> Back to Schedule
          </Link>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link to={`/ot/bookings/${id}/edit`} className="btn btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <i className="bi bi-pencil" /> Edit
            </Link>
            {canStart && (
              <button onClick={() => doAction('start')} disabled={actionLoading === 'start'} className="btn btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1d4999', color: '#fff', border: 'none' }}>
                <i className="bi bi-play-fill" /> {actionLoading === 'start' ? 'Starting…' : 'Start Surgery'}
              </button>
            )}
            {canComplete && (
              <button onClick={() => doAction('complete')} disabled={actionLoading === 'complete'} className="btn btn-sm btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <i className="bi bi-check2-circle" /> {actionLoading === 'complete' ? 'Completing…' : 'Complete Surgery'}
              </button>
            )}
            {canPostpone && (
              <button onClick={() => doAction('postpone')} disabled={actionLoading === 'postpone'} className="btn btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ede9fe', color: '#6d28d9', border: 'none' }}>
                <i className="bi bi-calendar-x" /> Postpone
              </button>
            )}
            {canCancel && (
              <button onClick={() => doAction('cancel')} disabled={actionLoading === 'cancel'} className="btn btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1d4999', color: '#fff', border: 'none' }}>
                <i className="bi bi-x-circle" /> {actionLoading === 'cancel' ? 'Cancelling…' : 'Cancel'}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {booking.booking_number}
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 800, color: '#1f2937' }}>
              {booking.surgery_name || 'Surgery Booking'}
            </h2>
            <div style={{ fontSize: '0.9rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="bi bi-person-circle" style={{ color: '#6b7280' }} />
              <strong>{booking.patient_name || '—'}</strong>
              {booking.patient_mrn && <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>MRN: {booking.patient_mrn}</span>}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span><i className="bi bi-door-open" /> {booking.room_name || booking.room || '—'}</span>
              <span><i className="bi bi-calendar" /> {booking.scheduled_date}</span>
              <span><i className="bi bi-clock" /> {fmtTime(booking.scheduled_start)}</span>
              {booking.primary_surgeon_name && <span><i className="bi bi-person-badge" /> Dr. {booking.primary_surgeon_name}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <PriorityBadge priority={booking.priority} />
            <StatusBadge status={booking.status} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px', border: 'none', background: 'transparent',
              color: activeTab === tab.key ? '#2563eb' : '#6b7280',
              fontWeight: activeTab === tab.key ? 700 : 500, fontSize: '0.85rem',
              cursor: 'pointer', borderBottom: `3px solid ${activeTab === tab.key ? '#2563eb' : 'transparent'}`,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'color 0.15s, border-color 0.15s', whiteSpace: 'nowrap',
              marginBottom: -2,
            }}
          >
            <i className={`bi ${tab.icon}`} style={{ fontSize: 13 }} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && <OverviewTab booking={booking} />}
        {activeTab === 'preop' && <PreOpTab bookingId={id} />}
        {activeTab === 'checklist' && (
          <SafetyChecklist
            bookingId={id}
            checklists={checklists}
            onInitialize={initChecklist}
            onUpdate={loadChecklists}
          />
        )}
        {activeTab === 'intraop' && <IntraopRecord bookingId={id} />}
        {activeTab === 'anaesthesia' && <AnaesthesiaTab bookingId={id} />}
        {activeTab === 'opnote' && <OperativeNoteTab bookingId={id} />}
        {activeTab === 'postop' && <PostOpOrdersTab bookingId={id} />}
        {activeTab === 'recovery' && <RecoveryTab bookingId={id} />}
        {activeTab === 'billing' && <BillingTab bookingId={id} />}
        {activeTab === 'outcome' && <OutcomeTab bookingId={id} />}
      </div>
    </div>
  )
}
