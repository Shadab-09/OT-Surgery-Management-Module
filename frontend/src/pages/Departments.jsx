import { useEffect, useState } from 'react'
import { BsPlusCircle, BsPencil, BsTrash } from 'react-icons/bs'
import { Departments as API } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

const blank = { name: '', code: '', description: '', is_active: true }

export default function DepartmentsPage() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)

  const load = async () => setRows((await API.list()).data.results || [])
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    if (form.id) await API.update(form.id, form)
    else await API.create(form)
    setForm(null); load()
  }
  const remove = async (id) => {
    if (!confirm('Delete this department?')) return
    await API.remove(id); load()
  }

  return (
    <>
      <PageHeader title="Departments" subtitle="Hospital departments that issue tokens"
        actions={<button className="btn btn-primary" onClick={() => setForm({ ...blank })}><BsPlusCircle /> Add Department</button>} />

      {form && (
        <div className="card mb-4">
          <div className="card-header">{form.id ? 'Edit Department' : 'New Department'}</div>
          <form onSubmit={save} className="card-body">
            <div className="grid grid-2">
              <div className="form-row"><label>Code *</label><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
              <div className="form-row"><label>Name *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            </div>
            <div className="form-row"><label>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <label className="flex gap-2"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
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
            <thead><tr><th>Code</th><th>Name</th><th>Services</th><th>Counters</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="font-bold">{r.code}</td>
                  <td>{r.name}</td>
                  <td>{r.service_count}</td>
                  <td>{r.counter_count}</td>
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
