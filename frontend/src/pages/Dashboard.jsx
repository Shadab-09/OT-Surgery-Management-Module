import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BsTicketPerforated, BsClockHistory, BsCheckCircle, BsExclamationTriangle, BsPlusCircle } from 'react-icons/bs'
import { Analytics, Tokens } from '../api/client'
import PageHeader from '../components/PageHeader'
import Stat from '../components/Stat'
import Badge from '../components/Badge'

function fmtSec(s) {
  if (!s) return '—'
  const m = Math.floor(s / 60), sec = s % 60
  return m ? `${m}m ${sec}s` : `${sec}s`
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null)
  const [live, setLive] = useState(null)

  const load = async () => {
    const [o, l] = await Promise.all([Analytics.overview(), Tokens.live()])
    setOverview(o.data)
    setLive(l.data)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [])

  if (!overview || !live) return <p>Loading…</p>
  const T = overview.totals, A = overview.averages

  return (
    <>
      <PageHeader
        title="Queue Dashboard"
        subtitle={`Live KPIs for ${overview.date} · refreshes every 8s`}
        actions={<Link to="/kiosk" className="btn btn-primary"><BsPlusCircle /> New Token</Link>}
      />

      <div className="grid grid-4 mb-4">
        <Stat icon={<BsTicketPerforated />} iconBg="#dbeafe" iconColor="#1d4999" value={T.issued} label="Tokens Issued Today" />
        <Stat icon={<BsClockHistory />} iconBg="#fef3c7" iconColor="#b45309" value={T.waiting} label="Currently Waiting" hint={`${T.priority} priority`} />
        <Stat icon={<BsCheckCircle />} iconBg="#dcfce7" iconColor="#16a34a" value={T.served} label="Served" hint={`Avg TAT ${fmtSec(A.tat_seconds)}`} />
        <Stat icon={<BsExclamationTriangle />} iconBg="#fee2e2" iconColor="#b91c1c" value={T.skipped + T.cancelled} label="Skipped / Cancelled" />
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header">Now Serving</div>
          <div className="card-body">
            {live.now_serving.length === 0 ? (
              <p className="text-muted">No tokens currently being served.</p>
            ) : (
              <table>
                <thead><tr><th>Token</th><th>Patient</th><th>Counter</th><th>Status</th></tr></thead>
                <tbody>
                  {live.now_serving.map(t => (
                    <tr key={t.id}>
                      <td className="font-bold">{t.number}</td>
                      <td>{t.patient_detail?.full_name || '—'}</td>
                      <td>{t.counter_name || '—'}</td>
                      <td><Badge>{t.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">Next Up (priority first)</div>
          <div className="card-body">
            {live.next_up.length === 0 ? (
              <p className="text-muted">Queue is empty.</p>
            ) : (
              <table>
                <thead><tr><th>Token</th><th>Patient</th><th>Service</th><th>Priority</th></tr></thead>
                <tbody>
                  {live.next_up.map(t => (
                    <tr key={t.id}>
                      <td className="font-bold">{t.number}</td>
                      <td>{t.patient_detail?.full_name || '—'}</td>
                      <td>{t.service_name}</td>
                      <td><Badge>{t.priority}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Volume by Department</div>
        <div className="card-body">
          <table>
            <thead><tr><th>Department</th><th>Issued</th><th>Served</th><th>Waiting</th></tr></thead>
            <tbody>
              {overview.by_department.map(d => (
                <tr key={d.department__id}>
                  <td className="font-bold">{d.department__name}</td>
                  <td>{d.issued}</td>
                  <td>{d.served}</td>
                  <td>{d.waiting}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
