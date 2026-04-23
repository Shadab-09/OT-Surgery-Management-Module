import { useEffect, useState } from 'react'
import { Analytics, Departments } from '../api/client'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import PageHeader from '../components/PageHeader'
import Stat from '../components/Stat'
import { BsTicketPerforated, BsCheckCircle, BsClockHistory, BsSpeedometer } from 'react-icons/bs'

function fmtSec(s) { if (!s) return '0s'; const m = Math.floor(s / 60), sec = s % 60; return m ? `${m}m ${sec}s` : `${sec}s` }

export default function AnalyticsPage() {
  const [departments, setDepartments] = useState([])
  const [dept, setDept] = useState('')
  const [overview, setOverview] = useState(null)
  const [trends, setTrends] = useState(null)

  useEffect(() => { Departments.list().then(r => setDepartments(r.data.results || r.data)) }, [])
  useEffect(() => {
    const params = dept ? { department: dept } : {}
    Analytics.overview(params).then(r => setOverview(r.data))
    Analytics.trends({ ...params, days: 7 }).then(r => setTrends(r.data))
  }, [dept])

  if (!overview || !trends) return <p>Loading analytics…</p>
  const T = overview.totals, A = overview.averages

  return (
    <>
      <PageHeader title="Analytics" subtitle="KPIs · hourly distribution · 7-day trends"
        actions={
          <select value={dept} onChange={e => setDept(e.target.value)}
            style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        } />

      <div className="grid grid-4 mb-4">
        <Stat icon={<BsTicketPerforated />} iconBg="#dbeafe" iconColor="#1d4999" value={T.issued} label="Issued Today" />
        <Stat icon={<BsCheckCircle />} iconBg="#dcfce7" iconColor="#16a34a" value={T.served} label="Served" />
        <Stat icon={<BsClockHistory />} iconBg="#fef3c7" iconColor="#b45309" value={fmtSec(A.wait_seconds)} label="Avg Wait" />
        <Stat icon={<BsSpeedometer />} iconBg="#e0f2fe" iconColor="#0369a1" value={fmtSec(A.tat_seconds)} label="Avg TAT" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header">Hourly Token Issuance (today)</div>
          <div className="card-body" style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={overview.hourly_issuance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#1d4999" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header">7-Day Trend</div>
          <div className="card-body" style={{ height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={trends.series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="d" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="issued" stroke="#1d4999" />
                <Line type="monotone" dataKey="served" stroke="#16a34a" />
                <Line type="monotone" dataKey="skipped" stroke="#dc2626" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card mt-2">
        <div className="card-header">By Department (today)</div>
        <div className="card-body" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Department</th><th>Issued</th><th>Served</th><th>Waiting</th></tr></thead>
            <tbody>
              {overview.by_department.map(d => (
                <tr key={d.department__id}>
                  <td className="font-bold">{d.department__name}</td>
                  <td>{d.issued}</td><td>{d.served}</td><td>{d.waiting}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
