import { useState, useEffect } from 'react'
import api from '../../api/client'

const BILL_COMPONENTS = [
  { key: 'ot_charges', label: 'OT Charges' },
  { key: 'surgeon_fee', label: 'Surgeon Fee' },
  { key: 'anaesthesia_fee', label: 'Anaesthesia Fee' },
  { key: 'assistant_surgeon_fee', label: 'Assistant Surgeon Fee' },
  { key: 'nursing_charges', label: 'Nursing Charges' },
  { key: 'supplies_consumables', label: 'Supplies & Consumables' },
  { key: 'implant_charges', label: 'Implant Charges' },
  { key: 'blood_product_charges', label: 'Blood Product Charges' },
  { key: 'other_charges', label: 'Other Charges' },
]

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: '#64748b', bg: '#f1f5f9' },
  finalized: { label: 'Finalized', color: '#10b981', bg: '#dcfce7' },
  submitted: { label: 'Submitted', color: '#3b82f6', bg: '#dbeafe' },
  paid: { label: 'Paid', color: '#065f46', bg: '#a7f3d0' },
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
  padding: '8px 16px',
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
  padding: '6px 10px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
  textAlign: 'right',
}

function fmt(val) {
  const n = parseFloat(val) || 0
  return `₹${n.toFixed(2)}`
}

