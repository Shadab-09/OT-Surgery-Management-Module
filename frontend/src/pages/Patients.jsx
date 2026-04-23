import { useEffect, useState } from 'react'
import { BsPlusCircle, BsPencil, BsTrash } from 'react-icons/bs'
import { Patients as API } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

const blank = { mrn: '', full_name: '', phone: '', email: '', date_of_birth: '', gender: '', is_elderly: false, is_disabled: false, preferred_language: 'en' }

export default function PatientsPage() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)
  const [search, setSearch] = useState('')

  const load = async () => setRows((await API.list(search ? { search } : {})).data.results || [])
  useEffect(() => { load() }, [search])

  const save = async (e) => {
    e.preventDefault()
    const payload = { ...form }
    if (!payload.date_of_birth) delete payload.date_of_birth
    if (form.id) await API.update(form.id, payload); else await API.create(payload)
    setForm(null); load()
  }
  const remove = async (id) => { if (confirm('Delete patient?')) { await API.remove(id); load() } }

  return (
    <>
      <PageHeader title="Patients" subtitle="Registered patients — priority is derived from flags below"
        actions={<button className="btn btn-primary" onClick={() => setForm({ ...blank })}><BsPlusCircle /> Add Patient</button>} />

      <div className="card mb-4"><div className="card-body">
        <input placeholder="Search MRN / name / phone" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, width: '100%', maxWidth: 400 }} />
      </div></div>

      {form && (
        <div className="card mb-4">
          <div className="card-header">{form.id ? 'Edit Patient' : 'New Patient'}</div>
          <form onSubmit={save} className="card-body">
            <div className="grid grid-2">
              <div className="form-row"><label>MRN *</label><input required value={form.mrn} onChange={e => setForm({ ...form, mrn: e.target.value })} /></div>
              <div className="form-row"><label>Full Name *</label><input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="form-row"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="form-row"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div className="form-row"><label>Date of Birth</label><input type="date" value={form.date_of_birth || ''} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></div>
              <div className="form-row"><label>Gender</label>
                <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                  <option value="">—</option><option value="M">Male</option><option value="F">Female</option><option value="O">Other</option>
                </select>
              </div>
              <div className="form-row"><label>Language</label><input value={form.preferred_language} onChange={e => setForm({ ...form, preferred_language: e.target.value })} /></div>
            </div>
            <div className="flex gap-3">
              <label className="flex gap-2"><input type="checkbox" checked={form.is_elderly} onChange={e => setForm({ ...form, is_elderly: e.target.checked })} /> Elderly (priority)</label>
              <label className="flex gap-2"><input type="checkbox" checked={form.is_disabled} onChange={e => setForm({ ...form, is_disabled: e.target.checked })} /> Disabled (priority)</label>
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
            <thead><tr><th>MRN</th><th>Name</th><th>Phone</th><th>Gender</th><th>DOB</th><th>Priority</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="font-bold">{r.mrn}</td>
                  <td>{r.full_name}</td>
                  <td>{r.phone || '—'}</td>
                  <td>{r.gender || '—'}</td>
                  <td className="text-sm">{r.date_of_birth || '—'}</td>
                  <td><Badge>{r.priority}</Badge></td>
                  <td className="flex gap-2">
                    <button className="btn btn-sm" onClick={() => setForm(r)}><BsPencil /></button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(r.id)}><BsTrash /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
