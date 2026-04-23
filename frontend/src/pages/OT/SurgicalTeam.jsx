import { useState, useEffect, useCallback } from 'react'
import api from '../../api/client'

const ROLES = [
  { value: 'primary_surgeon', label: 'Primary Surgeon', color: '#2563eb', bg: '#dbeafe' },
  { value: 'assistant_surgeon', label: 'Assistant Surgeon', color: '#4338ca', bg: '#e0e7ff' },
  { value: 'anaesthesiologist', label: 'Anaesthesiologist', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'scrub_nurse', label: 'Scrub Nurse', color: '#0d9488', bg: '#ccfbf1' },
  { value: 'circulating_nurse', label: 'Circulating Nurse', color: '#0891b2', bg: '#cffafe' },
  { value: 'ot_technician', label: 'OT Technician', color: '#d97706', bg: '#fef3c7' },
  { value: 'perfusionist', label: 'Perfusionist', color: '#db2777', bg: '#fce7f3' },
]

const ROLE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'primary_surgeon,assistant_surgeon', label: 'Surgeons' },
  { key: 'anaesthesiologist', label: 'Anaesthesiologists' },
  { key: 'scrub_nurse,circulating_nurse', label: 'Nurses' },
  { key: 'ot_technician', label: 'Technicians' },
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
  user_id: '',
  user_display: '',
  role: 'primary_surgeon',
  specialization: '',
  registration_number: '',
  is_active: true,
}

function getRoleCfg(role) {
  return ROLES.find(r => r.value === role) || { label: role, color: '#64748b', bg: '#f1f5f9' }
}

export default function SurgicalTeam() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editMember, setEditMember] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/ot/team-members/')
      setMembers(res.data.results || res.data)
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const openAdd = () => {
    setEditMember(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
    api.get('/accounts/users/').then(r => setUsers(r.data.results || r.data)).catch(() => {})
  }

  const openEdit = (m) => {
    setEditMember(m)
    setForm({
      user_id: m.user || m.user_id || '',
      user_display: m.user_name || m.user_display || '',
      role: m.role || 'primary_surgeon',
      specialization: m.specialization || '',
      registration_number: m.registration_number || '',
      is_active: m.is_active !== false,
    })
    setError('')
    setShowModal(true)
    api.get('/accounts/users/').then(r => setUsers(r.data.results || r.data)).catch(() => {})
  }

  const handleSave = async () => {
    if (!form.role) { setError('Role is required'); return }
    setSaving(true)
    setError('')
    const payload = {
      role: form.role,
      specialization: form.specialization,
      registration_number: form.registration_number,
      is_active: form.is_active,
    }
    if (form.user_id) payload.user = Number(form.user_id)
    try {
      if (editMember) {
        await api.patch(`/ot/team-members/${editMember.id}/`, payload)
      } else {
        await api.post('/ot/team-members/', payload)
      }
      setShowModal(false)
      fetchMembers()
    } catch (e) {
      setError(e?.response?.data?.detail || JSON.stringify(e?.response?.data) || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (member) => {
    try {
      await api.patch(`/ot/team-members/${member.id}/`, { is_active: !member.is_active })
      fetchMembers()
    } catch { /* ignore */ }
  }

  const filteredMembers = members.filter(m => {
    if (activeTab === 'all') return true
    const roles = activeTab.split(',')
    return roles.includes(m.role)
  })

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', margin: 0 }}>Surgical Team</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>Manage OT team members and their roles</p>
        </div>
        <button style={btnStyle('#1d4999')} onClick={openAdd}>
          <i className="bi bi-person-plus" /> Add Team Member
        </button>
      </div>

      {/* Role Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {ROLE_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 14,
              background: activeTab === tab.key ? '#1d4999' : '#fff',
              color: activeTab === tab.key ? '#fff' : '#64748b',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}>
            {tab.label}
            <span style={{
              marginLeft: 6,
              background: activeTab === tab.key ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
              color: activeTab === tab.key ? '#fff' : '#64748b',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: 12,
            }}>
              {tab.key === 'all' ? members.length : members.filter(m => tab.key.split(',').includes(m.role)).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <i className="bi bi-arrow-repeat" style={{ fontSize: 32 }} />
            <div style={{ marginTop: 8 }}>Loading team members...</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Name', 'Role', 'Specialization', 'Registration No.', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 12, borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
                    <i className="bi bi-people" style={{ fontSize: 36, display: 'block', marginBottom: 8 }} />
                    No team members found
                  </td>
                </tr>
              )}
              {filteredMembers.map(member => {
                const roleCfg = getRoleCfg(member.role)
                return (
                  <tr key={member.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', background: roleCfg.bg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: roleCfg.color, fontWeight: 700, fontSize: 15, flexShrink: 0,
                        }}>
                          {(member.user_name || member.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{member.user_name || member.name || `Member #${member.id}`}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>{member.username || member.user_username || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: roleCfg.bg,
                        color: roleCfg.color,
                        borderRadius: 20,
                        padding: '2px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {roleCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569' }}>{member.specialization || '-'}</td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontFamily: 'monospace' }}>{member.registration_number || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div onClick={() => toggleActive(member)}
                          style={{
                            width: 36, height: 20, borderRadius: 10,
                            background: member.is_active ? '#6366f1' : '#cbd5e1',
                            cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                          }}>
                          <span style={{
                            position: 'absolute', top: 2,
                            left: member.is_active ? 18 : 2,
                            width: 16, height: 16, borderRadius: '50%',
                            background: '#fff', transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                          }} />
                        </div>
                        <span style={{ fontSize: 12, color: member.is_active ? '#10b981' : '#94a3b8' }}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button onClick={() => openEdit(member)}
                        style={{ ...btnStyle('#f5f3ff', '#6366f1'), fontSize: 12, padding: '6px 12px' }}>
                        <i className="bi bi-pencil" /> Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                {editMember ? 'Edit Team Member' : 'Add Team Member'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#64748b' }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#ef4444', marginBottom: 16, fontSize: 13 }}>
                  {error}
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>User *</label>
                <select value={form.user_id} onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))} style={inputStyle}>
                  <option value="">— Select User —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.username} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Role *</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={inputStyle}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {form.role && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: getRoleCfg(form.role).bg, color: getRoleCfg(form.role).color, borderRadius: 20, padding: '4px 12px', fontSize: 13 }}>
                    <i className="bi bi-person-badge" />
                    {getRoleCfg(form.role).label}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Specialization</label>
                <input value={form.specialization} onChange={e => setForm(p => ({ ...p, specialization: e.target.value }))}
                  placeholder="e.g. Cardiothoracic Surgery"
                  style={inputStyle} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Registration Number</label>
                <input value={form.registration_number} onChange={e => setForm(p => ({ ...p, registration_number: e.target.value }))}
                  placeholder="e.g. MCI-12345"
                  style={inputStyle} />
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
                {saving ? 'Saving...' : editMember ? 'Update Member' : 'Add Member'}
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
