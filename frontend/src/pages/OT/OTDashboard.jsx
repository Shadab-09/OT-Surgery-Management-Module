import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../api/client'

const PRIORITY_COLORS = {
  elective: { bg: '#dbeafe', color: '#1e40af' },
  urgent: { bg: '#fef3c7', color: '#92400e' },
  emergency: { bg: '#fee2e2', color: '#991b1b' },
}

const STATUS_COLORS = {
  scheduled: { bg: '#f1f5f9', color: '#475569' },
  confirmed: { bg: '#e0f2fe', color: '#0369a1' },
  prep: { bg: '#fef3c7', color: '#92400e' },
  in_progress: { bg: '#fef3c7', color: '#92400e' },
  completed: { bg: '#d1fae5', color: '#065f46' },
  cancelled: { bg: '#fee2e2', color: '#991b1b' },
  postponed: { bg: '#ede9fe', color: '#6d28d9' },
}

function PriorityBadge({ priority }) {
  const c = PRIORITY_COLORS[priority] || { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 9999,
      fontSize: '0.7rem', fontWeight: 600, background: c.bg, color: c.color,
      textTransform: 'capitalize',
    }}>
      {priority}
    </span>
  )
}

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 9999,
      fontSize: '0.7rem', fontWeight: 600, background: c.bg, color: c.color,
      textTransform: 'capitalize',
    }}>
      {String(status || '').replaceAll('_', ' ')}
    </span>
  )
}

function StatCard({ icon, label, value, iconBg, iconColor, borderColor }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      borderLeft: `4px solid ${borderColor}`,
      border: '1px solid #e5e7eb',
      borderLeftColor: borderColor,
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12,
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, flexShrink: 0,
      }}>
        <i className={`bi ${icon}`} />
      </div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1 }}>{value ?? '—'}</div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      </div>
    </div>
  )
}

function fmtTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function OTDashboard() {
  const nav = useNavigate()
  const [stats, setStats] = useState(null)
  const [today, setToday] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [dashRes, todayRes] = await Promise.all([
        api.get('/ot/bookings/dashboard/'),
        api.get('/ot/bookings/today/'),
      ])
      setStats(dashRes.data)
      setToday(Array.isArray(todayRes.data) ? todayRes.data : (todayRes.data.results || []))
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const doAction = async (id, action, payload = {}) => {
    if (action === 'cancel') {
      const reason = prompt('Enter cancellation reason:')
      if (!reason) return
      payload = { reason }
    }
    if (action === 'complete' && !confirm('Mark this surgery as complete?')) return
    setActionLoading(`${id}-${action}`)
    try {
      await api.post(`/ot/bookings/${id}/${action}/`, payload)
      load()
    } catch (e) {
      alert(e.response?.data?.detail || `Action "${action}" failed.`)
    } finally {
      setActionLoading(null)
    }
  }

  const canStart = (s) => ['scheduled', 'confirmed', 'prep'].includes(s)
  const canComplete = (s) => s === 'in_progress'
  const canCancel = (s) => !['completed', 'cancelled'].includes(s)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 12 }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Loading dashboard…</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.4rem', color: '#1f2937' }}>Operation Theatre — Dashboard</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>Live overview of today's OT schedule</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-arrow-clockwise" /> Refresh
          </button>
          <Link to="/ot/bookings/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-plus-circle" /> New Booking
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
      )}

      {/* Stat Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard icon="bi-scissors" label="Today's Cases" value={stats?.total_today} iconBg="#dbeafe" iconColor="#1d4ed8" borderColor="#2563eb" />
        <StatCard icon="bi-play-circle" label="In Progress" value={stats?.in_progress} iconBg="#fef3c7" iconColor="#d97706" borderColor="#f59e0b" />
        <StatCard icon="bi-check-circle" label="Completed Today" value={stats?.completed_today} iconBg="#d1fae5" iconColor="#16a34a" borderColor="#22c55e" />
        <StatCard icon="bi-calendar-check" label="Elective" value={stats?.elective} iconBg="#e0e7ff" iconColor="#4338ca" borderColor="#6366f1" />
        <StatCard icon="bi-exclamation-triangle" label="Emergency" value={stats?.emergency} iconBg="#fee2e2" iconColor="#dc2626" borderColor="#ef4444" />
        <StatCard icon="bi-door-open" label="Rooms Available" value={stats?.rooms_available} iconBg="#ccfbf1" iconColor="#0d9488" borderColor="#14b8a6" />
      </div>

      {/* Today's OT Schedule */}
      <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Today's OT Schedule</span>
          <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{today.length} booking{today.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Room', 'Time', 'Patient', 'Surgery', 'Surgeon', 'Priority', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {today.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: '0.9rem' }}>
                    <i className="bi bi-calendar-x" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.4 }} />
                    No surgeries scheduled for today.
                  </td>
                </tr>
              ) : today.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                    <span style={{ fontWeight: 600 }}>{b.room_name || b.room || '—'}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.85rem', color: '#374151', whiteSpace: 'nowrap' }}>
                    {fmtTime(b.scheduled_start)} – {fmtTime(b.scheduled_end)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{b.patient_name || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{b.patient_mrn || ''}</div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', maxWidth: 180 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.surgery_name || '—'}</div>
                    {b.surgery_category && <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{b.surgery_category}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                    {b.primary_surgeon_name ? `Dr. ${b.primary_surgeon_name}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <PriorityBadge priority={b.priority} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <StatusBadge status={b.status} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                      <button
                        className="btn btn-sm"
                        style={{ background: '#1f2937', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem' }}
                        onClick={() => nav(`/ot/bookings/${b.id}`)}
                        title="View"
                      >
                        <i className="bi bi-eye" />
                      </button>
                      {canStart(b.status) && (
                        <button
                          className="btn btn-sm btn-success"
                          style={{ border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem' }}
                          disabled={actionLoading === `${b.id}-start`}
                          onClick={() => doAction(b.id, 'start')}
                          title="Start Surgery"
                        >
                          <i className="bi bi-play-fill" />
                        </button>
                      )}
                      {canComplete(b.status) && (
                        <button
                          className="btn btn-sm btn-primary"
                          style={{ border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem' }}
                          disabled={actionLoading === `${b.id}-complete`}
                          onClick={() => doAction(b.id, 'complete')}
                          title="Complete"
                        >
                          <i className="bi bi-check-lg" />
                        </button>
                      )}
                      {canCancel(b.status) && (
                        <button
                          className="btn btn-sm btn-danger"
                          style={{ border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem' }}
                          disabled={actionLoading === `${b.id}-cancel`}
                          onClick={() => doAction(b.id, 'cancel')}
                          title="Cancel"
                        >
                          <i className="bi bi-x-lg" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {stats?.low_stock_alerts && stats.low_stock_alerts.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="bi bi-exclamation-triangle-fill" style={{ color: '#d97706' }} />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Low Stock Alerts</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Item', 'Category', 'Current Stock', 'Reorder Level', 'Unit'].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: '0.72rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600, letterSpacing: '0.04em', padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.low_stock_alerts.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.875rem' }}>{item.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>{item.category || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>{item.current_stock}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>{item.reorder_level}</td>
                    <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>{item.unit || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
