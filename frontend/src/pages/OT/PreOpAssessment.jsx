import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../../api/client'

const ASA_OPTIONS = [
  { grade: 'I', label: 'ASA I', desc: 'Normal healthy patient', color: '#16a34a', bg: '#d1fae5', border: '#86efac' },
  { grade: 'II', label: 'ASA II', desc: 'Mild systemic disease', color: '#2563eb', bg: '#dbeafe', border: '#93c5fd' },
  { grade: 'III', label: 'ASA III', desc: 'Severe systemic disease', color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  { grade: 'IV', label: 'ASA IV', desc: 'Life-threatening disease', color: '#ea580c', bg: '#ffedd5', border: '#fdba74' },
  { grade: 'V', label: 'ASA V', desc: 'Moribund, not expected to survive', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
]

const FITNESS_OPTIONS = [
  { value: 'fit', label: 'Fit for Surgery', color: '#16a34a', bg: '#d1fae5' },
  { value: 'fit_with_optimization', label: 'Fit with Optimization', color: '#d97706', bg: '#fef3c7' },
  { value: 'unfit', label: 'Unfit for Surgery', color: '#dc2626', bg: '#fee2e2' },
]

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const BLANK = {
  asa_grade: 'I',
  weight_kg: '', height_cm: '',
  blood_group: '',
  airway_assessment: '',
  comorbidities: [],
  drug_allergies: [],
  anaesthesia_plan: '',
  consent_obtained: false,
  fitness_status: 'fit',
  hb: '', platelets: '', inr: '', creatinine: '',
  other_investigations: '',
  additional_notes: '',
}

export default function PreOpAssessment({ bookingId: propBookingId, onSaved, onCancel }) {
  const nav = useNavigate()
  const location = useLocation()
  // bookingId can come from props (used as embedded component) or query string
  const queryBookingId = new URLSearchParams(location.search).get('booking')
  const bookingId = propBookingId || queryBookingId

  const [form, setForm] = useState({ ...BLANK })
  const [comorTag, setComorTag] = useState('')
  const [allergyTag, setAllergyTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [successMsg, setSuccessMsg] = useState('')

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const addTag = (field, val, clearFn) => {
    if (!val.trim()) return
    setForm(f => ({ ...f, [field]: [...f[field], val.trim()] }))
    clearFn('')
  }
  const removeTag = (field, idx) => setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }))

  const handleKeyDown = (e, field, val, clearFn) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(field, val, clearFn)
    }
  }

  const validate = () => {
    const e = {}
    if (!form.asa_grade) e.asa_grade = 'ASA grade is required.'
    if (!form.fitness_status) e.fitness_status = 'Fitness status is required.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const payload = { ...form, booking: bookingId }
      await api.post('/ot/pre-op-assessments/', payload)
      if (onSaved) {
        onSaved()
      } else {
        setSuccessMsg('Pre-operative assessment saved successfully.')
        setTimeout(() => nav(`/ot/bookings/${bookingId}`), 1500)
      }
    } catch (err) {
      const d = err.response?.data
      if (d && typeof d === 'object') {
        const mapped = {}
        Object.entries(d).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v.join(' ') : String(v) })
        setErrors(mapped)
      } else {
        setErrors({ __general: d?.detail || 'Failed to save assessment.' })
      }
    } finally { setSaving(false) }
  }

  const inp = (field) => ({
    border: `1px solid ${errors[field] ? '#ef4444' : '#d1d5db'}`,
    borderRadius: 6, padding: '9px 12px', fontSize: '0.875rem', color: '#1f2937',
    background: '#fff', width: '100%',
  })

  const SectionCard = ({ title, icon, children }) => (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 20, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <div style={{ padding: '13px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && <i className={`bi ${icon}`} style={{ color: '#6b7280' }} />} {title}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )

  const bmi = form.weight_kg && form.height_cm
    ? (Number(form.weight_kg) / Math.pow(Number(form.height_cm) / 100, 2)).toFixed(1)
    : null

  return (
    <div>
      {/* Page header (only when standalone) */}
      {!propBookingId && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.4rem', color: '#1f2937' }}>Pre-Operative Assessment</h2>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>Complete pre-operative evaluation for the patient</p>
          </div>
          <button className="btn" onClick={() => nav(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-arrow-left" /> Back
          </button>
        </div>
      )}

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
        {/* ASA Grade */}
        <SectionCard title="ASA Physical Status Classification" icon="bi-heart-pulse">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {ASA_OPTIONS.map(opt => (
              <label key={opt.grade} style={{
                cursor: 'pointer', flex: '1 1 150px',
                padding: '14px 16px', borderRadius: 10,
                border: `2px solid ${form.asa_grade === opt.grade ? opt.border : '#e5e7eb'}`,
                background: form.asa_grade === opt.grade ? opt.bg : '#fff',
                transition: 'all 0.15s', textAlign: 'center',
              }}>
                <input type="radio" name="asa_grade" value={opt.grade} checked={form.asa_grade === opt.grade} onChange={() => setF('asa_grade', opt.grade)} style={{ display: 'none' }} />
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: form.asa_grade === opt.grade ? opt.color : '#9ca3af', lineHeight: 1, marginBottom: 4 }}>{opt.grade}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: form.asa_grade === opt.grade ? opt.color : '#374151' }}>{opt.label}</div>
                <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: 3 }}>{opt.desc}</div>
              </label>
            ))}
          </div>
          {errors.asa_grade && <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: 8 }}>{errors.asa_grade}</div>}
        </SectionCard>

        {/* Physical Measurements */}
        <SectionCard title="Physical Measurements" icon="bi-rulers">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Weight (kg)</label>
              <input type="number" step="0.1" min="0" value={form.weight_kg} onChange={e => setF('weight_kg', e.target.value)} style={inp('weight_kg')} placeholder="e.g. 70" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Height (cm)</label>
              <input type="number" step="0.1" min="0" value={form.height_cm} onChange={e => setF('height_cm', e.target.value)} style={inp('height_cm')} placeholder="e.g. 170" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>BMI</label>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '9px 12px', background: '#f9fafb', fontSize: '0.875rem', color: bmi ? (bmi < 18.5 || bmi > 30 ? '#dc2626' : '#1f2937') : '#9ca3af', fontWeight: bmi ? 700 : 400 }}>
                {bmi || 'Auto-calculated'}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Blood Group</label>
              <select value={form.blood_group} onChange={e => setF('blood_group', e.target.value)} style={inp('blood_group')}>
                <option value="">— Select —</option>
                {BLOOD_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Airway Assessment (Mallampati, thyromental distance, etc.)</label>
            <input type="text" value={form.airway_assessment} onChange={e => setF('airway_assessment', e.target.value)} placeholder="e.g. Mallampati II, adequate mouth opening, normal neck mobility" style={inp('airway_assessment')} />
          </div>
        </SectionCard>

        {/* Comorbidities & Allergies */}
        <SectionCard title="Comorbidities & Allergies" icon="bi-bandaid">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Comorbidities */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Comorbidities</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 32 }}>
                {form.comorbidities.map((c, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 600 }}>
                    {c}
                    <button type="button" onClick={() => removeTag('comorbidities', i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>×</button>
                  </span>
                ))}
                {form.comorbidities.length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>None added yet</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" value={comorTag}
                  onChange={e => setComorTag(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, 'comorbidities', comorTag, setComorTag)}
                  placeholder="e.g. Diabetes, Hypertension… (Enter to add)"
                  style={{ ...inp(''), flex: 1 }}
                />
                <button type="button" onClick={() => addTag('comorbidities', comorTag, setComorTag)} className="btn btn-sm" style={{ flexShrink: 0 }}>
                  <i className="bi bi-plus" /> Add
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '4px 0 0' }}>Press Enter or click Add to tag</p>
            </div>

            {/* Drug Allergies */}
            <div>
              <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>Drug Allergies</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, minHeight: 32 }}>
                {form.drug_allergies.map((a, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 600 }}>
                    {a}
                    <button type="button" onClick={() => removeTag('drug_allergies', i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}>×</button>
                  </span>
                ))}
                {form.drug_allergies.length === 0 && <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>NKDA (none added)</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" value={allergyTag}
                  onChange={e => setAllergyTag(e.target.value)}
                  onKeyDown={e => handleKeyDown(e, 'drug_allergies', allergyTag, setAllergyTag)}
                  placeholder="e.g. Penicillin, Aspirin… (Enter to add)"
                  style={{ ...inp(''), flex: 1 }}
                />
                <button type="button" onClick={() => addTag('drug_allergies', allergyTag, setAllergyTag)} className="btn btn-sm" style={{ flexShrink: 0 }}>
                  <i className="bi bi-plus" /> Add
                </button>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '4px 0 0' }}>Press Enter or click Add to tag</p>
            </div>
          </div>
        </SectionCard>

        {/* Investigations */}
        <SectionCard title="Pre-Operative Investigations" icon="bi-activity">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
            {[
              ['hb', 'Haemoglobin', 'g/dL', '0.1', '0', '25'],
              ['platelets', 'Platelets', 'k/µL', '1', '0', '2000'],
              ['inr', 'INR', '', '0.01', '0.5', '10'],
              ['creatinine', 'Creatinine', 'mg/dL', '0.01', '0', '20'],
            ].map(([k, label, unit, step, min, max]) => (
              <div key={k}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  {label} {unit && <span style={{ fontWeight: 400, color: '#6b7280' }}>({unit})</span>}
                </label>
                <input
                  type="number" step={step} min={min} max={max}
                  value={form[k]} onChange={e => setF(k, e.target.value)}
                  style={inp(k)} placeholder="—"
                />
              </div>
            ))}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Other Investigations (ECG, Echo, PFT, etc.)</label>
            <textarea
              value={form.other_investigations} onChange={e => setF('other_investigations', e.target.value)}
              rows={2} placeholder="Describe relevant investigation findings"
              style={{ ...inp('other_investigations'), resize: 'vertical', minHeight: 60 }}
            />
          </div>
        </SectionCard>

        {/* Anaesthesia Plan & Consent */}
        <SectionCard title="Anaesthesia Plan & Consent" icon="bi-lungs">
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Anaesthesia Plan</label>
            <textarea
              value={form.anaesthesia_plan} onChange={e => setF('anaesthesia_plan', e.target.value)}
              rows={3} placeholder="Planned anaesthesia technique, airway management, monitoring plan, special considerations…"
              style={{ ...inp('anaesthesia_plan'), resize: 'vertical', minHeight: 80 }}
            />
          </div>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '12px 16px', borderRadius: 10, border: '2px solid',
            borderColor: form.consent_obtained ? '#86efac' : '#e5e7eb',
            background: form.consent_obtained ? '#d1fae5' : '#f9fafb',
            transition: 'all 0.15s', marginBottom: 14,
          }}>
            <input type="checkbox" checked={form.consent_obtained} onChange={e => setF('consent_obtained', e.target.checked)} style={{ width: 18, height: 18 }} />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: form.consent_obtained ? '#065f46' : '#374151' }}>Informed Consent Obtained</div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 1 }}>Patient/guardian has signed the anaesthesia consent form</div>
            </div>
          </label>
        </SectionCard>

        {/* Fitness Status */}
        <SectionCard title="Fitness for Surgery" icon="bi-clipboard2-check">
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            {FITNESS_OPTIONS.map(opt => (
              <label key={opt.value} style={{
                cursor: 'pointer', flex: '1 1 180px',
                padding: '14px 18px', borderRadius: 10,
                border: `2px solid ${form.fitness_status === opt.value ? opt.color : '#e5e7eb'}`,
                background: form.fitness_status === opt.value ? opt.bg : '#fff',
                display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
              }}>
                <input type="radio" name="fitness_status" value={opt.value} checked={form.fitness_status === opt.value} onChange={() => setF('fitness_status', opt.value)} style={{ display: 'none' }} />
                <i className={`bi ${opt.value === 'fit' ? 'bi-check-circle-fill' : opt.value === 'fit_with_optimization' ? 'bi-exclamation-circle-fill' : 'bi-x-circle-fill'}`} style={{ fontSize: 20, color: form.fitness_status === opt.value ? opt.color : '#9ca3af' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: form.fitness_status === opt.value ? opt.color : '#374151' }}>
                  {opt.label}
                </span>
              </label>
            ))}
          </div>
          {errors.fitness_status && <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>{errors.fitness_status}</div>}

          <div>
            <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Additional Notes</label>
            <textarea
              value={form.additional_notes} onChange={e => setF('additional_notes', e.target.value)}
              rows={2} placeholder="Any additional pre-operative notes, optimization plan, deferred items…"
              style={{ ...inp('additional_notes'), resize: 'vertical', minHeight: 60 }}
            />
          </div>
        </SectionCard>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 24 }}>
          <button
            type="button"
            className="btn"
            onClick={onCancel || (() => nav(-1))}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 28px', borderRadius: 8, border: 'none',
              background: saving ? '#93c5fd' : '#2563eb', color: '#fff',
              fontWeight: 700, fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving
              ? <><i className="bi bi-hourglass-split" /> Saving…</>
              : <><i className="bi bi-clipboard2-check-fill" /> Save Assessment</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}
