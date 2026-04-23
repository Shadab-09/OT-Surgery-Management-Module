import { useState, useEffect, useCallback } from 'react'
import api from '../../api/client'

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'implant', label: 'Implant' },
  { value: 'suture', label: 'Suture' },
  { value: 'consumable', label: 'Consumable' },
  { value: 'instrument', label: 'Instrument' },
  { value: 'anaesthesia', label: 'Anaesthesia' },
  { value: 'drape', label: 'Drape' },
  { value: 'gloves', label: 'Gloves' },
  { value: 'other', label: 'Other' },
]

const CATEGORY_COLORS = {
  implant: '#6366f1',
  suture: '#0ea5e9',
  consumable: '#f59e0b',
  instrument: '#64748b',
  anaesthesia: '#8b5cf6',
  drape: '#06b6d4',
  gloves: '#10b981',
  other: '#94a3b8',
}

const cardStyle = {
  background: '#fff',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  padding: '20px 24px',
  marginBottom: 20,
}

const btnStyle = (color = '#6366f1') => ({
  background: color,
  color: '#fff',
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

const badgeStyle = (color) => ({
  background: color + '20',
  color: color,
  borderRadius: 20,
  padding: '2px 10px',
  fontSize: 12,
  fontWeight: 600,
  display: 'inline-block',
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
  category: 'consumable',
  sku: '',
  manufacturer: '',
  unit: '',
  quantity_in_stock: 0,
  reorder_level: 10,
  unit_cost: '',
  notes: '',
}

export default function OTInventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [adjustItem, setAdjustItem] = useState(null)
  const [adjustQty, setAdjustQty] = useState(1)
  const [adjustAction, setAdjustAction] = useState('add')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (categoryFilter) params.category = categoryFilter
      if (search) params.search = search
      const res = await api.get('/ot/inventory/', { params })
      setItems(res.data.results || res.data)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, search])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openAdd = () => {
    setEditItem(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowDrawer(true)
  }

  const openEdit = (item) => {
    setEditItem(item)
    setForm({
      name: item.name || '',
      category: item.category || 'consumable',
      sku: item.sku || '',
      manufacturer: item.manufacturer || '',
      unit: item.unit || '',
      quantity_in_stock: item.quantity_in_stock ?? 0,
      reorder_level: item.reorder_level ?? 10,
      unit_cost: item.unit_cost || '',
      notes: item.notes || '',
    })
    setError('')
    setShowDrawer(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      if (editItem) {
        await api.patch(`/ot/inventory/${editItem.id}/`, form)
      } else {
        await api.post('/ot/inventory/', form)
      }
      setShowDrawer(false)
      fetchItems()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  const handleQuickAdjust = async (item, delta) => {
    try {
      await api.post(`/ot/inventory/${item.id}/adjust-stock/`, {
        quantity: Math.abs(delta),
        action: delta > 0 ? 'add' : 'subtract',
      })
      fetchItems()
    } catch { /* ignore */ }
  }

  const handleAdjustConfirm = async () => {
    if (!adjustItem) return
    setSaving(true)
    try {
      await api.post(`/ot/inventory/${adjustItem.id}/adjust-stock/`, {
        quantity: Number(adjustQty),
        action: adjustAction,
      })
      setAdjustItem(null)
      fetchItems()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to adjust stock')
    } finally {
      setSaving(false)
    }
  }

  const displayed = items.filter(i => {
    if (lowStockOnly && i.quantity_in_stock > i.reorder_level) return false
    return true
  })

  const lowStockItems = items.filter(i => i.quantity_in_stock <= i.reorder_level)
  const categories = [...new Set(items.map(i => i.category).filter(Boolean))]

  const totalItems = items.length
  const totalCategories = categories.length

  return (
    <div style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', margin: 0 }}>OT Inventory</h1>
          <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>Manage surgical supplies and consumables</p>
        </div>
        <button style={btnStyle('#1d4999')} onClick={openAdd}>
          <i className="bi bi-plus-lg" /> Add Item
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Items', value: totalItems, icon: 'bi-box-seam', color: '#6366f1' },
          { label: 'Low Stock Alerts', value: lowStockItems.length, icon: 'bi-exclamation-triangle', color: '#ef4444' },
          { label: 'Total Categories', value: totalCategories, icon: 'bi-grid', color: '#10b981' },
        ].map(stat => (
          <div key={stat.label} style={{ ...cardStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: stat.color + '15', borderRadius: 10, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={`bi ${stat.icon}`} style={{ fontSize: 22, color: stat.color }} />
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#1e293b' }}>{stat.value}</div>
              <div style={{ fontSize: 13, color: '#64748b' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          style={{ ...inputStyle, width: 180 }}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <i className="bi bi-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            style={{ ...inputStyle, paddingLeft: 32 }} />
        </div>
        <button
          onClick={() => setLowStockOnly(v => !v)}
          style={{
            ...btnStyle(lowStockOnly ? '#1d4999' : '#fff'),
            color: lowStockOnly ? '#ffffff' : '#1d4999',
            border: '1px solid #1d4999',
          }}>
          <i className="bi bi-exclamation-triangle" />
          Low Stock Only
        </button>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, overflowX: 'auto', padding: 0 }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#1e293b' }}>
          Inventory Items ({displayed.length})
        </div>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
            <i className="bi bi-arrow-repeat" style={{ fontSize: 32 }} /> Loading...
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Name', 'Category', 'SKU', 'Manufacturer', 'Unit', 'Stock', 'Reorder Level', 'Unit Cost (₹)', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748b', fontSize: 12, whiteSpace: 'nowrap', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No inventory items found</td></tr>
              )}
              {displayed.map(item => {
                const isLow = item.quantity_in_stock <= item.reorder_level
                const catColor = CATEGORY_COLORS[item.category] || '#94a3b8'
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: '#1e293b' }}>{item.name}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={badgeStyle(catColor)}>{item.category}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace' }}>{item.sku || '-'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.manufacturer || '-'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.unit || '-'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontWeight: 700, color: isLow ? '#ef4444' : '#10b981', fontSize: 15 }}>
                        {item.quantity_in_stock}
                        {isLow && <i className="bi bi-exclamation-circle" style={{ marginLeft: 4, fontSize: 12 }} />}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.reorder_level}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>
                      {item.unit_cost ? `₹${parseFloat(item.unit_cost).toFixed(2)}` : '-'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={badgeStyle(item.is_active !== false ? '#10b981' : '#94a3b8')}>
                        {item.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <button onClick={() => handleQuickAdjust(item, 1)}
                          title="Add 1"
                          style={{ background: '#dcfce7', color: '#16a34a', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>+</button>
                        <button onClick={() => handleQuickAdjust(item, -1)}
                          title="Subtract 1"
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>-</button>
                        <button onClick={() => { setAdjustItem(item); setAdjustQty(1); setAdjustAction('add') }}
                          style={{ background: '#f0f9ff', color: '#0ea5e9', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                          <i className="bi bi-arrow-left-right" />
                        </button>
                        <button onClick={() => openEdit(item)}
                          style={{ background: '#f5f3ff', color: '#6366f1', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>
                          <i className="bi bi-pencil" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Low Stock Section */}
      {lowStockItems.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <i className="bi bi-exclamation-triangle-fill" style={{ color: '#ef4444', fontSize: 18 }} />
            <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 16 }}>Low Stock Alerts ({lowStockItems.length})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {lowStockItems.map(item => (
              <div key={item.id} style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{item.category} — {item.sku || 'No SKU'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 700 }}>Stock: {item.quantity_in_stock}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Min: {item.reorder_level}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawer / Add-Edit Modal */}
      {showDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: '#fff', width: 480, height: '100%', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
                {editItem ? 'Edit Item' : 'Add Inventory Item'}
              </h2>
              <button onClick={() => setShowDrawer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#64748b' }}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div style={{ padding: '20px 24px', flex: 1 }}>
              {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#ef4444', marginBottom: 16, fontSize: 13 }}>
                  {error}
                </div>
              )}
              {[
                { key: 'name', label: 'Item Name *', type: 'text' },
                { key: 'sku', label: 'SKU', type: 'text' },
                { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
                { key: 'unit', label: 'Unit (e.g. pcs, box)', type: 'text' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>{f.label}</label>
                  <input type={f.type} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={inputStyle} />
                </div>
              ))}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                  {CATEGORIES.slice(1).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Quantity in Stock</label>
                  <input type="number" min="0" value={form.quantity_in_stock}
                    onChange={e => setForm(p => ({ ...p, quantity_in_stock: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Reorder Level</label>
                  <input type="number" min="0" value={form.reorder_level}
                    onChange={e => setForm(p => ({ ...p, reorder_level: e.target.value }))}
                    style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Unit Cost (₹)</label>
                <input type="number" min="0" step="0.01" value={form.unit_cost}
                  onChange={e => setForm(p => ({ ...p, unit_cost: e.target.value }))}
                  style={inputStyle} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10 }}>
              <button onClick={handleSave} disabled={saving} style={{ ...btnStyle('#1d4999'), flex: 1, justifyContent: 'center' }}>
                {saving ? 'Saving...' : editItem ? 'Update Item' : 'Add Item'}
              </button>
              <button onClick={() => setShowDrawer(false)} style={{ ...btnStyle('#f1f5f9'), color: '#374151', flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>Adjust Stock</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>{adjustItem.name} — Current: <strong>{adjustItem.quantity_in_stock}</strong></p>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Quantity</label>
              <input type="number" min="1" value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Action</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['add', 'subtract'].map(a => (
                  <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '8px 16px', borderRadius: 8, border: `2px solid ${adjustAction === a ? '#6366f1' : '#e2e8f0'}`, background: adjustAction === a ? '#f0f0ff' : '#fff', fontSize: 14, fontWeight: 500 }}>
                    <input type="radio" name="adj_action" value={a} checked={adjustAction === a}
                      onChange={() => setAdjustAction(a)} style={{ display: 'none' }} />
                    <i className={`bi bi-${a === 'add' ? 'plus-circle' : 'dash-circle'}`} style={{ color: a === 'add' ? '#10b981' : '#ef4444' }} />
                    {a === 'add' ? 'Add Stock' : 'Subtract Stock'}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleAdjustConfirm} disabled={saving}
                style={{ ...btnStyle('#6366f1'), flex: 1, justifyContent: 'center' }}>
                {saving ? 'Saving...' : 'Confirm'}
              </button>
              <button onClick={() => setAdjustItem(null)}
                style={{ ...btnStyle('#f1f5f9'), color: '#374151', flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
