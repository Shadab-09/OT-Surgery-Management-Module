import { useEffect, useState } from 'react'
import { BsPlusCircle, BsPencil, BsTrash } from 'react-icons/bs'
import { Counters as API, Departments, Services } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

const blank = { name: '', code: '', department: '', services: [], status: 'available', location: '' }

export default function CountersPage() {
  const [rows, setRows] = useState([])
  const [departments, setDepartments] = useState([])
  const [services, setServices] = useState([])
  const [form, setForm] = useState(null)

  const load = async () => setRows((await API.list()).data.results || [])
  useEffect(() => { Departments.list().then(r => setDepartments(r.data.results || r.data)); load() }, [])
  useEffect(() => {
    if (!form?.department) return setServices([])
    Services.list({ department: form.department }).then(r => setServices(r.data.results || r.data))
  }, [form?.department])

  const save = async (e) => {
    e.preventDefault()
    if (form.id) await API.update(form.id, form)
    else await API.create(form)
    setForm(null); load()
  }
  const remove = async (id) => { if (confirm('Delete counter?')) { await API.remove(id); load() } }

  const toggleService = (id) => setForm(f => ({
    ...f, services: f.services.includes(id) ? f.services.filter(s => s !== id) : [...f.services, id],
  }))

  return (
    <>
      <PageHeader title="Counters" subtitle="Service counters / desks per department"
        actions={<button className="btn btn-primary" onClick={() => setForm({ ...blank })}><BsPlusCircle /> Add Counter</button>} />

      {form && (
        <div className="card mb-4">
          <div className="card-header">{form.id ? 'Edit Counter' : 'New Counter'}</div>
          <form onSubmit={save} className="card-body">
            <div className="grid grid-2">
              <div className="form-row"><label>Department *</label>
                <select required value={form.department} onChange={e => setForm({ ...form, department: e.target.value, services: [] })}>
                  <option value="">Select…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Code *</label><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div className="form-row"><label>Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-row"><label>Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
              <div className="form-row"><label>Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {['available', 'busy', 'paused', 'closed'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {services.length > 0 && (
              <div className="form-row">
                <label>Services this counter handles</label>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {services.map(s => (
                    <label key={s.id} className="flex gap-2"
                      style={{ padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.services.includes(s.id)} onChange={() => toggleService(s.id)} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
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
            <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Services</th><th>Status</th><th>Location</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="font-bold">{r.code}</td>
                  <td>{r.name}</td>
                  <td>{r.department_name}</td>
                  <td className="text-sm">{r.service_names.join(', ') || '—'}</td>
                  <td><Badge>{r.status}</Badge></td>
                  <td className="text-sm">{r.location || '—'}</td>
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
