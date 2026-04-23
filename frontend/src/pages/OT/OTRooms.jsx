import { useState, useEffect, useCallback } from 'react'
import api from '../../api/client'

const STATUS_CONFIG = {
  available: { label: 'Available', color: '#10b981', bg: '#dcfce7' },
  occupied: { label: 'Occupied', color: '#ef4444', bg: '#fee2e2' },
  cleaning: { label: 'Cleaning', color: '#f59e0b', bg: '#fef3c7' },
  maintenance: { label: 'Maintenance', color: '#6366f1', bg: '#ede9fe' },
  closed: { label: 'Closed', color: '#64748b', bg: '#f1f5f9' },
}

const ROOM_TYPES = [
  { value: 'major', label: 'Major OT' },
  { value: 'minor', label: 'Minor OT' },
  { value: 'emergency', label: 'Emergency OT' },
  { value: 'cardiac', label: 'Cardiac OT' },
  { value: 'neuro', label: 'Neuro OT' },
  { value: 'transplant', label: 'Transplant OT' },
  { value: 'ortho', label: 'Orthopaedic OT' },
  { value: 'laparoscopy', label: 'Laparoscopy Suite' },
]

const cardStyle = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  padding: '20px 24px',
  marginBottom: 20,
}

const btnStyle = (color = '#6366f1', textColor = '#fff') => ({
  background: color,
  color: textColor,
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  cursor: 'pointer',
  fontWeight: 500,
  fontSize: 14,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
})

const inputStyle = {
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block',
  fontWeight: 500,
  fontSize: 13,
  color: '#374151',
  marginBottom: 4,
}

const EMPTY_FORM = {
  name: '',
  room_number: '',
  room_type: 'major',
  department: '',
  status: 'available',
  equipment: [],
  notes: '',
  is_active: true,
}

