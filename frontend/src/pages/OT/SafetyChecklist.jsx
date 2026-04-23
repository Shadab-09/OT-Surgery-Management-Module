import { useState } from 'react'
import api from '../../api/client'

// WHO Surgical Safety Checklist items per phase
const CHECKLIST_PHASES = [
  {
    phase: 'sign_in',
    label: 'Sign-In',
    subtitle: 'Before induction of anaesthesia',
    icon: 'bi-door-open',
    color: '#2563eb',
    bg: '#dbeafe',
    border: '#93c5fd',
    items: [
      'Patient identity confirmed',
      'Surgical site marked',
      'Allergies checked',
      'Anaesthesia equipment checked',
      'Pulse oximeter attached and functioning',
      'Informed consent obtained',
    ],
  },
  {
    phase: 'time_out',
    label: 'Time-Out',
    subtitle: 'Before skin incision',
    icon: 'bi-pause-circle',
    color: '#d97706',
    bg: '#fef3c7',
    border: '#fcd34d',
    items: [
      'Team confirmed patient identity, site and procedure',
      'Antibiotic prophylaxis given within last 60 minutes',
      'Anticipated critical steps reviewed',
      'Essential imaging displayed',
    ],
  },
  {
    phase: 'sign_out',
    label: 'Sign-Out',
    subtitle: 'Before patient leaves operating room',
    icon: 'bi-box-arrow-right',
    color: '#16a34a',
    bg: '#d1fae5',
    border: '#86efac',
    items: [
      'Procedure recorded in nursing notes',
      'Instrument, sponge and needle counts complete and correct',
      'Specimens labelled correctly',
      'Any equipment issues to be addressed',
      'Post-operative plan communicated to team',
    ],
  },
]

