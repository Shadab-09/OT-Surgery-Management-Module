import { useState, useEffect } from 'react'
import api from '../../api/client'

const WOUND_CLASSES = [
  { value: 'I', label: 'Class I', sublabel: 'Clean', color: '#10b981', bg: '#dcfce7', desc: 'Uninfected wound, no entry into GI/respiratory/GU tract' },
  { value: 'II', label: 'Class II', sublabel: 'Clean-Contaminated', color: '#3b82f6', bg: '#dbeafe', desc: 'Controlled entry into GI/respiratory/biliary tract' },
  { value: 'III', label: 'Class III', sublabel: 'Contaminated', color: '#f59e0b', bg: '#fef3c7', desc: 'Fresh open wound, spillage from GI tract' },
  { value: 'IV', label: 'Class IV', sublabel: 'Dirty', color: '#ef4444', bg: '#fee2e2', desc: 'Old traumatic wound, clinical infection present' },
]

const OUTCOME_30_DAY = [
  { value: 'recovered', label: 'Recovered', color: '#10b981' },
  { value: 'improved', label: 'Improved', color: '#3b82f6' },
  { value: 'unchanged', label: 'Unchanged', color: '#64748b' },
  { value: 'deteriorated', label: 'Deteriorated', color: '#f59e0b' },
  { value: 'expired', label: 'Expired', color: '#ef4444' },
]

const SSI_TYPES = ['Superficial', 'Deep', 'Organ-space']

const sectionStyle = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  padding: '20px 24px',
  marginBottom: 16,
}

const btnStyle = (color = '#6366f1', textColor = '#fff') => ({
  background: color,
  color: textColor,
  border: 'none',
  borderRadius: 8,
  padding: '8px 18px',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: 14,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
})

const inputStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block',
  fontWeight: 500,
  fontSize: 13,
  color: '#374151',
  marginBottom: 4,
}

const sectionTitle = (title, icon) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
    <i className={`bi ${icon}`} style={{ color: '#6366f1', fontSize: 16 }} />
    <span style={{ fontWeight: 600, color: '#6366f1', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</span>
  </div>
)

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div onClick={() => onChange(!value)}
        style={{ width: 40, height: 22, borderRadius: 11, background: value ? '#6366f1' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      {label && <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{label}</span>}
    </div>
  )
}

function ReadOnlyField({ label, value }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 12px', fontSize: 14, color: '#1e293b', whiteSpace: 'pre-wrap' }}>{String(value)}</div>
    </div>
  )
}

const EMPTY_FORM = {
  wound_classification: '',
  ssi_occurred: false,
  ssi_date: '',
  ssi_type: '',
  intraoperative_complications: '',
  postoperative_complications: '',
  reoperation: false,
  reoperation_date: '',
  reoperation_reason: '',
  icu_admission: false,
  icu_days: '',
  hospital_stay_days: '',
  outcome_30_day: '',
  mortality_30_day: false,
  mortality_cause: '',
  trainee_surgeon: '',
  trainee_role: '',
  audit_notes: '',
}

