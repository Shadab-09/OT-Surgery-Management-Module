import { useState, useEffect } from 'react'
import api from '../../api/client'

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

const EMPTY_FORM = {
  procedure_name: '',
  indication: '',
  anaesthesia_given: '',
  patient_position: '',
  incision: '',
  operative_findings: '',
  steps_performed: '',
  implants_used: '',
  specimens_sent: '',
  blood_loss: '',
  complications: '',
  closure: '',
  post_op_instructions: '',
}

function ReadOnlyField({ label, value, mono = false, large = false }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{
        background: '#f8fafc',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 14,
        color: '#1e293b',
        fontFamily: mono ? 'monospace' : 'inherit',
        whiteSpace: 'pre-wrap',
        lineHeight: large ? 1.7 : 1.5,
      }}>
        {value}
      </div>
    </div>
  )
}

export default function OperativeNote({ bookingId, note: initialNote, onUpdate }) {
  const [note, setNote] = useState(initialNote || null)
  const [editing, setEditing] = useState(!initialNote)
  const [form, setForm] = useState(initialNote ? {
    procedure_name: initialNote.procedure_name || '',
    indication: initialNote.indication || '',
    anaesthesia_given: initialNote.anaesthesia_given || '',
    patient_position: initialNote.patient_position || '',
    incision: initialNote.incision || '',
    operative_findings: initialNote.operative_findings || '',
    steps_performed: initialNote.steps_performed || '',
    implants_used: initialNote.implants_used || '',
    specimens_sent: initialNote.specimens_sent || '',
    blood_loss: initialNote.blood_loss || '',
    complications: initialNote.complications || '',
    closure: initialNote.closure || '',
    post_op_instructions: initialNote.post_op_instructions || '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [signing, setSigning] = useState(false)
  const [showSignConfirm, setShowSignConfirm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setNote(initialNote || null)
    setEditing(!initialNote)
    if (initialNote) {
      setForm({
        procedure_name: initialNote.procedure_name || '',
        indication: initialNote.indication || '',
        anaesthesia_given: initialNote.anaesthesia_given || '',
        patient_position: initialNote.patient_position || '',
        incision: initialNote.incision || '',
        operative_findings: initialNote.operative_findings || '',
        steps_performed: initialNote.steps_performed || '',
        implants_used: initialNote.implants_used || '',
        specimens_sent: initialNote.specimens_sent || '',
        blood_loss: initialNote.blood_loss || '',
        complications: initialNote.complications || '',
        closure: initialNote.closure || '',
        post_op_instructions: initialNote.post_op_instructions || '',
      })
    } else {
      setForm({ ...EMPTY_FORM })
    }
  }, [initialNote])

  const handleSave = async () => {
    if (!form.procedure_name.trim()) { setError('Procedure name is required'); return }
    setSaving(true)
    setError('')
    try {
      let res
      if (note) {
        res = await api.patch(`/ot/operative-notes/${note.id}/`, { ...form, booking: bookingId })
      } else {
        res = await api.post('/ot/operative-notes/', { ...form, booking: bookingId })
      }
      setNote(res.data)
      setEditing(false)
      onUpdate && onUpdate(res.data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save operative note')
    } finally {
      setSaving(false)
    }
  }

  const handleSign = async () => {
    if (!note) return
    setSigning(true)
    setError('')
    try {
      const res = await api.post(`/ot/operative-notes/${note.id}/sign/`)
      setNote(res.data)
      setShowSignConfirm(false)
      onUpdate && onUpdate(res.data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to sign note')
    } finally {
      setSigning(false)
    }
  }

  if (!note && !editing) {
    return (
      <div style={{ ...sectionStyle, textAlign: 'center', padding: 64 }}>
        <i className="bi bi-file-medical" style={{ fontSize: 48, color: '#94a3b8' }} />
        <div style={{ marginTop: 16, fontSize: 18, fontWeight: 600, color: '#64748b' }}>No Operative Note</div>
        <div style={{ color: '#94a3b8', marginTop: 6, marginBottom: 24, fontSize: 14 }}>
          Create an operative note for this procedure
        </div>
        <button style={btnStyle('#6366f1')} onClick={() => setEditing(true)}>
          <i className="bi bi-mic" /> Dictate Operative Note
        </button>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Operative Note</h2>
          {note?.is_signed && (
            <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <i className="bi bi-patch-check-fill" /> Signed
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {note && !note.is_signed && !editing && (
            <>
              <button style={btnStyle('#f5f3ff', '#6366f1')} onClick={() => setEditing(true)}>
                <i className="bi bi-pencil" /> Edit
              </button>
              <button style={btnStyle('#10b981')} onClick={() => setShowSignConfirm(true)}>
                <i className="bi bi-pen" /> Sign Note
              </button>
            </>
          )}
        </div>
      </div>

      {/* Signed info banner */}
      {note?.is_signed && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="bi bi-shield-check" style={{ color: '#16a34a', fontSize: 18 }} />
          <div>
            <span style={{ fontWeight: 600, color: '#15803d' }}>Digitally Signed</span>
            {note.signed_at && (
              <span style={{ color: '#64748b', fontSize: 13, marginLeft: 10 }}>
                {new Date(note.signed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            )}
            {note.dictated_by_name && (
              <span style={{ color: '#64748b', fontSize: 13, marginLeft: 10 }}>
                by <strong>{note.dictated_by_name}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#ef4444', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Display or Edit Mode */}
      {!editing && note ? (
        <div>
          <div style={sectionStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ReadOnlyField label="Procedure Name" value={note.procedure_name} />
              <ReadOnlyField label="Anaesthesia Given" value={note.anaesthesia_given} />
              <ReadOnlyField label="Patient Position" value={note.patient_position} />
              <ReadOnlyField label="Incision" value={note.incision} />
              <ReadOnlyField label="Blood Loss" value={note.blood_loss} />
            </div>
            <ReadOnlyField label="Indication" value={note.indication} />
          </div>
          <div style={sectionStyle}>
            <ReadOnlyField label="Operative Findings" value={note.operative_findings} large />
            <ReadOnlyField label="Steps Performed" value={note.steps_performed} mono large />
          </div>
          <div style={sectionStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <ReadOnlyField label="Implants Used" value={note.implants_used} />
              <ReadOnlyField label="Specimens Sent" value={note.specimens_sent} />
            </div>
            <ReadOnlyField label="Complications" value={note.complications} />
            <ReadOnlyField label="Closure" value={note.closure} />
            <ReadOnlyField label="Post-Op Instructions" value={note.post_op_instructions} large />
          </div>
        </div>
      ) : (
        <div>
          {/* Edit Form */}
          <div style={sectionStyle}>
            <div style={{ fontWeight: 600, color: '#6366f1', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>Procedure Details</div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Procedure Name *</label>
              <input value={form.procedure_name} onChange={e => setForm(p => ({ ...p, procedure_name: e.target.value }))}
                placeholder="e.g. Laparoscopic Cholecystectomy" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Indication</label>
              <textarea value={form.indication} onChange={e => setForm(p => ({ ...p, indication: e.target.value }))}
                placeholder="Clinical indication for procedure..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Anaesthesia Given</label>
                <input value={form.anaesthesia_given} onChange={e => setForm(p => ({ ...p, anaesthesia_given: e.target.value }))}
                  placeholder="e.g. Spinal" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Patient Position</label>
                <input value={form.patient_position} onChange={e => setForm(p => ({ ...p, patient_position: e.target.value }))}
                  placeholder="e.g. Supine" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Incision</label>
                <input value={form.incision} onChange={e => setForm(p => ({ ...p, incision: e.target.value }))}
                  placeholder="e.g. Midline laparotomy" style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ fontWeight: 600, color: '#6366f1', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>Operative Details</div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Operative Findings</label>
              <textarea value={form.operative_findings} onChange={e => setForm(p => ({ ...p, operative_findings: e.target.value }))}
                rows={4} placeholder="Intraoperative findings..." style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Steps Performed</label>
              <textarea value={form.steps_performed} onChange={e => setForm(p => ({ ...p, steps_performed: e.target.value }))}
                rows={6} placeholder="1. ..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.7 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Implants Used</label>
                <textarea value={form.implants_used} onChange={e => setForm(p => ({ ...p, implants_used: e.target.value }))}
                  rows={3} placeholder="List implants used..." style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Specimens Sent</label>
                <textarea value={form.specimens_sent} onChange={e => setForm(p => ({ ...p, specimens_sent: e.target.value }))}
                  rows={3} placeholder="Histopathology, culture..." style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Blood Loss</label>
                <input value={form.blood_loss} onChange={e => setForm(p => ({ ...p, blood_loss: e.target.value }))}
                  placeholder="e.g. 200 mL" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Complications</label>
                <textarea value={form.complications} onChange={e => setForm(p => ({ ...p, complications: e.target.value }))}
                  rows={2} placeholder="Intraoperative complications, if any..." style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={{ fontWeight: 600, color: '#6366f1', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>Closure & Post-Op</div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Closure</label>
              <textarea value={form.closure} onChange={e => setForm(p => ({ ...p, closure: e.target.value }))}
                rows={3} placeholder="Wound closure technique..." style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Post-Op Instructions</label>
              <textarea value={form.post_op_instructions} onChange={e => setForm(p => ({ ...p, post_op_instructions: e.target.value }))}
                rows={4} placeholder="Post-operative care instructions..." style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSave} disabled={saving} style={btnStyle('#6366f1')}>
              {saving ? 'Saving...' : <><i className="bi bi-floppy" /> Save Note</>}
            </button>
            {note && (
              <button onClick={() => setEditing(false)} style={btnStyle('#f1f5f9', '#374151')}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sign Confirmation Modal */}
      {showSignConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 400, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <i className="bi bi-pen" style={{ fontSize: 24, color: '#10b981' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Sign Operative Note</h3>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 24px' }}>
              By signing, you confirm that this operative note is accurate and complete. This action cannot be undone.
            </p>
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSign} disabled={signing} style={{ ...btnStyle('#10b981'), flex: 1, justifyContent: 'center' }}>
                {signing ? 'Signing...' : <><i className="bi bi-check-lg" /> Confirm & Sign</>}
              </button>
              <button onClick={() => setShowSignConfirm(false)} style={{ ...btnStyle('#f1f5f9', '#374151'), flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
