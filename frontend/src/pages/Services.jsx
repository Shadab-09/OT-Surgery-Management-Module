import { useEffect, useState } from 'react'
import { BsPlusCircle, BsPencil, BsTrash } from 'react-icons/bs'
import { Services as API, Departments } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

const blank = { name: '', code: '', department: '', avg_service_minutes: 10, priority_enabled: true, is_active: true }

export default function ServicesPage() {
  const [rows, setRows] = useState([])
  const [departments, setDepartments] = useState([])
  const [form, setForm] = useState(null)
  const [dept, setDept] = useState('')

  const load = async () => {
    const params = dept ? { department: dept } : {}
    setRows((await API.list(params)).data.results || [])
  }
  useEffect(() => { Departments.list().then(r => setDepartments(r.data.results || r.data)) }, [])
  useEffect(() => { load() }, [dept])

  const save = async (e) => {
    e.preventDefault()
    const payload = { ...form, avg_service_minutes: +form.avg_service_minutes }
    if (form.id) await API.update(form.id, payload)
    else await API.create(payload)
    setForm(null); load()
  }
  const remove = async (id) => { if (confirm('Delete service?')) { await API.remove(id); load() } }

  return (
    <>
      <PageHeader title="Services" subtitle="Services offered at each department"
        actions={<button className="btn btn-primary" onClick={() => setForm({ ...blank })}><BsPlusCircle /> Add Service</button>} />

      <div className="card mb-4"><div className="card-body">
        <div className="form-row" style={{ maxWidth: 300 }}>
          <label>Filter by Department</label>
          <select value={dept} onChange={e => setDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div></div>

      {form && (
        <div className="card mb-4">
          <div className="card-header">{form.id ? 'Edit Service' : 'New Service'}</div>
          <form onSubmit={save} className="card-body">
            <div className="grid grid-2">
              <div className="form-row"><label>Department *</label>
                <select required value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}>
                  <option value="">Select…</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Code *</label><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div className="form-row"><label>Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="form-row"><label>Avg Service Minutes *</label><input type="number" min="1" required value={form.avg_service_minutes} onChange={e => setForm({ ...form, avg_service_minutes: e.target.value })} /></div>
            </div>
            <div className="flex gap-3">
              <label className="flex gap-2"><input type="checkbox" checked={form.priority_enabled} onChange={e => setForm({ ...form, priority_enabled: e.target.checked })} /> Priority Enabled</label>
              <label className="flex gap-2"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
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
            <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Avg Time</th><th>Priority</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="font-bold">{r.code}</td>
                  <td>{r.name}</td>
                  <td>{r.department_name}</td>
                  <td>{r.avg_service_minutes}m</td>
                  <td><Badge>{r.priority_enabled ? 'available' : 'closed'}</Badge></td>
                  <td><Badge>{r.is_active ? 'available' : 'closed'}</Badge></td>
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
