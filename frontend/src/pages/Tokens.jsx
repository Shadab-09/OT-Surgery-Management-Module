import { useEffect, useState } from 'react'
import { Tokens as API, Departments } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

function fmtSec(s) { if (s == null) return '—'; const m = Math.floor(s / 60), sec = s % 60; return m ? `${m}m ${sec}s` : `${sec}s` }
function fmt(dt) { return dt ? new Date(dt).toLocaleTimeString() : '—' }

export default function TokensPage() {
  const [tokens, setTokens] = useState([])
  const [departments, setDepartments] = useState([])
  const [filters, setFilters] = useState({ department: '', status: '', priority: '', search: '' })

  useEffect(() => { Departments.list().then(r => setDepartments(r.data.results || r.data)) }, [])

  const load = async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    const { data } = await API.list(params)
    setTokens(data.results || data)
  }
  useEffect(() => { load() }, [filters])

  return (
    <>
      <PageHeader title="Tokens" subtitle="All tokens issued today — filter, search, inspect." />

      <div className="card mb-4">
        <div className="card-body flex gap-2" style={{ flexWrap: 'wrap' }}>
          <input placeholder="Search token / patient / MRN" value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6, flex: 1, minWidth: 220 }} />
          <select value={filters.department} onChange={e => setFilters(f => ({ ...f, department: e.target.value }))}
            style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }}>
            <option value="">All Statuses</option>
            {['waiting', 'called', 'in_service', 'completed', 'skipped', 'no_show', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}
            style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }}>
            <option value="">All Priorities</option>
            {['normal', 'elderly', 'disabled', 'emergency'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="btn" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Token</th><th>Patient</th><th>Department</th><th>Service</th>
                <th>Channel</th><th>Priority</th><th>Status</th>
                <th>Issued</th><th>Called</th><th>Completed</th><th>TAT</th>
              </tr>
            </thead>
            <tbody>
              {tokens.length === 0 && <tr><td colSpan={11} className="text-muted" style={{ padding: 30, textAlign: 'center' }}>No tokens match these filters.</td></tr>}
              {tokens.map(t => (
                <tr key={t.id}>
                  <td className="font-bold">{t.number}</td>
                  <td>{t.patient_detail?.full_name || '—'}</td>
                  <td>{t.department_code}</td>
                  <td>{t.service_name}</td>
                  <td><Badge>{t.channel}</Badge></td>
                  <td><Badge>{t.priority}</Badge></td>
                  <td><Badge>{t.status}</Badge></td>
                  <td className="text-sm">{fmt(t.issued_at)}</td>
                  <td className="text-sm">{fmt(t.called_at)}</td>
                  <td className="text-sm">{fmt(t.completed_at)}</td>
                  <td className="text-sm">{fmtSec(t.tat_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
