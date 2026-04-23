import { useEffect, useMemo, useState } from 'react'
import { BsPlusCircle, BsCheck2Circle, BsXCircle, BsPlayFill } from 'react-icons/bs'
import { Appointments as API, Doctors, Patients, Visits } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'
import { useNavigate } from 'react-router-dom'

export default function AppointmentsPage() {
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [form, setForm] = useState(null)
  const [filter, setFilter] = useState({ status: '', doctor: '', date: 'today' })

  const load = async () => {
    const params = { page_size: 100 }
    if (filter.status) params.status = filter.status
    if (filter.doctor) params.doctor = filter.doctor
    const r = filter.date === 'today' ? await API.today() : await API.list(params)
    setRows(filter.date === 'today' ? r.data : (r.data.results || []))
  }
  useEffect(() => {
    load()
    Doctors.list({ page_size: 100 }).then(r => setDoctors(r.data.results || []))
    Patients.list({ page_size: 200 }).then(r => setPatients(r.data.results || []))
  }, [filter.status, filter.doctor, filter.date])

  const book = async (e) => {
    e.preventDefault()
    try {
      await API.book(form)
      setForm(null); load()
    } catch (err) {
      alert(err.response?.data?.detail || 'Booking failed')
    }
  }

  const checkIn = async (id) => { await API.checkIn(id); load() }
  const cancel = async (id) => { if (confirm('Cancel appointment?')) { await API.cancel(id); load() } }
  const startConsultation = async (appt) => {
    const r = await Visits.start({ appointment: appt.id })
    nav(`/visits/${r.data.id}`)
  }

  const blank = useMemo(() => ({
    patient: patients[0]?.id || '',
    doctor: doctors[0]?.id || '',
    scheduled_at: new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16),
    reason: '', type: 'new', booked_via: 'counter',
  }), [patients, doctors])

  return (
    <>
      <PageHeader title="Appointments" subtitle="OPD appointments — book, check-in and start consultation"
        actions={<button className="btn btn-primary" onClick={() => setForm({ ...blank })}><BsPlusCircle /> Book Appointment</button>} />

      <div className="card mb-4"><div className="card-body flex gap-2">
        <select value={filter.date} onChange={e => setFilter({ ...filter, date: e.target.value })}>
          <option value="today">Today</option><option value="all">All dates</option>
        </select>
        <select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All statuses</option><option value="scheduled">Scheduled</option>
          <option value="checked_in">Checked-in</option><option value="in_consultation">In Consultation</option>
          <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
        <select value={filter.doctor} onChange={e => setFilter({ ...filter, doctor: e.target.value })}>
          <option value="">All doctors</option>
          {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>)}
        </select>
      </div></div>

      {form && (
        <div className="card mb-4">
          <div className="card-header">Book Appointment</div>
          <form onSubmit={book} className="card-body">
            <div className="grid grid-2">
              <div className="form-row"><label>Patient *</label>
                <select required value={form.patient} onChange={e => setForm({ ...form, patient: Number(e.target.value) })}>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.mrn} — {p.full_name}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Doctor *</label>
                <select required value={form.doctor} onChange={e => setForm({ ...form, doctor: Number(e.target.value) })}>
                  {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name} ({d.specialisation || d.department_code})</option>)}
                </select>
              </div>
              <div className="form-row"><label>Scheduled At *</label>
                <input required type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>
              <div className="form-row"><label>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="new">New</option><option value="followup">Follow-up</option>
                </select>
              </div>
              <div className="form-row" style={{ gridColumn: 'span 2' }}><label>Reason</label>
                <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Chief complaint" />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn btn-primary">Book</button>
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Type</th><th>Status</th><th>Reason</th><th>Token</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="text-sm">{new Date(r.scheduled_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                  <td>{r.patient_name}<div className="text-sm" style={{ color: '#64748b' }}>{r.patient_mrn}</div></td>
                  <td>Dr. {r.doctor_name}</td>
                  <td>{r.type}</td>
                  <td><Badge>{r.status}</Badge></td>
                  <td className="text-sm">{r.reason || '—'}</td>
                  <td className="text-sm">{r.token_id ? `#${r.token_id}` : '—'}</td>
                  <td className="flex gap-2">
                    {r.status === 'scheduled' && <button className="btn btn-sm" onClick={() => checkIn(r.id)} title="Check-in"><BsCheck2Circle /></button>}
                    {(r.status === 'checked_in' || r.status === 'scheduled') && <button className="btn btn-sm btn-primary" onClick={() => startConsultation(r)} title="Start consultation"><BsPlayFill /></button>}
                    {r.status !== 'completed' && r.status !== 'cancelled' &&
                      <button className="btn btn-sm btn-danger" onClick={() => cancel(r.id)}><BsXCircle /></button>}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="text-center" style={{ padding: 20, color: '#64748b' }}>No appointments.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
