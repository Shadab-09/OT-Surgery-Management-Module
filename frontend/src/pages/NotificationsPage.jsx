import { useEffect, useState } from 'react'
import { Notifications as API } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

export default function NotificationsPage() {
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ channel: '', status: '' })

  const load = async () => {
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    setRows((await API.list(params)).data.results || [])
  }
  useEffect(() => { load() }, [filters])

  return (
    <>
      <PageHeader title="Notifications" subtitle="SMS · App Push · Display · Audio delivery log" />

      <div className="card mb-4"><div className="card-body flex gap-2">
        <select value={filters.channel} onChange={e => setFilters(f => ({ ...f, channel: e.target.value }))}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }}>
          <option value="">All Channels</option>
          {['sms', 'app', 'email', 'display', 'audio'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }}>
          <option value="">All Statuses</option>
          {['queued', 'sent', 'failed'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div></div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Channel</th><th>Recipient</th><th>Message</th><th>Token</th><th>Status</th><th>Sent</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="text-muted" style={{ padding: 20, textAlign: 'center' }}>No notifications recorded.</td></tr>}
              {rows.map(n => (
                <tr key={n.id}>
                  <td><Badge>{n.channel}</Badge></td>
                  <td>{n.recipient || '—'}</td>
                  <td className="text-sm">{n.message}</td>
                  <td className="text-sm">{n.token_number || '—'}</td>
                  <td><Badge>{n.status}</Badge></td>
                  <td className="text-sm">{n.sent_at ? new Date(n.sent_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