export default function OTBilling({ bookingId, bill: initialBill, onUpdate }) {
  const [bill, setBill] = useState(initialBill || null)
  const [charges, setCharges] = useState({})
  const [notes, setNotes] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    setBill(initialBill || null)
    if (initialBill) {
      const c = {}
      BILL_COMPONENTS.forEach(comp => {
        c[comp.key] = initialBill[comp.key] ?? ''
      })
      setCharges(c)
      setNotes(initialBill.billing_notes || '')
    }
  }, [initialBill])

  const generateBill = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await api.post('/ot/bills/', { booking: bookingId })
      setBill(res.data)
      const c = {}
      BILL_COMPONENTS.forEach(comp => { c[comp.key] = res.data[comp.key] ?? '' })
      setCharges(c)
      setNotes(res.data.billing_notes || '')
      // Auto recalculate
      const recalcRes = await api.post(`/ot/bills/${res.data.id}/recalculate/`)
      setBill(recalcRes.data)
      const c2 = {}
      BILL_COMPONENTS.forEach(comp => { c2[comp.key] = recalcRes.data[comp.key] ?? '' })
      setCharges(c2)
      onUpdate && onUpdate(recalcRes.data)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to generate bill')
    } finally {
      setGenerating(false)
    }
  }

  const saveChanges = async () => {
    if (!bill) return
    setSaving(true)
    setError('')
    setSuccessMsg('')
    try {
      const payload = { billing_notes: notes }
      BILL_COMPONENTS.forEach(comp => {
        if (charges[comp.key] !== '') payload[comp.key] = parseFloat(charges[comp.key]) || 0
      })
      const res = await api.patch(`/ot/bills/${bill.id}/`, payload)
      setBill(res.data)
      const c = {}
      BILL_COMPONENTS.forEach(comp => { c[comp.key] = res.data[comp.key] ?? '' })
      setCharges(c)
      setSuccessMsg('Changes saved successfully')
      onUpdate && onUpdate(res.data)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const recalculate = async () => {
    if (!bill) return
    setRecalculating(true)
    setError('')
    try {
      const res = await api.post(`/ot/bills/${bill.id}/recalculate/`)
      setBill(res.data)
      const c = {}
      BILL_COMPONENTS.forEach(comp => { c[comp.key] = res.data[comp.key] ?? '' })
      setCharges(c)
      setSuccessMsg('Bill recalculated from latest data')
      onUpdate && onUpdate(res.data)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Recalculation failed')
    } finally {
      setRecalculating(false)
    }
  }

  const finalize = async () => {
    if (!bill) return
    setFinalizing(true)
    setError('')
    try {
      const res = await api.post(`/ot/bills/${bill.id}/finalize/`)
      setBill(res.data)
      setShowFinalizeConfirm(false)
      setSuccessMsg('Bill finalized successfully')
      onUpdate && onUpdate(res.data)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to finalize bill')
    } finally {
      setFinalizing(false)
    }
  }

  const isDraft = !bill || bill.status === 'draft'
  const statusCfg = bill ? (STATUS_CONFIG[bill.status] || STATUS_CONFIG.draft) : null

  const total = BILL_COMPONENTS.reduce((sum, comp) => {
    const val = bill ? parseFloat(bill[comp.key]) || 0 : 0
    return sum + val
  }, 0)

  const editTotal = BILL_COMPONENTS.reduce((sum, comp) => {
    return sum + (parseFloat(charges[comp.key]) || 0)
  }, 0)

  if (!bill) {
    return (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>OT Billing</h2>
        </div>
        <div style={{ ...sectionStyle, textAlign: 'center', padding: 64 }}>
          <i className="bi bi-receipt" style={{ fontSize: 48, color: '#94a3b8' }} />
          <div style={{ marginTop: 16, fontSize: 18, fontWeight: 600, color: '#64748b' }}>No Bill Generated</div>
          <div style={{ color: '#94a3b8', marginTop: 6, marginBottom: 24, fontSize: 14 }}>
            Generate a bill to calculate OT charges for this booking
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button style={btnStyle('#6366f1')} onClick={generateBill} disabled={generating}>
            {generating ? 'Generating...' : <><i className="bi bi-file-earmark-plus" /> Generate Bill</>}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>OT Billing</h2>
          <span style={{ background: statusCfg.bg, color: statusCfg.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
            {statusCfg.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={recalculate} disabled={recalculating}
            style={btnStyle('#f0f9ff', '#0ea5e9')}>
            <i className="bi bi-arrow-clockwise" />
            {recalculating ? 'Recalculating...' : 'Recalculate from Data'}
          </button>
          {isDraft && (
            <>
              <button onClick={saveChanges} disabled={saving} style={btnStyle('#6366f1')}>
                <i className="bi bi-floppy" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => setShowFinalizeConfirm(true)} style={btnStyle('#10b981')}>
                <i className="bi bi-check2-all" /> Finalize Bill
              </button>
            </>
          )}
        </div>
      </div>

      {successMsg && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', color: '#16a34a', marginBottom: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-check-circle" /> {successMsg}
        </div>
      )}
      {error && (
        <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#ef4444', marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Bill Breakdown */}
      <div style={sectionStyle}>
        <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 16, fontSize: 15 }}>Bill Breakdown</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 12, borderBottom: '1px solid #e2e8f0', borderRadius: '8px 0 0 0' }}>Component</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#64748b', fontSize: 12, borderBottom: '1px solid #e2e8f0', borderRadius: '0 8px 0 0', width: 180 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {BILL_COMPONENTS.map((comp, idx) => {
              const isAutoCalc = ['implant_charges', 'blood_product_charges'].includes(comp.key)
              return (
                <tr key={comp.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>
                    <span>{comp.label}</span>
                    {isAutoCalc && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: '#6366f1', background: '#f0f0ff', borderRadius: 4, padding: '1px 6px' }}>
                        auto
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                    {isDraft && !isAutoCalc ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={charges[comp.key]}
                        onChange={e => setCharges(p => ({ ...p, [comp.key]: e.target.value }))}
                        style={{ ...inputStyle, width: 130 }}
                      />
                    ) : (
                      <span style={{ fontWeight: 500, color: '#1e293b' }}>{fmt(bill[comp.key])}</span>
                    )}
                  </td>
                </tr>
              )
            })}
            <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <td style={{ padding: '14px', fontWeight: 700, fontSize: 16, color: '#1e293b' }}>TOTAL</td>
              <td style={{ padding: '14px', textAlign: 'right', fontWeight: 800, fontSize: 18, color: '#6366f1' }}>
                {isDraft ? fmt(editTotal) : fmt(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Billing Notes */}
      <div style={sectionStyle}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 14, color: '#1e293b', marginBottom: 8 }}>Billing Notes</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          disabled={!isDraft}
          rows={3}
          placeholder="Additional billing notes or remarks..."
          style={{
            border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px',
            fontSize: 14, width: '100%', outline: 'none', boxSizing: 'border-box',
            resize: 'vertical', background: isDraft ? '#fff' : '#f8fafc', color: '#374151',
          }}
        />
      </div>

      {/* Bill Meta */}
      {bill && (
        <div style={{ ...sectionStyle, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {bill.created_at && (
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Generated</div>
              <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{new Date(bill.created_at).toLocaleString('en-IN')}</div>
            </div>
          )}
          {bill.finalized_at && (
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Finalized</div>
              <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{new Date(bill.finalized_at).toLocaleString('en-IN')}</div>
            </div>
          )}
          {bill.bill_number && (
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>Bill No.</div>
              <div style={{ fontSize: 13, color: '#374151', fontFamily: 'monospace', marginTop: 2 }}>{bill.bill_number}</div>
            </div>
          )}
        </div>
      )}

      {/* Finalize Confirm Modal */}
      {showFinalizeConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, maxWidth: 400, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <i className="bi bi-check2-all" style={{ fontSize: 24, color: '#10b981' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Finalize Bill</h3>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 8px' }}>
              Total Amount: <strong style={{ color: '#1e293b', fontSize: 16 }}>{fmt(editTotal || total)}</strong>
            </p>
            <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 24px' }}>
              Once finalized, the bill charges cannot be edited. Are you sure?
            </p>
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={finalize} disabled={finalizing}
                style={{ ...btnStyle('#10b981'), flex: 1, justifyContent: 'center' }}>
                {finalizing ? 'Finalizing...' : 'Yes, Finalize'}
              </button>
              <button onClick={() => setShowFinalizeConfirm(false)}
                style={{ ...btnStyle('#f1f5f9', '#374151'), flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
