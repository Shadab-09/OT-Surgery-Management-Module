import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Visits as API } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

export default function VisitsList() {
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('')

  const load = async () => {
    const params = { page_size: 100 }
    if (status) params.status = status
    setRows((await API.list(params)).data.results || [])
  }
  useEffect(() => { load() }, [status])

  return (
    <>
      <PageHeader title="Visits" subtitle="Clinical OPD encounters — vitals, diagnoses, prescriptions, ABDM sync" />
      <div className="card mb-4"><div className="card-body flex gap-2">
        <select value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="open">Open</option><option value="closed">Closed</option>
        </select>
      </div></div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Visit #</th><th>Patient</th><th>Doctor</th><th>Opened</th><th>Status</th><th>ABDM</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="font-bold">{r.visit_number}</td>
                  <td>{r.patient_name}<div className="text-sm" style={{ color: '#64748b' }}>{r.patient_mrn}</div></td>
                  <td>Dr. {r.doctor_name}</td>
                  <td className="text-sm">{new Date(r.opened_at).toLocaleString()}</td>
                  <td><Badge>{r.status}</Badge></td>
                  <td className="text-sm">
                    {r.abdm_synced_at
                      ? <span style={{ color: '#059669' }}>synced · {r.abdm_care_context_ref}</span>
                      : <span style={{ color: '#94a3b8' }}>not synced</span>}
                  </td>
                  <td><Link className="btn btn-sm btn-primary" to={`/visits/${r.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