export default function SurgicalOutcome({ bookingId, outcome: initialOutcome, onUpdate }) {
  const [outcome, setOutcome] = useState(initialOutcome || null)
  const [editing, setEditing] = useState(!initialOutcome)
  const [form, setForm] = useState(initialOutcome ? { ...EMPTY_FORM, ...initialOutcome } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setOutcome(initialOutcome || null)
    setEditing(!initialOutcome)
    setForm(initialOutcome ? { ...EMPTY_FORM, ...initialOutcome } : { ...EMPTY_FORM })
  }, [initialOutcome])

  const setF = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const payload = { ...form, booking: bookingId }
    try {
      let res
      if (outcome) {
        res = await api.patch(`/ot/outcomes/${outcome.id}/`, payload)
      } else {
        res = await api.post('/ot/outcomes/', payload)
      }
      setOutcome(res.data)
      setEditing(false)
      onUpdate && onUpdate(res.data)
    } catch (e) {
      setError(e?.response?.data?.detail || JSON.stringify(e?.response?.data) || 'Failed to save outcome')
    } finally {
      setSaving(false)
    }
  }

  if (!outcome && !editing) {
    return (
      <div style={{ ...sectionStyle, textAlign: 'center', padding: 64, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <i className="bi bi-clipboard2-pulse" style={{ fontSize: 48, color: '#94a3b8' }} />
        <div style={{ marginTop: 16, fontSize: 18, fontWeight: 600, color: '#64748b' }}>No Outcome Recorded</div>
        <div style={{ color: '#94a3b8', marginTop: 6, marginBottom: 24, fontSize: 14 }}>Record the surgical outcome and audit data for this case</div>
        <button style={btnStyle('#6366f1')} onClick={() => setEditing(true)}>
          <i className="bi bi-plus-circle" /> Record Outcome
        </button>
      </div>
    )
  }

  if (!editing && outcome) {
    const wc = WOUND_CLASSES.find(w => w.value === outcome.wound_classification)
    const out30 = OUTCOME_30_DAY.find(o => o.value === outcome.outcome_30_day)
    return (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Surgical Outcome & Audit</h2>
          <button style={btnStyle('#f5f3ff', '#6366f1')} onClick={() => setEditing(true)}>
            <i className="bi bi-pencil" /> Edit
          </button>
        </div>

        {wc && (
          <div style={{ ...sectionStyle, display: 'flex', alignItems: 'center', gap: 16, background: wc.bg, border: `1px solid ${wc.color}40` }}>
            <div style={{ width: 52, height: 52, borderRadius: 10, background: wc.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>
              {wc.value}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: wc.color, fontSize: 15 }}>{wc.label} — {wc.sublabel}</div>
              <div style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{wc.desc}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={sectionStyle}>
            {sectionTitle('Infection & Complications', 'bi-virus2')}
            <div style={{ marginBottom: 10 }}>
              <span style={{ background: outcome.ssi_occurred ? '#fee2e2' : '#f0fdf4', color: outcome.ssi_occurred ? '#ef4444' : '#16a34a', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                SSI: {outcome.ssi_occurred ? 'Yes' : 'No'}
              </span>
            </div>
            {outcome.ssi_occurred && <ReadOnlyField label="SSI Type" value={outcome.ssi_type} />}
            {outcome.ssi_occurred && <ReadOnlyField label="SSI Date" value={outcome.ssi_date} />}
            <ReadOnlyField label="Intraoperative Complications" value={outcome.intraoperative_complications} />
            <ReadOnlyField label="Postoperative Complications" value={outcome.postoperative_complications} />
          </div>

          <div style={sectionStyle}>
            {sectionTitle('Recovery', 'bi-heart-pulse')}
            <div style={{ marginBottom: 10 }}>
              <span style={{ background: outcome.reoperation ? '#fee2e2' : '#f0fdf4', color: outcome.reoperation ? '#ef4444' : '#16a34a', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                Reoperation: {outcome.reoperation ? 'Yes' : 'No'}
              </span>
            </div>
            {outcome.reoperation && <ReadOnlyField label="Reoperation Reason" value={outcome.reoperation_reason} />}
            {outcome.icu_admission && <ReadOnlyField label="ICU Days" value={outcome.icu_days} />}
            <ReadOnlyField label="Hospital Stay (days)" value={outcome.hospital_stay_days} />
          </div>
        </div>

        <div style={sectionStyle}>
          {sectionTitle('30-Day Outcome', 'bi-calendar-check')}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            {out30 && (
              <span style={{ background: out30.color + '20', color: out30.color, borderRadius: 20, padding: '4px 16px', fontSize: 13, fontWeight: 700 }}>
                {out30.label}
              </span>
            )}
            <span style={{ background: outcome.mortality_30_day ? '#fee2e2' : '#f0fdf4', color: outcome.mortality_30_day ? '#ef4444' : '#16a34a', borderRadius: 20, padding: '4px 16px', fontSize: 13, fontWeight: 600 }}>
              30-Day Mortality: {outcome.mortality_30_day ? 'Yes' : 'No'}
            </span>
          </div>
          {outcome.mortality_30_day && <ReadOnlyField label="Cause of Death" value={outcome.mortality_cause} />}
        </div>

        <div style={sectionStyle}>
          {sectionTitle('Audit', 'bi-journal-text')}
          <ReadOnlyField label="Trainee Surgeon" value={outcome.trainee_surgeon} />
          <ReadOnlyField label="Trainee Role" value={outcome.trainee_role} />
          <ReadOnlyField label="Audit Notes" value={outcome.audit_notes} />
        </div>
      </div>
    )
  }

  // Edit / Create form
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Surgical Outcome & Audit</h2>
      </div>

      {error && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#ef4444', marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Wound Classification */}
      <div style={sectionStyle}>
        {sectionTitle('Wound Classification', 'bi-bandaid')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {WOUND_CLASSES.map(wc => (
            <label key={wc.value} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
              border: `2px solid ${form.wound_classification === wc.value ? wc.color : '#e2e8f0'}`,
              borderRadius: 10, padding: '12px', background: form.wound_classification === wc.value ? wc.bg : '#fff',
              transition: 'all 0.15s',
            }}>
              <input type="radio" name="wound_class" value={wc.value}
                checked={form.wound_classification === wc.value}
                onChange={() => setF('wound_classification', wc.value)}
                style={{ marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700, color: wc.color }}>{wc.label} — {wc.sublabel}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{wc.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* SSI */}
      <div style={sectionStyle}>
        {sectionTitle('Surgical Site Infection', 'bi-virus2')}
        <div style={{ marginBottom: 16 }}>
          <Toggle value={form.ssi_occurred} onChange={v => setF('ssi_occurred', v)} label="SSI Occurred" />
        </div>
        {form.ssi_occurred && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>SSI Date</label>
              <input type="date" value={form.ssi_date} onChange={e => setF('ssi_date', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>SSI Type</label>
              <select value={form.ssi_type} onChange={e => setF('ssi_type', e.target.value)} style={inputStyle}>
                <option value="">Select type...</option>
                {SSI_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Complications */}
      <div style={sectionStyle}>
        {sectionTitle('Complications', 'bi-exclamation-triangle')}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Intraoperative Complications</label>
          <textarea value={form.intraoperative_complications}
            onChange={e => setF('intraoperative_complications', e.target.value)}
            rows={3} placeholder="None / describe complications..."
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>Postoperative Complications</label>
          <textarea value={form.postoperative_complications}
            onChange={e => setF('postoperative_complications', e.target.value)}
            rows={3} placeholder="None / describe complications..."
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      {/* Reoperation */}
      <div style={sectionStyle}>
        {sectionTitle('Reoperation', 'bi-arrow-repeat')}
        <div style={{ marginBottom: 16 }}>
          <Toggle value={form.reoperation} onChange={v => setF('reoperation', v)} label="Reoperation Required" />
        </div>
        {form.reoperation && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Reoperation Date</label>
              <input type="date" value={form.reoperation_date} onChange={e => setF('reoperation_date', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Reason for Reoperation</label>
              <textarea value={form.reoperation_reason} onChange={e => setF('reoperation_reason', e.target.value)}
                rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
        )}
      </div>

      {/* Recovery */}
      <div style={sectionStyle}>
        {sectionTitle('Recovery & Hospital Stay', 'bi-hospital')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ marginBottom: 12 }}>
              <Toggle value={form.icu_admission} onChange={v => setF('icu_admission', v)} label="ICU Admission" />
            </div>
            {form.icu_admission && (
              <div>
                <label style={labelStyle}>ICU Days</label>
                <input type="number" min="0" value={form.icu_days} onChange={e => setF('icu_days', e.target.value)} style={inputStyle} />
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Total Hospital Stay (days)</label>
            <input type="number" min="0" value={form.hospital_stay_days} onChange={e => setF('hospital_stay_days', e.target.value)} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* 30-Day Outcome */}
      <div style={sectionStyle}>
        {sectionTitle('30-Day Outcome', 'bi-calendar-check')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {OUTCOME_30_DAY.map(opt => (
            <label key={opt.value} style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              border: `2px solid ${form.outcome_30_day === opt.value ? opt.color : '#e2e8f0'}`,
              borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 500,
              background: form.outcome_30_day === opt.value ? opt.color + '15' : '#fff',
              color: form.outcome_30_day === opt.value ? opt.color : '#64748b',
            }}>
              <input type="radio" name="outcome_30" value={opt.value}
                checked={form.outcome_30_day === opt.value}
                onChange={() => setF('outcome_30_day', opt.value)}
                style={{ display: 'none' }} />
              {opt.label}
            </label>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <Toggle value={form.mortality_30_day} onChange={v => setF('mortality_30_day', v)} label="30-Day Mortality" />
        </div>
        {form.mortality_30_day && (
          <div>
            <label style={labelStyle}>Cause of Death</label>
            <textarea value={form.mortality_cause} onChange={e => setF('mortality_cause', e.target.value)}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        )}
      </div>

      {/* Trainee & Audit */}
      <div style={sectionStyle}>
        {sectionTitle('Trainee & Audit', 'bi-journal-text')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Trainee Surgeon</label>
            <input value={form.trainee_surgeon} onChange={e => setF('trainee_surgeon', e.target.value)}
              placeholder="Name or ID" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Trainee Role</label>
            <input value={form.trainee_role} onChange={e => setF('trainee_role', e.target.value)}
              placeholder="e.g. PGY-2, Fellow" style={inputStyle} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Audit Notes</label>
          <textarea value={form.audit_notes} onChange={e => setF('audit_notes', e.target.value)}
            rows={3} placeholder="Case audit observations, learning points..."
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleSave} disabled={saving} style={btnStyle('#6366f1')}>
          {saving ? 'Saving...' : <><i className="bi bi-floppy" /> Save Outcome</>}
        </button>
        {outcome && (
          <button onClick={() => setEditing(false)} style={btnStyle('#f1f5f9', '#374151')}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
