import { useState, useEffect } from 'react'
import api from '../../api/client'

const ANAESTHESIA_TYPES = ['General', 'Spinal', 'Epidural', 'CSE', 'Regional', 'Local', 'Sedation']
const AIRWAY_TYPES = ['ETT', 'LMA', 'Face Mask', 'None', 'Tracheostomy']
const REGIONAL_TYPES = ['Spinal', 'Epidural', 'CSE', 'Regional']

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

function TagInput({ tags, onChange, placeholder }) {
  const [inputVal, setInputVal] = useState('')

  const addTag = () => {
    const v = inputVal.trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setInputVal('')
  }

  const removeTag = (t) => onChange(tags.filter(x => x !== t))

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <input value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
          placeholder={placeholder || 'Type and press Enter'}
          style={{ ...inputStyle, flex: 1 }} />
        <button type="button" onClick={addTag}
          style={{ ...btnStyle('#6366f1'), padding: '8px 12px', flexShrink: 0, fontSize: 16 }}>
          <i className="bi bi-plus" />
        </button>
      </div>
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tags.map(t => (
            <span key={t} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 6, padding: '3px 10px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {t}
              <button type="button" onClick={() => removeTag(t)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', padding: 0, lineHeight: 1, fontSize: 14 }}>
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
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

function ReadOnlyTags({ label, tags }) {
  if (!tags || tags.length === 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {tags.map(t => (
          <span key={t} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 6, padding: '3px 10px', fontSize: 13 }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

const sectionTitle = (title, icon) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
    <i className={`bi ${icon}`} style={{ color: '#6366f1', fontSize: 16 }} />
    <span style={{ fontWeight: 600, color: '#6366f1', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</span>
  </div>
)

const EMPTY_FORM = {
  anaesthesia_type: 'General',
  airway_management: 'ETT',
  airway_size: '',
  induction_time: '',
  intubation_time: '',
  extubation_time: '',
  induction_agents: [],
  maintenance_agents: [],
  reversal_agents: [],
  regional_block_details: '',
  nerve_stimulator_used: false,
  ultrasound_guided: false,
  monitoring_used: [],
  lines_placed: [],
  complications: '',
  difficult_intubation: false,
  intubation_attempts: '',
  recovery_score: '',
  post_op_pain_score: 0,
  nausea_vomiting: false,
  notes: '',
}

export default function AnaesthesiaRecord({ bookingId, record: initialRecord, onUpdate }) {
  const [record, setRecord] = useState(initialRecord || null)
  const [editing, setEditing] = useState(!initialRecord)
  const [form, setForm] = useState(initialRecord ? { ...EMPTY_FORM, ...initialRecord } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setRecord(initialRecord || null)
    setEditing(!initialRecord)
    setForm(initialRecord ? { ...EMPTY_FORM, ...initialRecord } : { ...EMPTY_FORM })
  }, [initialRecord])

  const setF = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const showRegional = REGIONAL_TYPES.includes(form.anaesthesia_type)

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const payload = { ...form, booking: bookingId }
    try {
      let res
      if (record) {
        res = await api.patch(`/ot/anaesthesia-records/${record.id}/`, payload)
      } else {
        res = await api.post('/ot/anaesthesia-records/', payload)
      }
      setRecord(res.data)
      setEditing(false)
      onUpdate && onUpdate(res.data)
    } catch (e) {
      setError(e?.response?.data?.detail || JSON.stringify(e?.response?.data) || 'Failed to save record')
    } finally {
      setSaving(false)
    }
  }

  if (!record && !editing) {
    return (
      <div style={{ ...sectionStyle, textAlign: 'center', padding: 64, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <i className="bi bi-lungs" style={{ fontSize: 48, color: '#94a3b8' }} />
        <div style={{ marginTop: 16, fontSize: 18, fontWeight: 600, color: '#64748b' }}>No Anaesthesia Record</div>
        <div style={{ color: '#94a3b8', marginTop: 6, marginBottom: 24, fontSize: 14 }}>Create an anaesthesia record for this procedure</div>
        <button style={btnStyle('#6366f1')} onClick={() => setEditing(true)}>
          <i className="bi bi-file-medical" /> Create Anaesthesia Record
        </button>
      </div>
    )
  }

  if (!editing && record) {
    return (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Anaesthesia Record</h2>
          <button style={btnStyle('#f5f3ff', '#6366f1')} onClick={() => setEditing(true)}>
            <i className="bi bi-pencil" /> Edit
          </button>
        </div>

        <div style={sectionStyle}>
          {sectionTitle('Anaesthesia & Airway', 'bi-lungs')}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600 }}>
              {record.anaesthesia_type}
            </span>
            <span style={{ background: '#dbeafe', color: '#2563eb', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600 }}>
              Airway: {record.airway_management}
            </span>
            {record.airway_size && (
              <span style={{ background: '#f1f5f9', color: '#475569', borderRadius: 20, padding: '4px 14px', fontSize: 13 }}>
                Size: {record.airway_size}
              </span>
            )}
            {record.nerve_stimulator_used && <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: 20, padding: '4px 14px', fontSize: 13 }}>Nerve Stimulator</span>}
            {record.ultrasound_guided && <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '4px 14px', fontSize: 13 }}>Ultrasound Guided</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <ReadOnlyField label="Induction Time" value={record.induction_time ? new Date(record.induction_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null} />
            <ReadOnlyField label="Intubation Time" value={record.intubation_time ? new Date(record.intubation_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null} />
            <ReadOnlyField label="Extubation Time" value={record.extubation_time ? new Date(record.extubation_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={sectionStyle}>
            {sectionTitle('Agents', 'bi-capsule')}
            <ReadOnlyTags label="Induction Agents" tags={record.induction_agents} />
            <ReadOnlyTags label="Maintenance Agents" tags={record.maintenance_agents} />
            <ReadOnlyTags label="Reversal Agents" tags={record.reversal_agents} />
            {record.regional_block_details && <ReadOnlyField label="Regional Block Details" value={record.regional_block_details} />}
          </div>
          <div style={sectionStyle}>
            {sectionTitle('Monitoring & Access', 'bi-activity')}
            <ReadOnlyTags label="Monitoring Used" tags={record.monitoring_used} />
            <ReadOnlyTags label="Lines Placed" tags={record.lines_placed} />
          </div>
        </div>

        <div style={sectionStyle}>
          {sectionTitle('Recovery & Post-Op', 'bi-heart-pulse')}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            {record.difficult_intubation && (
              <span style={{ background: '#fee2e2', color: '#ef4444', borderRadius: 20, padding: '4px 14px', fontSize: 13, fontWeight: 600 }}>
                Difficult Intubation ({record.intubation_attempts || '?'} attempts)
              </span>
            )}
            {record.nausea_vomiting && (
              <span style={{ background: '#fef3c7', color: '#d97706', borderRadius: 20, padding: '4px 14px', fontSize: 13 }}>PONV</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <ReadOnlyField label="Recovery Score at Transfer" value={record.recovery_score} />
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Post-Op Pain Score</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(record.post_op_pain_score || 0) * 10}%`, background: record.post_op_pain_score >= 7 ? '#ef4444' : record.post_op_pain_score >= 4 ? '#f59e0b' : '#10b981', borderRadius: 4 }} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', minWidth: 24, textAlign: 'right' }}>{record.post_op_pain_score ?? 0}</span>
              </div>
            </div>
          </div>
          {record.complications && <ReadOnlyField label="Complications" value={record.complications} />}
          {record.notes && <ReadOnlyField label="Notes" value={record.notes} />}
        </div>
      </div>
    )
  }

  // Edit / Create form
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Anaesthesia Record</h2>
      </div>

      {error && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#ef4444', marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Anaesthesia Type */}
      <div style={sectionStyle}>
        {sectionTitle('Anaesthesia Type', 'bi-lungs')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {ANAESTHESIA_TYPES.map(t => (
            <label key={t} style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              border: `2px solid ${form.anaesthesia_type === t ? '#6366f1' : '#e2e8f0'}`,
              borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 500,
              background: form.anaesthesia_type === t ? '#f0f0ff' : '#fff',
              color: form.anaesthesia_type === t ? '#6366f1' : '#64748b',
            }}>
              <input type="radio" name="anaesthesia_type" value={t}
                checked={form.anaesthesia_type === t}
                onChange={() => setF('anaesthesia_type', t)}
                style={{ display: 'none' }} />
              {t}
            </label>
          ))}
        </div>

        {sectionTitle('Airway Management', 'bi-wind')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {AIRWAY_TYPES.map(t => (
            <label key={t} style={{
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
              border: `2px solid ${form.airway_management === t ? '#0ea5e9' : '#e2e8f0'}`,
              borderRadius: 20, padding: '6px 14px', fontSize: 13, fontWeight: 500,
              background: form.airway_management === t ? '#f0f9ff' : '#fff',
              color: form.airway_management === t ? '#0ea5e9' : '#64748b',
            }}>
              <input type="radio" name="airway_management" value={t}
                checked={form.airway_management === t}
                onChange={() => setF('airway_management', t)}
                style={{ display: 'none' }} />
              {t}
            </label>
          ))}
        </div>
        <div style={{ maxWidth: 200 }}>
          <label style={labelStyle}>Airway Size</label>
          <input value={form.airway_size} onChange={e => setF('airway_size', e.target.value)}
            placeholder="e.g. 7.5" style={inputStyle} />
        </div>
      </div>

      {/* Timestamps */}
      <div style={sectionStyle}>
        {sectionTitle('Timestamps', 'bi-clock')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { key: 'induction_time', label: 'Induction Time' },
            { key: 'intubation_time', label: 'Intubation Time' },
            { key: 'extubation_time', label: 'Extubation Time' },
          ].map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}</label>
              <input type="datetime-local" value={form[f.key]}
                onChange={e => setF(f.key, e.target.value)}
                style={inputStyle} />
            </div>
          ))}
        </div>
      </div>

      {/* Agents */}
      <div style={sectionStyle}>
        {sectionTitle('Pharmacological Agents', 'bi-capsule')}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Induction Agents</label>
          <TagInput tags={form.induction_agents} onChange={v => setF('induction_agents', v)} placeholder="e.g. Propofol, Ketamine" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Maintenance Agents</label>
          <TagInput tags={form.maintenance_agents} onChange={v => setF('maintenance_agents', v)} placeholder="e.g. Sevoflurane, TIVA" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Reversal Agents</label>
          <TagInput tags={form.reversal_agents} onChange={v => setF('reversal_agents', v)} placeholder="e.g. Neostigmine" />
        </div>
        {showRegional && (
          <div>
            <label style={labelStyle}>Regional Block Details</label>
            <textarea value={form.regional_block_details}
              onChange={e => setF('regional_block_details', e.target.value)}
              rows={3} placeholder="Block type, level, drug/volume, technique..."
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        )}
      </div>

      {/* Monitoring & Lines */}
      <div style={sectionStyle}>
        {sectionTitle('Monitoring & Access', 'bi-activity')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <Toggle value={form.nerve_stimulator_used} onChange={v => setF('nerve_stimulator_used', v)} label="Nerve Stimulator" />
              <Toggle value={form.ultrasound_guided} onChange={v => setF('ultrasound_guided', v)} label="Ultrasound Guided" />
            </div>
            <label style={labelStyle}>Monitoring Used</label>
            <TagInput tags={form.monitoring_used} onChange={v => setF('monitoring_used', v)} placeholder="e.g. IBP, CVP, BIS" />
          </div>
          <div>
            <label style={labelStyle}>Lines Placed</label>
            <TagInput tags={form.lines_placed} onChange={v => setF('lines_placed', v)} placeholder="e.g. 16G PIV, CVC right IJV" />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Complications</label>
          <textarea value={form.complications} onChange={e => setF('complications', e.target.value)}
            rows={2} placeholder="Anaesthetic complications, if any..."
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      {/* Intubation & Recovery */}
      <div style={sectionStyle}>
        {sectionTitle('Intubation & Recovery', 'bi-heart-pulse')}
        <div style={{ marginBottom: 16 }}>
          <Toggle value={form.difficult_intubation} onChange={v => setF('difficult_intubation', v)} label="Difficult Intubation" />
        </div>
        {form.difficult_intubation && (
          <div style={{ marginBottom: 16, maxWidth: 200 }}>
            <label style={labelStyle}>Number of Attempts</label>
            <input type="number" min="1" value={form.intubation_attempts}
              onChange={e => setF('intubation_attempts', e.target.value)}
              style={inputStyle} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Recovery Score at Transfer</label>
            <input value={form.recovery_score} onChange={e => setF('recovery_score', e.target.value)}
              placeholder="e.g. Aldrete 9/10" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Post-Op Pain Score (0-10): <strong style={{ color: '#6366f1' }}>{form.post_op_pain_score}</strong></label>
            <input type="range" min="0" max="10" value={form.post_op_pain_score}
              onChange={e => setF('post_op_pain_score', parseInt(e.target.value))}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#6366f1' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              <span>0 No pain</span><span>10 Worst</span>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <Toggle value={form.nausea_vomiting} onChange={v => setF('nausea_vomiting', v)} label="Post-op Nausea / Vomiting (PONV)" />
        </div>
        <div>
          <label style={labelStyle}>Notes</label>
          <textarea value={form.notes} onChange={e => setF('notes', e.target.value)}
            rows={3} placeholder="Additional anaesthesia notes..."
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleSave} disabled={saving} style={btnStyle('#6366f1')}>
          {saving ? 'Saving...' : <><i className="bi bi-floppy" /> Save Record</>}
        </button>
        {record && (
          <button onClick={() => setEditing(false)} style={btnStyle('#f1f5f9', '#374151')}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
