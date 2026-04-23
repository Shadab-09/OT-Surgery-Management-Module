import { useEffect, useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
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
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 600, background: c.bg, color: c.color, textTransform: 'capitalize' }}>
      {priority}
    </span>
  )
}
function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 600, background: c.bg, color: c.color, textTransform: 'capitalize' }}>
      {String(status || '').replaceAll('_', ' ')}
    </span>
  )
}

function fmtTime(dt) {
  if (!dt) return '—'
  return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function OTSchedule() {
  const nav = useNavigate()
  const [bookings, setBookings] = useState([])
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    scheduled_date: todayStr(),
    room: '',
    status: '',
    search: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filters.scheduled_date) params.scheduled_date = filters.scheduled_date
      if (filters.room) params.room = filters.room
      if (filters.status) params.status = filters.status
      if (filters.search) params.search = filters.search
      const res = await api.get('/ot/bookings/', { params })
      setBookings(Array.isArray(res.data) ? res.data : (res.data.results || []))
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load schedule.')
    } finally {
      setLoading(false)
    }
  }, [filters.scheduled_date, filters.room, filters.status, filters.search])

  useEffect(() => {
    api.get('/ot/rooms/').then(r => setRooms(Array.isArray(r.data) ? r.data : (r.data.results || []))).catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  // Group bookings by room
  const grouped = bookings.reduce((acc, b) => {
    const key = b.room_name || b.room || 'Unassigned'
    if (!acc[key]) acc[key] = []
    acc[key].push(b)
    return acc
  }, {})

  const setF = (key, val) => setFilters(f => ({ ...f, [key]: val }))

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.4rem', color: '#1f2937' }}>OT Schedule</h2>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.875rem' }}>View and manage operation theatre bookings</p>
        </div>
        <Link to="/ot/bookings/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-plus-circle" /> New Booking
        </Link>
      </div>

      {/* Filters */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Date</label>
          <input
            type="date"
            value={filters.scheduled_date}
            onChange={e => setF('scheduled_date', e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: '0.875rem' }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Room</label>
          <select
            value={filters.room}
            onChange={e => setF('room', e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: '0.875rem', minWidth: 140 }}
          >
            <option value="">All Rooms</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Status</label>
          <select
            value={filters.status}
            onChange={e => setF('status', e.target.value)}
            style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontSize: '0.875rem', minWidth: 140 }}
          >
            <option value="">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="confirmed">Confirmed</option>
            <option value="prep">Prep</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="postponed">Postponed</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>Search</label>
          <div style={{ position: 'relative' }}>
            <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 13 }} />
            <input
              type="text"
              placeholder="Patient, surgery, surgeon…"
              value={filters.search}
              onChange={e => setF('search', e.target.value)}
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px 7px 30px', fontSize: '0.875rem', width: '100%' }}
            />
          </div>
        </div>
        <button onClick={load} className="btn" style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <i className="bi bi-arrow-clockwise" /> Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 8, marginBottom: 16 }}>
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ color: '#6b7280' }}>Loading schedule…</span>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '60px 20px', textAlign: 'center', color: '#9ca3af' }}>
          <i className="bi bi-calendar-x" style={{ fontSize: 48, display: 'block', marginBottom: 12, opacity: 0.35 }} />
          <p style={{ fontSize: '1rem', marginBottom: 8 }}>No bookings found for the selected filters.</p>
          <Link to="/ot/bookings/new" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="bi bi-plus-circle" /> Create First Booking
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Object.entries(grouped).map(([roomName, items]) => (
            <div key={roomName} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              {/* Room Header */}
              <div style={{ padding: '12px 20px', background: '#1d4999', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="bi bi-door-open" />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{roomName}</span>
                </div>
                <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{items.length} booking{items.length !== 1 ? 's' : ''}</span>
              </div>

              {/* Booking Cards under Room */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {items.map((b, idx) => (
                  <div
                    key={b.id}
                    onClick={() => nav(`/ot/bookings/${b.id}`)}
                    style={{
                      padding: '14px 20px',
                      borderBottom: idx < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                      display: 'flex', alignItems: 'center', gap: 16,
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8f9fc'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    {/* Time slot */}
                    <div style={{ minWidth: 90, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1d4999' }}>{fmtTime(b.scheduled_start)}</div>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{fmtTime(b.scheduled_end)}</div>
                    </div>

                    {/* Vertical divider */}
                    <div style={{ width: 2, height: 48, background: '#e5e7eb', borderRadius: 1, flexShrink: 0 }} />

                    {/* Patient + Surgery */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1f2937' }}>
                        {b.patient_name || 'Unknown Patient'}
                      </div>
                      {b.patient_mrn && (
                        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>MRN: {b.patient_mrn}</div>
                      )}
                      <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.surgery_name || '—'}
                      </div>
                    </div>

                    {/* Surgeon */}
                    <div style={{ minWidth: 130 }}>
                      <div style={{ fontSize: '0.72rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Surgeon</div>
                      <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: 2 }}>
                        {b.primary_surgeon_name ? `Dr. ${b.primary_surgeon_name}` : '—'}
                      </div>
                    </div>

                    {/* Badges */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <PriorityBadge priority={b.priority} />
                      <StatusBadge status={b.status} />
                    </div>

                    {/* Arrow */}
                    <i className="bi bi-chevron-right" style={{ color: '#9ca3af', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
