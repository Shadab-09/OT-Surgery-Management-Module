import { useEffect, useState } from 'react'
import { Departments, Patients, Services, Tokens } from '../api/client'
import { LanguagePicker, useI18n } from '../i18n.jsx'

const GENDER_LABEL = { M: 'Male', F: 'Female', O: 'Other' }

export default function Kiosk() {
  const { t, lang } = useI18n()
  const [departments, setDepartments] = useState([])
  const [services, setServices] = useState([])
  const [form, setForm] = useState({
    department: '', service: '',
    patient_uhid: '', patient_name: '', patient_mrn: '', patient_phone: '',
    patient_age: '', patient_gender: '',
    patient_is_elderly: false, patient_is_disabled: false,
    channel: 'kiosk', priority: 'normal',
  })
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uhidLoading, setUhidLoading] = useState(false)
  const [uhidLocked, setUhidLocked] = useState(false)

  useEffect(() => { Departments.list({ is_active: true }).then(r => setDepartments(r.data.results || r.data)) }, [])
  useEffect(() => {
    if (!form.department) return setServices([])
    Services.list({ department: form.department, is_active: true })
      .then(r => setServices(r.data.results || r.data))
  }, [form.department])

  const update = (patch) => setForm(s => ({ ...s, ...patch }))

  const fetchUhid = async () => {
    const uhid = form.patient_uhid.trim()
    if (!uhid) return
    setError('')
    setUhidLoading(true)
    try {
      const { data } = await Patients.lookupUhid(uhid)
      const p = data.patient || {}
      update({
        patient_name: p.full_name || '',
        patient_mrn: data.uhid || uhid,
        patient_phone: p.phone || '',
        patient_age: p.age != null ? String(p.age) : '',
        patient_gender: p.gender || '',
        patient_is_elderly: (p.age || 0) >= 60,
      })
      setUhidLocked(true)
    } catch (e) {
      const msg = e.response?.data?.detail || t('ui.uhid_not_found', 'No patient found for this UHID.')
      setError(msg)
    } finally {
      setUhidLoading(false)
    }
  }

  const clearUhid = () => {
    setUhidLocked(false)
    update({
      patient_uhid: '', patient_name: '', patient_mrn: '',
      patient_phone: '', patient_age: '', patient_gender: '',
      patient_is_elderly: false,
    })
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data } = await Tokens.issue({ ...form, patient_language: lang })
      setTicket(data)
    } catch (e) {
      setError(e.response?.data?.detail || JSON.stringify(e.response?.data) || e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (ticket) {
    return (
      <div className="kiosk">
        <div className="kiosk-box">
          <div className="flex-between">
            <h1>✅ {t('ui.token_generated', 'Token Generated')}</h1>
            <LanguagePicker className="form-control" style={{ width: 180 }} />
          </div>
          <p className="text-muted">{t('ui.please_wait', 'Please keep this number and wait for your call.')}</p>
          <div className="kiosk-ticket">
            <p className="label">{t('ui.token_number', 'YOUR TOKEN')}</p>
            <p className="n">{ticket.number}</p>
            <p style={{ marginTop: 8, opacity: 0.9 }}>{ticket.department_name} · {ticket.service_name}</p>
            {ticket.patient_detail?.full_name && (
              <p style={{ marginTop: 6, fontSize: 14, opacity: 0.85 }}>
                {ticket.patient_detail.full_name}
                {ticket.patient_detail.mrn ? ` · ${ticket.patient_detail.mrn}` : ''}
              </p>
            )}
            <p style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>
              {t('ui.priority_queue', 'Priority')}: {(ticket.priority_label || ticket.priority).toUpperCase()}
            </p>
          </div>
          <button className="btn btn-primary mt-2" style={{ marginTop: 16, width: '100%', padding: 14 }}
            onClick={() => { setTicket(null); clearUhid() }}>
            {t('ui.issue_another', 'Issue another token')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="kiosk">
      <div className="kiosk-box">
        <div className="flex-between">
          <h1>🏥 {t('channel.kiosk', 'Self Check-In')}</h1>
          <LanguagePicker className="form-control" style={{ width: 180 }} />
        </div>
        <p className="text-muted">{t('ui.fill_details', 'Fill in your details to get a queue token.')}</p>
        <form onSubmit={submit} style={{ marginTop: 16 }}>
          {/* UHID lookup — pulls identity from MedVantage HMIS */}
          <div className="form-row">
            <label>{t('ui.uhid', 'UHID')}</label>
            <div className="flex gap-2">
              <input
                placeholder="UHID03121"
                value={form.patient_uhid}
                onChange={e => update({ patient_uhid: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchUhid() } }}
                disabled={uhidLocked}
                style={{ flex: 1 }}
              />
              {uhidLocked ? (
                <button type="button" className="btn" onClick={clearUhid}>✕</button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={fetchUhid} disabled={uhidLoading || !form.patient_uhid}>
                  {uhidLoading ? '…' : t('ui.fetch', 'Fetch')}
                </button>
              )}
            </div>
          </div>

          {uhidLocked && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              <div className="text-sm" style={{ color: '#065f46', fontWeight: 600, marginBottom: 6 }}>
                ✓ {form.patient_name}
              </div>
              <div className="flex gap-3 text-sm" style={{ color: '#065f46' }}>
                <span>{t('ui.age', 'Age')}: <b>{form.patient_age || '—'}</b></span>
                <span>{t('ui.gender', 'Gender')}: <b>{GENDER_LABEL[form.patient_gender] || form.patient_gender || '—'}</b></span>
                {form.patient_phone && <span>{t('ui.phone', 'Phone')}: <b>{form.patient_phone}</b></span>}
              </div>
            </div>
          )}

          <div className="form-row">
            <label>{t('ui.department', 'Department')} *</label>
            <select required value={form.department} onChange={e => update({ department: e.target.value, service: '' })}>
              <option value="">…</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.code} – {d.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>{t('ui.service', 'Service')} *</label>
            <select required value={form.service} onChange={e => update({ service: e.target.value })} disabled={!form.department}>
              <option value="">…</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name} (~{s.avg_service_minutes}m)</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>{t('ui.full_name', 'Full Name')} *</label>
            <input required value={form.patient_name} onChange={e => update({ patient_name: e.target.value })} disabled={uhidLocked} />
          </div>
          <div className="flex gap-2">
            <div className="form-row" style={{ flex: 1 }}>
              <label>{t('ui.mrn', 'MRN')}</label>
              <input value={form.patient_mrn} onChange={e => update({ patient_mrn: e.target.value })} disabled={uhidLocked} />
            </div>
            <div className="form-row" style={{ flex: 1 }}>
              <label>{t('ui.phone', 'Phone')}</label>
              <input value={form.patient_phone} onChange={e => update({ patient_phone: e.target.value })} disabled={uhidLocked} />
            </div>
          </div>
          <div className="flex gap-3 mb-3">
            <label className="flex gap-2"><input type="checkbox" checked={form.patient_is_elderly} onChange={e => update({ patient_is_elderly: e.target.checked })} /> {t('priority.elderly', 'Elderly')}</label>
            <label className="flex gap-2"><input type="checkbox" checked={form.patient_is_disabled} onChange={e => update({ patient_is_disabled: e.target.checked })} /> {t('priority.disabled', 'Disabled')}</label>
            <label className="flex gap-2"><input type="radio" name="pri" checked={form.priority === 'emergency'} onChange={() => update({ priority: 'emergency' })} /> {t('priority.emergency', 'Emergency')}</label>
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: 12 }}>{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', padding: 14, fontSize: 16 }}>
            {submitting ? '…' : t('ui.generate_token', 'Generate Token')}
          </button>
        </form>
      </div>
    </div>
  )
}