function ChecklistPhaseCard({ phaseDef, checklist, onToggleItem, completing }) {
  const completed = checklist?.status === 'completed'
  const items = checklist?.items || phaseDef.items.map(text => ({ text, checked: false }))

  const allChecked = items.every(item => item.checked || item.completed)
  const checkedCount = items.filter(item => item.checked || item.completed).length

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: `2px solid ${completed ? phaseDef.border : '#e5e7eb'}`,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      transition: 'border-color 0.2s',
      flex: 1,
      minWidth: 0,
    }}>
      {/* Phase Header */}
      <div style={{
        padding: '14px 18px',
        background: completed ? phaseDef.bg : '#f9fafb',
        borderBottom: `1px solid ${completed ? phaseDef.border : '#e5e7eb'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: completed ? phaseDef.bg : '#f1f5f9',
            border: `2px solid ${completed ? phaseDef.color : '#d1d5db'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {completed
              ? <i className="bi bi-check-circle-fill" style={{ color: phaseDef.color, fontSize: 16 }} />
              : <i className={`bi ${phaseDef.icon}`} style={{ color: '#9ca3af', fontSize: 14 }} />
            }
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.92rem', color: completed ? phaseDef.color : '#374151' }}>{phaseDef.label}</div>
            <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 1 }}>{phaseDef.subtitle}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: phaseDef.color }}>
            {checkedCount}/{items.length}
          </div>
          {completed && (
            <span style={{ display: 'inline-block', background: phaseDef.bg, color: phaseDef.color, padding: '2px 8px', borderRadius: 9999, fontSize: '0.68rem', fontWeight: 700, marginTop: 2 }}>
              COMPLETE
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ height: 3, background: '#f1f5f9' }}>
        <div style={{
          height: '100%',
          width: `${items.length ? (checkedCount / items.length) * 100 : 0}%`,
          background: phaseDef.color,
          transition: 'width 0.3s ease',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      {/* Checklist Items */}
      <div style={{ padding: '14px 16px' }}>
        {items.map((item, idx) => {
          const isChecked = item.checked || item.completed || false
          const text = typeof item === 'string' ? item : (item.text || phaseDef.items[idx] || '')
          return (
            <label
              key={idx}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, cursor: completed ? 'default' : 'pointer',
                padding: '9px 10px', borderRadius: 8, marginBottom: 4,
                background: isChecked ? (completed ? phaseDef.bg : '#f0fdf4') : 'transparent',
                border: `1px solid ${isChecked ? (completed ? phaseDef.border : '#bbf7d0') : '#f3f4f6'}`,
                transition: 'background 0.15s, border-color 0.15s',
              }}
            >
              <div style={{ position: 'relative', flexShrink: 0, marginTop: 1 }}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={completed}
                  onChange={() => !completed && onToggleItem(phaseDef.phase, idx, !isChecked)}
                  style={{ display: 'none' }}
                />
                <div style={{
                  width: 20, height: 20, borderRadius: 5,
                  border: `2px solid ${isChecked ? (completed ? phaseDef.color : '#16a34a') : '#d1d5db'}`,
                  background: isChecked ? (completed ? phaseDef.color : '#16a34a') : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {isChecked && <i className="bi bi-check" style={{ color: '#fff', fontSize: 12, fontWeight: 900 }} />}
                </div>
              </div>
              <span style={{
                fontSize: '0.85rem', lineHeight: 1.4,
                color: isChecked ? (completed ? phaseDef.color : '#16a34a') : '#374151',
                fontWeight: isChecked ? 600 : 400,
                textDecoration: isChecked && completed ? 'none' : 'none',
              }}>
                {text}
              </span>
            </label>
          )
        })}
      </div>

      {/* Complete Phase Button */}
      {!completed && checklist && (
        <div style={{ padding: '0 16px 14px' }}>
          <button
            onClick={() => onToggleItem(phaseDef.phase, 'complete_phase', null)}
            disabled={!allChecked || completing}
            style={{
              width: '100%', padding: '9px', borderRadius: 8, border: 'none',
              background: allChecked ? phaseDef.color : '#e5e7eb',
              color: allChecked ? '#fff' : '#9ca3af',
              fontWeight: 700, fontSize: '0.85rem', cursor: allChecked ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'background 0.15s',
            }}
          >
            <i className="bi bi-check2-all" />
            {completing ? 'Completing…' : allChecked ? `Complete ${phaseDef.label}` : `Check all items to complete`}
          </button>
        </div>
      )}
    </div>
  )
}

