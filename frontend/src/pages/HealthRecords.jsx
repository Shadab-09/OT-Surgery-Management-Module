import { useEffect, useState } from 'react'
import { HealthRecords as API, ABDMTransactions } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

export default function HealthRecordsPage() {
  const [records, setRecords] = useState([])
  const [txns, setTxns] = useState([])
  const [tab, setTab] = useState('records')
  const [detail, setDetail] = useState(null)

  const load = async () => {
    setRecords((await API.list({ page_size: 100 })).data.results || [])
    setTxns((await ABDMTransactions.list({ page_size: 100 })).data.results || [])
  }
  useEffect(() => { load() }, [])

  return (
    <>
      <PageHeader title="Health Records & ABDM Audit"
        subtitle="FHIR bundles sent to Eka Care and every gateway API call"
        actions={<button className="btn" onClick={load}>Refresh</button>}
      />
      <div className="flex gap-2 mb-4">
        <button className={`btn ${tab === 'records' ? 'btn-primary' : ''}`} onClick={() => setTab('records')}>Health Records ({records.length})</button>
        <button className={`btn ${tab === 'txns' ? 'btn-primary' : ''}`} onClick={() => setTab('txns')}>Eka Care Transactions ({txns.length})</button>
      </div>

      {tab === 'records' && (
        <div className="card"><div className="card-body" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>#</th><th>Patient</th><th>Type</th><th>Care Context</th><th>Status</th><th>Eka Request ID</th><th>Sent</th><th></th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.patient_name}</td>
                  <td>{r.record_type}</td>
                  <td className="text-sm">{r.care_context_ref || '—'}</td>
                  <td><Badge>{r.status === 'acked' ? 'completed' : r.status === 'failed' ? 'cancelled' : 'called'}</Badge></td>
                  <td className="text-sm">{r.eka_request_id || '—'}</td>
                  <td className="text-sm">{r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}</td>
                  <td><button className="btn btn-sm" onClick={() => setDetail({ kind: 'record', data: r })}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {tab === 'txns' && (
        <div className="card"><div className="card-body" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>When</th><th>Kind</th><th>Endpoint</th><th>HTTP</th><th>OK</th><th>Request ID</th><th></th></tr></thead>
            <tbody>
              {txns.map(t => (
                <tr key={t.id}>
                  <td className="text-sm">{new Date(t.created_at).toLocaleString()}</td>
                  <td>{t.kind}</td>
                  <td className="text-sm" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.endpoint}</td>
                  <td>{t.http_status ?? '—'}</td>
                  <td>{t.ok ? '✓' : '✗'}</td>
                  <td className="text-sm">{t.request_id || '—'}</td>
                  <td><button className="btn btn-sm" onClick={() => setDetail({ kind: 'txn', data: t })}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {detail && (
        <div className="card mt-4">
          <div className="card-header flex-between">
            <span>{detail.kind === 'record' ? `Health Record #${detail.data.id}` : `Transaction #${detail.data.id}`}</span>
            <button className="btn btn-sm" onClick={() => setDetail(null)}>Close</button>
          </div>
          <div className="card-body">
            <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 8, overflow: 'auto', maxHeight: 480 }}>
              {JSON.stringify(detail.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  )
}