export default function OTRooms() {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editRoom, setEditRoom] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [equipInput, setEquipInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/ot/rooms/')
      setRooms(res.data.results || res.data)
    } catch {
      setRooms([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  const openAdd = () => {
    setEditRoom(null)
    setForm(EMPTY_FORM)
    setEquipInput('')
    setError('')
    setShowModal(true)
  }

  const openEdit = (room) => {
    setEditRoom(room)
    setForm({
      name: room.name || '',
      room_number: room.room_number || '',
      room_type: room.room_type || 'major',
      department: room.department || '',
      status: room.status || 'available',
      equipment: Array.isArray(room.equipment) ? [...room.equipment] : [],
      notes: room.notes || '',
      is_active: room.is_active !== false,
    })
    setEquipInput('')
    setError('')
    setShowModal(true)
  }

  const addEquipTag = () => {
    const val = equipInput.trim()
    if (val && !form.equipment.includes(val)) {
      setForm(p => ({ ...p, equipment: [...p.equipment, val] }))
    }
    setEquipInput('')
  }

  const removeEquipTag = (tag) => {
    setForm(p => ({ ...p, equipment: p.equipment.filter(e => e !== tag) }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Room name is required'); return }
    if (!form.room_number.trim()) { setError('Room number is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        room_number: form.room_number,
        room_type: form.room_type,
        status: form.status,
        equipment: form.equipment,
        notes: form.notes,
        is_active: form.is_active,
      }
      if (editRoom) {
        await api.patch(`/ot/rooms/${editRoom.id}/`, payload)
      } else {
        await api.post('/ot/rooms/', payload)
      }
      setShowModal(false)
      fetchRooms()
    } catch (e) {
      const d = e?.response?.data
      const msg = d?.detail || (typeof d === 'object' ? Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(', ') : null) || 'Failed to save room'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (room, newStatus) => {
    try {
      await api.patch(`/ot/rooms/${room.id}/`, { status: newStatus })
      fetchRooms()
    } catch { /* ignore */ }
  }

  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = rooms.filter(r => r.status === s).length
    return acc
  }, {})

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', margin: 0 }}>OT Rooms</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>Manage operation theatre rooms and their status</p>
        </div>
        <button style={btnStyle('#1d4999')} onClick={openAdd}>
          <i className="bi bi-plus-lg" /> Add Room
        </button>
      </div>

      {/* Status Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} style={{ ...cardStyle, marginBottom: 0, textAlign: 'center', borderTop: `3px solid ${cfg.color}` }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: cfg.color }}>{statusCounts[key] || 0}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 64, color: '#94a3b8' }}>
          <i className="bi bi-arrow-repeat" style={{ fontSize: 32 }} />
          <div style={{ marginTop: 8 }}>Loading rooms...</div>
        </div>
      ) : rooms.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: 64, color: '#94a3b8' }}>
          <i className="bi bi-door-open" style={{ fontSize: 48 }} />
          <div style={{ marginTop: 12, fontSize: 16 }}>No rooms configured yet</div>
          <button style={{ ...btnStyle('#6366f1'), marginTop: 16 }} onClick={openAdd}>Add First Room</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {rooms.map(room => {
            const cfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.available
            const typLabel = ROOM_TYPES.find(t => t.value === room.room_type)?.label || room.room_type
            return (
              <div key={room.id} style={{ ...cardStyle, marginBottom: 0, position: 'relative', border: `1px solid ${cfg.color}30` }}>
                {/* Room Number Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{
                    background: cfg.color,
                    color: '#fff',
                    borderRadius: 10,
                    width: 52,
                    height: 52,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {room.room_number}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: cfg.bg, color: cfg.color,
                      borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600
                    }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                      {cfg.label}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>{room.name}</span>
                </div>
                <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ background: '#f0f9ff', color: '#0ea5e9', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>
                    {typLabel}
                  </span>
                  {room.department && (
                    <span style={{ background: '#f5f3ff', color: '#6366f1', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 500 }}>
                      {room.department}
                    </span>
                  )}
                </div>

                {/* Equipment Tags */}
                {Array.isArray(room.equipment) && room.equipment.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Equipment</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {room.equipment.map(eq => (
                        <span key={eq} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 8px', fontSize: 11, color: '#475569' }}>
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid #f1f5f9', paddingTop: 12, marginTop: 4 }}>
                  <button onClick={() => openEdit(room)} style={{ ...btnStyle('#f5f3ff', '#6366f1'), fontSize: 12, padding: '6px 12px' }}>
                    <i className="bi bi-pencil" /> Edit
                  </button>
                  {room.status !== 'available' && (
                    <button onClick={() => changeStatus(room, 'available')} style={{ ...btnStyle('#dcfce7', '#16a34a'), fontSize: 12, padding: '6px 12px' }}>
                      <i className="bi bi-check-circle" /> Available
                    </button>
                  )}
                  {room.status !== 'cleaning' && (
                    <button onClick={() => changeStatus(room, 'cleaning')} style={{ ...btnStyle('#fef3c7', '#d97706'), fontSize: 12, padding: '6px 12px' }}>
                      <i className="bi bi-stars" /> Cleaning
                    </button>
                  )}
                  {room.status !== 'maintenance' && (
                    <button onClick={() => changeStatus(room, 'maintenance')} style={{ ...btnStyle('#ede9fe', '#7c3aed'), fontSize: 12, padding: '6px 12px' }}>
                      <i className="bi bi-tools" /> Maintenance
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                {editRoom ? 'Edit Room' : 'Add OT Room'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#64748b' }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div style={{ padding: '20px 24px', flex: 1 }}>
              {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#ef4444', marginBottom: 16, fontSize: 13 }}>
                  {error}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Room Name *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. OT-1" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Room Number *</label>
                  <input value={form.room_number} onChange={e => setForm(p => ({ ...p, room_number: e.target.value }))}
                    placeholder="e.g. 101" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Room Type</label>
                <select value={form.room_type} onChange={e => setForm(p => ({ ...p, room_type: e.target.value }))} style={inputStyle}>
                  {ROOM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Equipment</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input value={equipInput}
                    onChange={e => setEquipInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEquipTag() } }}
                    placeholder="Type and press Enter"
                    style={{ ...inputStyle, flex: 1 }} />
                  <button type="button" onClick={addEquipTag}
                    style={{ ...btnStyle('#1d4999'), padding: '8px 14px', flexShrink: 0 }}>
                    <i className="bi bi-plus" />
                  </button>
                </div>
                {form.equipment.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {form.equipment.map(eq => (
                      <span key={eq} style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', borderRadius: 6, padding: '3px 10px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {eq}
                        <button type="button" onClick={() => removeEquipTag(eq)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0369a1', padding: 0, lineHeight: 1, fontSize: 13 }}>
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Active</label>
                <div onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  style={{ width: 40, height: 22, borderRadius: 11, background: form.is_active ? '#1d4999' : '#cbd5e1', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                  <span style={{ position: 'absolute', top: 2, left: form.is_active ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10 }}>
              <button onClick={handleSave} disabled={saving} style={{ ...btnStyle('#1d4999'), flex: 1, justifyContent: 'center' }}>
                {saving ? 'Saving...' : editRoom ? 'Update Room' : 'Add Room'}
              </button>
              <button onClick={() => setShowModal(false)} style={{ ...btnStyle('#f1f5f9', '#374151'), flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
