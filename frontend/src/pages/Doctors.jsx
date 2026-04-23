import { useEffect, useState } from 'react'
import { BsPlusCircle, BsPencil, BsTrash, BsCalendarWeek } from 'react-icons/bs'
import { Doctors as API, Departments, Schedules } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

const blank = {
  full_name: '', registration_number: '', specialisation: '', qualifications: '',
  phone: '', email: '', abha_address: '', hpr_id: '',
  consultation_fee: 0, avg_consult_minutes: 15, department: '', is_active: true,
}

const DAY_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function DoctorsPage() {
  const [rows, setRows] = useState([])
  const [depts, setDepts] = useState([])
  const [form, setForm] = useState(null)
  const [slotsFor, setSlotsFor] = useState(null) // {doctor, date, slots:[]}
  const [slotDate, setSlotDate] = useState(new Date().toISOString().slice(0, 10))

  const load = async () => setRows((await API.list({ page_size: 100 })).data.results || [])
  useEffect(() => { load(); Departments.list().then(r => setDepts(r.data.results || [])) }, [])

  const save = async (e) => {
    e.preventDefault()
    const payload = { ...form, consultation_fee: Number(form.consultation_fee) }
    if (form.id) await API.update(form.id, payload); else await API.create(payload)
    setForm(null); load()
  }
  const remove = async (id) => { if (confirm('Delete doctor?')) { await API.remove(id); load() } }

  const viewSlots = async (doc) => {
    const r = await API.slots(doc.id, slotDate)
    setSlotsFor({ ...r.data, doctor_id: doc.id, doctor_name: doc.full_name })
  }

  return (
    <>
      <PageHeader title="Doctors" subtitle="OPD physicians, schedules and available slots"
        actions={<button className="btn btn-primary" onClick={() => setForm({ ...blank, department: depts[0]?.id })}><BsPlusCircle /> Add Doctor</button>} />

      {form && (
        <div className="card mb-4">
          <div className="card-header">{form.id ? 'Edit Doctor' : 'New Doctor'}</div>
          <form onSubmit={save} className="card-body">
            <div className="grid grid-2">
              <div className="form-row"><label>Full Name *</label><input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="form-row"><label>Registration # *</label><input required value={form.registration_number} onChange={e => setForm({ ...form, registration_number: e.target.value })} /></div>
              <div className="form-row"><label>Department *</label>
                <select required value={form.department} onChange={e => setForm({ ...form, department: Number(e.target.value) })}>
                  <option value="">—</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Specialisation</label><input value={form.specialisation} onChange={e => setForm({ ...form, specialisation: e.target.value })} /></div>
              <div className="form-row"><label>Qualifications</label><input value={form.qualifications} onChange={e => setForm({ ...form, qualifications: e.target.value })} /></div>
              <div className="form-row"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="form-row"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="form-row"><label>ABHA address</label><input placeholder="drname@abdm" value={form.abha_address} onChange={e => setForm({ ...form, abha_address: e.target.value })} /></div>
              <div className="form-row"><label>HPR ID</label><input value={form.hpr_id} onChange={e => setForm({ ...form, hpr_id: e.target.value })} /></div>
              <div className="form-row"><label>Consult fee</label><input type="number" value={form.consultation_fee} onChange={e => setForm({ ...form, consultation_fee: e.target.value })} /></div>
              <div className="form-row"><label>Avg consult min.</label><input type="number" value={form.avg_consult_minutes} onChange={e => setForm({ ...form, avg_consult_minutes: Number(e.target.value) })} /></div>
            </div>
            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn btn-primary">Save</button>
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Name</th><th>Dept</th><th>Specialisation</th><th>Reg #</th><th>ABHA</th><th>Schedule</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="font-bold">Dr. {r.full_name}</td>
                  <td><Badge>{r.department_code}</Badge></td>
                  <td>{r.specialisation || '—'}</td>
                  <td className="text-sm">{r.registration_number}</td>
                  <td className="text-sm">{r.abha_address || '—'}</td>
                  <td className="text-sm">
                    {r.schedules?.length
                      ? r.schedules.map(s => `${DAY_LABEL[s.weekday]} ${s.start_time.slice(0,5)}`).join(', ')
                      : <span style={{ color: '#94a3b8' }}>none</span>}
                  </td>
                  <td className="flex gap-2">
                    <button className="btn btn-sm" onClick={() => viewSlots(r)} title="View slots"><BsCalendarWeek /></button>
                    <button className="btn btn-sm" onClick={() => setForm(r)}><BsPencil /></button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(r.id)}><BsTrash /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {slotsFor && (
        <div className="card mt-4">
          <div className="card-header">
            <span>Slots — Dr. {slotsFor.doctor_name}</span>
            <div className="flex gap-2">
              <input type="date" value={slotDate} onChange={e => setSlotDate(e.target.value)} />
              <button className="btn btn-sm" onClick={() => API.slots(slotsFor.doctor_id, slotDate).then(r => setSlotsFor({ ...r.data, doctor_id: slotsFor.doctor_id, doctor_name: slotsFor.doctor_name }))}>Refresh</button>
              <button className="btn btn-sm" onClick={() => setSlotsFor(null)}>Close</button>
            </div>
          </div>
          <div className="card-body">
            {slotsFor.slots.length === 0 ? <p style={{ color: '#64748b' }}>No schedule on {slotsFor.date}.</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                {slotsFor.slots.map(s => (
                  <div key={s.start}
                       style={{ padding: 8, border: '1px solid #e2e8f0', borderRadius: 6,
                                background: s.available ? '#ecfdf5' : '#fee2e2',
                                color: s.available ? '#065f46' : '#991b1b', fontSize: 12 }}>
                    {new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    <div style={{ fontSize: 11 }}>{s.available ? 'free' : 'booked'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