export default function SafetyChecklist({ bookingId, checklists = [], onInitialize, onUpdate }) {
  const [localChecklists, setLocalChecklists] = useState(checklists)
  const [completing, setCompleting] = useState(null)
  const [error, setError] = useState('')

  // Sync when parent passes new checklists
  const lists = checklists.length > 0 ? checklists : localChecklists

  const getChecklist = (phase) => lists.find(c => c.phase === phase) || null

  const handleToggleItem = async (phase, itemIndex, checked) => {
    setError('')
    const checklist = getChecklist(phase)

    // Complete entire phase
    if (itemIndex === 'complete_phase') {
      if (!checklist) return
      setCompleting(phase)
      try {
        await api.post(`/ot/safety-checklists/${checklist.id}/complete-phase/`)
        onUpdate && onUpdate()
        // Also update local state
        setLocalChecklists(prev => prev.map(c =>
          c.phase === phase ? { ...c, status: 'completed' } : c
        ))
      } catch (e) {
        setError(e.response?.data?.detail || 'Failed to complete phase.')
      } finally { setCompleting(null) }
      return
    }

    // Toggle individual item
    if (!checklist) return
    const updatedItems = (checklist.items || CHECKLIST_PHASES.find(p => p.phase === phase).items.map(text => ({ text, checked: false })))
      .map((item, idx) => idx === itemIndex ? { ...item, checked } : item)

    // Optimistic update
    setLocalChecklists(prev => prev.map(c =>
      c.phase === phase ? { ...c, items: updatedItems } : c
    ))

    try {
      await api.patch(`/ot/safety-checklists/${checklist.id}/`, { items: updatedItems })
      onUpdate && onUpdate()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to update item.')
      // Revert
      setLocalChecklists(prev => prev.map(c =>
        c.phase === phase ? { ...c, items: checklist.items } : c
      ))
    }
  }

  const isInitialized = lists.length > 0

  if (!isInitialized) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ marginBottom: 24 }}>
          <i className="bi bi-shield-check" style={{ fontSize: 56, color: '#9ca3af', display: 'block', marginBottom: 16, opacity: 0.5 }} />
          <h3 style={{ margin: '0 0 8px', fontWeight: 700, color: '#374151', fontSize: '1.1rem' }}>WHO Surgical Safety Checklist</h3>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 auto', maxWidth: 400 }}>
            The WHO Surgical Safety Checklist has not been initialized for this booking.
            Click the button below to set up the 3-phase checklist.
          </p>
        </div>

        {/* Phase preview */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
          {CHECKLIST_PHASES.map(phase => (
            <div key={phase.phase} style={{
              background: phase.bg, borderRadius: 10, padding: '12px 20px',
              border: `1px solid ${phase.border}`, textAlign: 'center', minWidth: 130,
            }}>
              <i className={`bi ${phase.icon}`} style={{ fontSize: 20, color: phase.color, display: 'block', marginBottom: 4 }} />
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: phase.color }}>{phase.label}</div>
              <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: 2 }}>{phase.items.length} items</div>
            </div>
          ))}
        </div>

        <button
          onClick={onInitialize}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 28px', borderRadius: 10, border: 'none',
            background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '0.95rem',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
          }}
        >
          <i className="bi bi-shield-plus" /> Initialize WHO Safety Checklist
        </button>
      </div>
    )
  }

  // Summary bar
  const completedCount = CHECKLIST_PHASES.filter(p => getChecklist(p.phase)?.status === 'completed').length

  return (
    <div>
      {/* Summary Bar */}
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="bi bi-shield-check" style={{ fontSize: 18, color: completedCount === 3 ? '#16a34a' : '#2563eb' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1f2937' }}>WHO Surgical Safety Checklist</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {CHECKLIST_PHASES.map(p => {
            const cl = getChecklist(p.phase)
            const done = cl?.status === 'completed'
            return (
              <span key={p.phase} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 700,
                background: done ? p.bg : '#f1f5f9',
                color: done ? p.color : '#9ca3af',
                border: `1px solid ${done ? p.border : '#e5e7eb'}`,
              }}>
                <i className={`bi ${done ? 'bi-check-circle-fill' : 'bi-circle'}`} style={{ fontSize: 10 }} />
                {p.label}
              </span>
            )
          })}
          {completedCount === 3 && (
            <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 800, border: '1px solid #86efac' }}>
              <i className="bi bi-check2-all" /> ALL COMPLETE
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 14, fontSize: '0.875rem' }}>
          <i className="bi bi-exclamation-triangle" /> {error}
        </div>
      )}

      {/* Phase Cards */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {CHECKLIST_PHASES.map(phaseDef => {
          const checklist = getChecklist(phaseDef.phase)
          return (
            <ChecklistPhaseCard
              key={phaseDef.phase}
              phaseDef={phaseDef}
              checklist={checklist}
              onToggleItem={handleToggleItem}
              completing={completing === phaseDef.phase}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8f9fc', borderRadius: 8, border: '1px solid #e5e7eb', display: 'flex', gap: 20, alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>GUIDE:</span>
        <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="bi bi-check-square-fill" style={{ color: '#16a34a' }} /> Checked item
        </span>
        <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="bi bi-square" style={{ color: '#d1d5db' }} /> Pending item
        </span>
        <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="bi bi-check-circle-fill" style={{ color: '#16a34a' }} /> Phase complete
        </span>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto' }}>
          Compliant with WHO Second Global Patient Safety Challenge — Safe Surgery Saves Lives
        </span>
      </div>
    </div>
  )
}
