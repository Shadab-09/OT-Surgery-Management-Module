import { useEffect, useState, useCallback } from 'react'
import api from '../../api/client'

function fmtDT(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', justifyContent: 'center' }}>
    <div style={{ width: 24, height: 24, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</span>
  </div>
)

const SectionCard = ({ title, icon, action, children }) => (
  <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 18, overflow: 'hidden' }}>
    <div style={{ padding: '12px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon && <i className={`bi ${icon}`} style={{ color: '#6b7280', fontSize: 14 }} />} {title}
      </span>
      {action}
    </div>
    <div>{children}</div>
  </div>
)

const inp = { border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 9px', fontSize: '0.82rem', width: '100%' }

// ── Vitals Table ─────────────────────────────────────────────────────────
function VitalsTable({ vitals, onAdd, adding, setAdding, addLoading }) {
  const blankVital = { recorded_at: new Date().toISOString().slice(0, 16), systolic_bp: '', diastolic_bp: '', heart_rate: '', spo2: '', temperature: '', etco2: '' }
  const [form, setForm] = useState({ ...blankVital })

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onAdd(form)
    setForm({ ...blankVital })
  }

  const VITAL_COLS = [
    { key: 'systolic_bp', label: 'BP Sys', unit: 'mmHg', color: '#dc2626' },
    { key: 'diastolic_bp', label: 'BP Dia', unit: 'mmHg', color: '#2563eb' },
    { key: 'heart_rate', label: 'HR', unit: '/min', color: '#d97706' },
    { key: 'spo2', label: 'SpO₂', unit: '%', color: '#7c3aed' },
    { key: 'temperature', label: 'Temp', unit: '°C', color: '#0d9488' },
    { key: 'etco2', label: 'EtCO₂', unit: 'mmHg', color: '#16a34a' },
  ]

  return (
    <SectionCard
      title="Vital Signs Timeline"
      icon="bi-heart-pulse"
      action={
        <button
          onClick={() => setAdding(a => ({ ...a, vital: !a.vital }))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: adding.vital ? '#f1f5f9' : '#2563eb', color: adding.vital ? '#374151' : '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
        >
          <i className={`bi ${adding.vital ? 'bi-x' : 'bi-plus'}`} />
          {adding.vital ? 'Cancel' : 'Add Vital'}
        </button>
      }
    >
      {/* Add Vital Form */}
      {adding.vital && (
        <form onSubmit={handleSubmit} style={{ padding: '14px 16px', background: '#f8f9fc', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px repeat(6, 1fr) auto', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Date & Time</label>
              <input type="datetime-local" value={form.recorded_at} onChange={e => setForm(f => ({ ...f, recorded_at: e.target.value }))} style={inp} required />
            </div>
            {VITAL_COLS.map(col => (
              <div key={col.key}>
                <label style={{ fontSize: '0.72rem', fontWeight: 600, color: col.color, display: 'block', marginBottom: 3 }}>
                  {col.label} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({col.unit})</span>
                </label>
                <input
                  type="number" step="0.1" min="0"
                  value={form[col.key]}
                  onChange={e => setForm(f => ({ ...f, [col.key]: e.target.value }))}
                  style={inp}
                  placeholder="—"
                />
              </div>
            ))}
            <button type="submit" disabled={addLoading === 'vital'} style={{ padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
              {addLoading === 'vital' ? '…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {/* Vitals Table */}
      {vitals.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', ...VITAL_COLS.map(c => `${c.label} (${c.unit})`)].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', padding: '10px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vitals.map((v, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '10px 12px', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', color: '#374151' }}>{fmtDT(v.recorded_at)}</td>
                  {VITAL_COLS.map(col => (
                    <td key={col.key} style={{ padding: '10px 12px', fontSize: '0.875rem', fontWeight: 700, color: v[col.key] ? col.color : '#9ca3af', textAlign: 'center' }}>
                      {v[col.key] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '28px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          <i className="bi bi-heart-pulse" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.35 }} />
          No vital signs recorded yet.
        </div>
      )}
    </SectionCard>
  )
}

// ── Drug Log ─────────────────────────────────────────────────────────────
function DrugLog({ drugs, onAdd, adding, setAdding, addLoading }) {
  const blank = { drug_name: '', dose: '', unit: 'mg', route: 'iv', administered_at: new Date().toISOString().slice(0, 16), notes: '' }
  const [form, setForm] = useState({ ...blank })

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onAdd(form)
    setForm({ ...blank })
  }

  return (
    <SectionCard
      title="Drug Administrations"
      icon="bi-capsule"
      action={
        <button
          onClick={() => setAdding(a => ({ ...a, drug: !a.drug }))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: adding.drug ? '#f1f5f9' : '#7c3aed', color: adding.drug ? '#374151' : '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
        >
          <i className={`bi ${adding.drug ? 'bi-x' : 'bi-plus'}`} />
          {adding.drug ? 'Cancel' : 'Add Drug'}
        </button>
      }
    >
      {adding.drug && (
        <form onSubmit={handleSubmit} style={{ padding: '14px 16px', background: '#faf5ff', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 100px 80px 100px 160px 1fr auto', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Drug Name *</label>
              <input type="text" value={form.drug_name} onChange={e => setForm(f => ({ ...f, drug_name: e.target.value }))} style={inp} placeholder="e.g. Fentanyl" required />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Dose *</label>
              <input type="number" step="0.001" value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} style={inp} required />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Unit</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inp}>
                {['mcg', 'mg', 'g', 'mL', 'IU', 'mmol'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Route</label>
              <select value={form.route} onChange={e => setForm(f => ({ ...f, route: e.target.value }))} style={inp}>
                {['iv', 'im', 'sc', 'oral', 'topical', 'epidural', 'intrathecal', 'inhaled'].map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Administered At</label>
              <input type="datetime-local" value={form.administered_at} onChange={e => setForm(f => ({ ...f, administered_at: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inp} placeholder="Optional" />
            </div>
            <button type="submit" disabled={addLoading === 'drug'} style={{ padding: '7px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
              {addLoading === 'drug' ? '…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {drugs.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Time', 'Drug', 'Dose', 'Route', 'By', 'Notes'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', padding: '10px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drugs.map((d, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDT(d.administered_at)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: '0.875rem', color: '#7c3aed' }}>{d.drug_name}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.875rem' }}>{d.dose} {d.unit}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>{d.route?.toUpperCase()}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#6b7280' }}>{d.administered_by_name || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#6b7280' }}>{d.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '28px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          <i className="bi bi-capsule" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.35 }} />
          No drugs administered yet.
        </div>
      )}
    </SectionCard>
  )
}

// ── Blood Products ────────────────────────────────────────────────────────
function BloodProducts({ products, onAdd, adding, setAdding, addLoading }) {
  const blank = { product_type: 'prbc', units: 1, blood_group: '', cross_match_no: '', administered_at: new Date().toISOString().slice(0, 16), reaction: '' }
  const [form, setForm] = useState({ ...blank })

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onAdd(form)
    setForm({ ...blank })
  }

  return (
    <SectionCard
      title="Blood Products"
      icon="bi-droplet-half"
      action={
        <button
          onClick={() => setAdding(a => ({ ...a, blood: !a.blood }))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: adding.blood ? '#f1f5f9' : '#dc2626', color: adding.blood ? '#374151' : '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
        >
          <i className={`bi ${adding.blood ? 'bi-x' : 'bi-plus'}`} />
          {adding.blood ? 'Cancel' : 'Add Blood Product'}
        </button>
      }
    >
      {adding.blood && (
        <form onSubmit={handleSubmit} style={{ padding: '14px 16px', background: '#fff5f5', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '150px 80px 100px 160px 1fr auto', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Product Type</label>
              <select value={form.product_type} onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))} style={inp}>
                {[['prbc', 'PRBC'], ['ffp', 'FFP'], ['platelets', 'Platelets'], ['cryo', 'Cryoprecipitate'], ['whole_blood', 'Whole Blood'], ['albumin', 'Albumin']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Units</label>
              <input type="number" min="1" value={form.units} onChange={e => setForm(f => ({ ...f, units: e.target.value }))} style={inp} required />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Blood Group</label>
              <select value={form.blood_group} onChange={e => setForm(f => ({ ...f, blood_group: e.target.value }))} style={inp}>
                <option value="">—</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Cross-Match No.</label>
              <input type="text" value={form.cross_match_no} onChange={e => setForm(f => ({ ...f, cross_match_no: e.target.value }))} style={inp} placeholder="XM-12345" />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Time</label>
              <input type="datetime-local" value={form.administered_at} onChange={e => setForm(f => ({ ...f, administered_at: e.target.value }))} style={inp} />
            </div>
            <button type="submit" disabled={addLoading === 'blood'} style={{ padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
              {addLoading === 'blood' ? '…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {products.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Product', 'Units', 'Blood Group', 'Cross-Match', 'Time', 'Reaction'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', padding: '10px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#dc2626', fontSize: '0.875rem' }}>
                    {p.product_type?.toUpperCase().replace('_', ' ')}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '0.875rem' }}>{p.units}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.875rem' }}>{p.blood_group || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#6b7280' }}>{p.cross_match_no || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDT(p.administered_at)}</td>
                  <td style={{ padding: '10px 14px', fontSize: '0.8rem' }}>
                    {p.reaction ? <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>{p.reaction}</span> : <span style={{ color: '#9ca3af' }}>None</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '28px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          <i className="bi bi-droplet" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.35 }} />
          No blood products administered.
        </div>
      )}
    </SectionCard>
  )
}

// ── Specimens ─────────────────────────────────────────────────────────────
function Specimens({ specimens, onAdd, adding, setAdding, addLoading }) {
  const blank = { specimen_type: 'tissue', description: '', collection_site: '', lab_status: 'sent' }
  const [form, setForm] = useState({ ...blank })

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onAdd(form)
    setForm({ ...blank })
  }

  const labStatusColor = { sent: { bg: '#e0f2fe', color: '#0369a1' }, received: { bg: '#fef3c7', color: '#92400e' }, processing: { bg: '#ede9fe', color: '#6d28d9' }, reported: { bg: '#d1fae5', color: '#065f46' } }

  return (
    <SectionCard
      title="Specimens"
      icon="bi-eyedropper"
      action={
        <button
          onClick={() => setAdding(a => ({ ...a, specimen: !a.specimen }))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: adding.specimen ? '#f1f5f9' : '#0d9488', color: adding.specimen ? '#374151' : '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
        >
          <i className={`bi ${adding.specimen ? 'bi-x' : 'bi-plus'}`} />
          {adding.specimen ? 'Cancel' : 'Add Specimen'}
        </button>
      }
    >
      {adding.specimen && (
        <form onSubmit={handleSubmit} style={{ padding: '14px 16px', background: '#f0fdfa', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr 120px auto', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Type</label>
              <select value={form.specimen_type} onChange={e => setForm(f => ({ ...f, specimen_type: e.target.value }))} style={inp}>
                {['tissue', 'fluid', 'biopsy', 'swab', 'blood', 'urine', 'other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Description</label>
              <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={inp} placeholder="e.g. Right inguinal lymph node" required />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Collection Site</label>
              <input type="text" value={form.collection_site} onChange={e => setForm(f => ({ ...f, collection_site: e.target.value }))} style={inp} placeholder="e.g. Right groin" />
            </div>
            <div>
              <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>Lab Status</label>
              <select value={form.lab_status} onChange={e => setForm(f => ({ ...f, lab_status: e.target.value }))} style={inp}>
                {['sent', 'received', 'processing', 'reported'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <button type="submit" disabled={addLoading === 'specimen'} style={{ padding: '7px 14px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
              {addLoading === 'specimen' ? '…' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {specimens.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['#', 'Type', 'Description', 'Collection Site', 'Lab Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '0.68rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', padding: '10px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {specimens.map((s, i) => {
                const sc = labStatusColor[s.lab_status] || { bg: '#f1f5f9', color: '#475569' }
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#9ca3af', fontWeight: 700 }}>#{i + 1}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.875rem', textTransform: 'capitalize' }}>{s.specimen_type}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.875rem', fontWeight: 600 }}>{s.description}</td>
                    <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#6b7280' }}>{s.collection_site || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize' }}>{s.lab_status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: '28px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          <i className="bi bi-eyedropper" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.35 }} />
          No specimens collected yet.
        </div>
      )}
    </SectionCard>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function IntraopRecord({ bookingId }) {
  const [record, setRecord] = useState(null)
  const [vitals, setVitals] = useState([])
  const [drugs, setDrugs] = useState([])
  const [bloodProducts, setBloodProducts] = useState([])
  const [specimens, setSpecimens] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState({ vital: false, drug: false, blood: false, specimen: false })
  const [addLoading, setAddLoading] = useState(null)
  const [error, setError] = useState('')
  const [savingFluid, setSavingFluid] = useState(false)
  const [fluid, setFluid] = useState({ iv_fluids_ml: '', blood_loss_ml: '', urine_output_ml: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/ot/intraop-records/', { params: { booking: bookingId } })
      const list = Array.isArray(res.data) ? res.data : (res.data.results || [])
      const r = list[0] || null
      setRecord(r)
      if (r) {
        setVitals(r.vitals || [])
        setDrugs(r.drug_administrations || r.drugs || [])
        setBloodProducts(r.blood_products || [])
        setSpecimens(r.specimens || [])
        setFluid({
          iv_fluids_ml: r.iv_fluids_ml || '',
          blood_loss_ml: r.blood_loss_ml || '',
          urine_output_ml: r.urine_output_ml || '',
        })
      }
    } catch { setRecord(null) } finally { setLoading(false) }
  }, [bookingId])

  useEffect(() => { load() }, [load])

  const createRecord = async () => {
    try {
      const res = await api.post('/ot/intraop-records/', { booking: bookingId })
      setRecord(res.data)
      load()
    } catch (e) { setError(e.response?.data?.detail || 'Failed to create record.') }
  }

  const addVital = async (form) => {
    setAddLoading('vital')
    try {
      await api.post(`/ot/intraop-records/${record.id}/add-vital/`, form)
      setAdding(a => ({ ...a, vital: false }))
      load()
    } catch (e) { setError(e.response?.data?.detail || 'Failed to add vital.') } finally { setAddLoading(null) }
  }

  const addDrug = async (form) => {
    setAddLoading('drug')
    try {
      await api.post(`/ot/intraop-records/${record.id}/add-drug/`, form)
      setAdding(a => ({ ...a, drug: false }))
      load()
    } catch (e) { setError(e.response?.data?.detail || 'Failed to add drug.') } finally { setAddLoading(null) }
  }

  const addBlood = async (form) => {
    setAddLoading('blood')
    try {
      await api.post(`/ot/intraop-records/${record.id}/add-blood-product/`, form)
      setAdding(a => ({ ...a, blood: false }))
      load()
    } catch (e) { setError(e.response?.data?.detail || 'Failed to add blood product.') } finally { setAddLoading(null) }
  }

  const addSpecimen = async (form) => {
    setAddLoading('specimen')
    try {
      await api.post(`/ot/intraop-records/${record.id}/add-specimen/`, form)
      setAdding(a => ({ ...a, specimen: false }))
      load()
    } catch (e) { setError(e.response?.data?.detail || 'Failed to add specimen.') } finally { setAddLoading(null) }
  }

  const saveFluid = async () => {
    setSavingFluid(true)
    try {
      await api.patch(`/ot/intraop-records/${record.id}/`, fluid)
      load()
    } catch (e) { setError(e.response?.data?.detail || 'Failed to save fluid balance.') } finally { setSavingFluid(false) }
  }

  if (loading) return <Spinner />

  if (!record) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
        <i className="bi bi-activity" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.35 }} />
        <p style={{ fontSize: '1rem', marginBottom: 16 }}>No intraoperative record for this booking.</p>
        <button onClick={createRecord} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-plus-circle" /> Initialize Intraop Record
        </button>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '0.875rem' }}>
          <i className="bi bi-exclamation-triangle" /> {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Fluid Balance Summary */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 18, overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
            <i className="bi bi-droplet" style={{ color: '#6b7280', fontSize: 14 }} /> Fluid Balance
          </span>
          <button
            onClick={saveFluid} disabled={savingFluid}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}
          >
            <i className="bi bi-floppy" /> {savingFluid ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            ['iv_fluids_ml', 'IV Fluids', '#2563eb', '#dbeafe', 'bi-droplet-half'],
            ['blood_loss_ml', 'Estimated Blood Loss', '#dc2626', '#fee2e2', 'bi-droplet-fill'],
            ['urine_output_ml', 'Urine Output', '#0d9488', '#ccfbf1', 'bi-water'],
          ].map(([key, label, color, bg, icon]) => (
            <div key={key} style={{ background: bg, borderRadius: 10, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <i className={`bi ${icon}`} style={{ color, fontSize: 18 }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number" min="0" step="10"
                  value={fluid[key]}
                  onChange={e => setFluid(f => ({ ...f, [key]: e.target.value }))}
                  style={{ border: `1px solid ${color}30`, borderRadius: 6, padding: '8px 10px', fontSize: '1.1rem', fontWeight: 700, color, background: '#fff', width: '100%', textAlign: 'right' }}
                  placeholder="0"
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color, flexShrink: 0 }}>mL</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary section */}
      {(record.operative_findings || record.procedure_performed || record.wound_classification) && (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 18, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 7 }}>
            <i className="bi bi-clipboard-pulse" style={{ color: '#6b7280', fontSize: 14 }} /> Operative Summary
          </div>
          <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {record.operative_findings && (
              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Operative Findings</div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{record.operative_findings}</p>
              </div>
            )}
            {record.procedure_performed && (
              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Procedure Performed</div>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>{record.procedure_performed}</p>
              </div>
            )}
            {record.wound_classification && (
              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Wound Classification</div>
                <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '4px 12px', borderRadius: 9999, fontSize: '0.78rem', fontWeight: 700, textTransform: 'capitalize' }}>
                  {record.wound_classification?.replaceAll('_', ' ')}
                </span>
              </div>
            )}
            {(record.instrument_count !== undefined || record.sponge_count !== undefined || record.needle_count !== undefined) && (
              <div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Count Verification</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['Instruments', record.instrument_count], ['Sponges', record.sponge_count], ['Needles', record.needle_count]].map(([l, v]) => (
                    <span key={l} style={{ background: v === true || v === 'correct' ? '#d1fae5' : '#f1f5f9', color: v === true || v === 'correct' ? '#065f46' : '#475569', padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700 }}>
                      {l}: {v === true || v === 'correct' ? '✓' : v === false ? '✗' : v ?? '—'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Tables */}
      <VitalsTable vitals={vitals} onAdd={addVital} adding={adding} setAdding={setAdding} addLoading={addLoading} />
      <DrugLog drugs={drugs} onAdd={addDrug} adding={adding} setAdding={setAdding} addLoading={addLoading} />
      <BloodProducts products={bloodProducts} onAdd={addBlood} adding={adding} setAdding={setAdding} addLoading={addLoading} />
      <Specimens specimens={specimens} onAdd={addSpecimen} adding={adding} setAdding={setAdding} addLoading={addLoading} />
    </div>
  )
}
