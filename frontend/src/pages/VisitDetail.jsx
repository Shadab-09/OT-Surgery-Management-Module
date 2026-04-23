import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { BsPlusCircle, BsTrash, BsCheck2All, BsCloudUpload } from 'react-icons/bs'
import { Visits as API, HealthRecords } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

const RX_BLANK = { drug_name: '', strength: '', route: 'oral', frequency: 'OD', duration_days: 1, instructions: '' }

export default function VisitDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const [v, setV] = useState(null)
  const [vitals, setVitals] = useState({})
  const [dx, setDx] = useState({ kind: 'provisional', description: '', icd10_code: '', snomed_code: '' })
  const [notes, setNotes] = useState({ chief_complaints: '', history: '', examination: '', advice: '' })
  const [rxItems, setRxItems] = useState([])
  const [rxNotes, setRxNotes] = useState('')
  const [lab, setLab] = useState({ test_name: '', test_code: '', urgency: 'routine' })
  const [msg, setMsg] = useState('')

  const load = async () => {
    const r = await API.get(id); setV(r.data)
    setVitals(r.data.vitals || {})
    setNotes({
      chief_complaints: r.data.chief_complaints || '', history: r.data.history || '',
      examination: r.data.examination || '', advice: r.data.advice || '',
    })
    setRxItems(r.data.prescription?.items?.map(({ id, ...rest }) => rest) || [])
    setRxNotes(r.data.prescription?.notes || '')
  }
  useEffect(() => { load() }, [id])

  if (!v) return <p>Loading…</p>

  const readOnly = v.status === 'closed'
  const saveNotes = async () => {
    try { await API.update(id, notes); flash('notes saved'); load() }
    catch (e) { alert('Failed to save notes') }
  }
  const saveVitals = async () => { await API.setVitals(id, vitals); flash('vitals saved'); load() }
  const addDiagnosis = async () => { if (dx.description) { await API.addDiagnosis(id, dx); setDx({ ...dx, description: '', icd10_code: '', snomed_code: '' }); load() } }
  const saveRx = async () => { await API.setPrescription(id, { notes: rxNotes, items: rxItems }); flash('prescription saved'); load() }
  const addRxItem = () => setRxItems([...rxItems, { ...RX_BLANK }])
  const removeRxItem = (i) => setRxItems(rxItems.filter((_, idx) => idx !== i))
  const addLab = async () => { if (lab.test_name) { await API.addLabOrder(id, lab); setLab({ test_name: '', test_code: '', urgency: 'routine' }); load() } }
  const close = async () => {
    if (!confirm('Close visit and push to ABDM?')) return
    await API.close(id, true); flash('visit closed · ABDM push queued'); load()
  }
  const pushNow = async () => { const r = await HealthRecords.pushVisit(id); flash(`ABDM push · ${r.data.status}`); load() }

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500) }

  return (
    <>
      <PageHeader title={`Visit ${v.visit_number}`}
        subtitle={`${v.patient_name} · Dr. ${v.doctor_name} · opened ${new Date(v.opened_at).toLocaleString()}`}
        actions={<>
          <Link className="btn" to="/visits">← All visits</Link>
          {!readOnly && <button className="btn btn-success" onClick={close}><BsCheck2All /> Close & Push to ABDM</button>}
          {readOnly && <button className="btn btn-primary" onClick={pushNow}><BsCloudUpload /> Re-push to ABDM</button>}
        </>}
      />

      {msg && <div style={{ padding: 10, background: '#dcfce7', color: '#065f46', borderRadius: 6, marginBottom: 12 }}>{msg}</div>}
      <div className="flex gap-2 mb-4">
        <Badge>{v.status}</Badge>
        {v.abdm_synced_at && <Badge variant="completed">ABDM: synced</Badge>}
      </div>

      <div className="grid grid-2">
        <div className="card"><div className="card-header">Clinical Notes</div>
          <div className="card-body">
            <div className="form-row"><label>Chief complaints</label>
              <textarea disabled={readOnly} value={notes.chief_complaints} onChange={e => setNotes({ ...notes, chief_complaints: e.target.value })} rows={2} /></div>
            <div className="form-row"><label>History</label>
              <textarea disabled={readOnly} value={notes.history} onChange={e => setNotes({ ...notes, history: e.target.value })} rows={2} /></div>
            <div className="form-row"><label>Examination</label>
              <textarea disabled={readOnly} value={notes.examination} onChange={e => setNotes({ ...notes, examination: e.target.value })} rows={2} /></div>
            <div className="form-row"><label>Advice</label>
              <textarea disabled={readOnly} value={notes.advice} onChange={e => setNotes({ ...notes, advice: e.target.value })} rows={2} /></div>
            {!readOnly && <button className="btn btn-primary btn-sm" onClick={saveNotes}>Save notes</button>}
          </div>
        </div>

        <div className="card"><div className="card-header">Vitals</div>
          <div className="card-body">
            <div className="grid grid-2">
              {[
                ['temperature_c', 'Temp (°C)'], ['pulse_bpm', 'Pulse'],
                ['systolic_bp', 'Systolic'], ['diastolic_bp', 'Diastolic'],
                ['respiratory_rate', 'RR'], ['spo2', 'SpO₂ %'],
                ['height_cm', 'Height cm'], ['weight_kg', 'Weight kg'],
              ].map(([k, label]) => (
                <div className="form-row" key={k}><label>{label}</label>
                  <input disabled={readOnly} type="number" step="any" value={vitals[k] ?? ''} onChange={e => setVitals({ ...vitals, [k]: e.target.value })} />
                </div>
              ))}
            </div>
            <p className="text-sm" style={{ color: '#64748b' }}>BMI: {vitals.bmi ?? '—'}</p>
            {!readOnly && <button className="btn btn-primary btn-sm" onClick={saveVitals}>Save vitals</button>}
          </div>
        </div>
      </div>

      <div className="card mt-4"><div className="card-header">Diagnoses</div>
        <div className="card-body">
          <table>
            <thead><tr><th>Kind</th><th>Description</th><th>ICD-10</th><th>SNOMED</th></tr></thead>
            <tbody>
              {v.diagnoses.map(d => <tr key={d.id}><td><Badge>{d.kind}</Badge></td><td>{d.description}</td><td>{d.icd10_code || '—'}</td><td>{d.snomed_code || '—'}</td></tr>)}
            </tbody>
          </table>
          {!readOnly && (
            <div className="flex gap-2 mt-2">
              <select value={dx.kind} onChange={e => setDx({ ...dx, kind: e.target.value })}>
                <option value="provisional">Provisional</option><option value="final">Final</option><option value="differential">Differential</option>
              </select>
              <input placeholder="Description" value={dx.description} onChange={e => setDx({ ...dx, description: e.target.value })} style={{ flex: 1 }} />
              <input placeholder="ICD-10" value={dx.icd10_code} onChange={e => setDx({ ...dx, icd10_code: e.target.value })} style={{ width: 120 }} />
              <input placeholder="SNOMED" value={dx.snomed_code} onChange={e => setDx({ ...dx, snomed_code: e.target.value })} style={{ width: 120 }} />
              <button className="btn btn-primary btn-sm" onClick={addDiagnosis}><BsPlusCircle /></button>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-4"><div className="card-header">Prescription</div>
        <div className="card-body">
          <div className="form-row"><label>Rx notes</label>
            <input disabled={readOnly} value={rxNotes} onChange={e => setRxNotes(e.target.value)} />
          </div>
          <table>
            <thead><tr><th>Drug</th><th>Strength</th><th>Route</th><th>Freq</th><th>Days</th><th>Instructions</th><th></th></tr></thead>
            <tbody>
              {rxItems.map((it, i) => (
                <tr key={i}>
                  <td><input disabled={readOnly} value={it.drug_name} onChange={e => setRxItems(rxItems.map((x, j) => j === i ? { ...x, drug_name: e.target.value } : x))} /></td>
                  <td><input disabled={readOnly} value={it.strength} onChange={e => setRxItems(rxItems.map((x, j) => j === i ? { ...x, strength: e.target.value } : x))} style={{ width: 90 }} /></td>
                  <td><select disabled={readOnly} value={it.route} onChange={e => setRxItems(rxItems.map((x, j) => j === i ? { ...x, route: e.target.value } : x))}>
                    {['oral', 'iv', 'im', 'sc', 'topical', 'inhaled'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select></td>
                  <td><select disabled={readOnly} value={it.frequency} onChange={e => setRxItems(rxItems.map((x, j) => j === i ? { ...x, frequency: e.target.value } : x))}>
                    {['OD', 'BD', 'TDS', 'QID', 'HS', 'SOS', 'STAT'].map(f => <option key={f} value={f}>{f}</option>)}
                  </select></td>
                  <td><input disabled={readOnly} type="number" value={it.duration_days} onChange={e => setRxItems(rxItems.map((x, j) => j === i ? { ...x, duration_days: Number(e.target.value) } : x))} style={{ width: 60 }} /></td>
                  <td><input disabled={readOnly} value={it.instructions} onChange={e => setRxItems(rxItems.map((x, j) => j === i ? { ...x, instructions: e.target.value } : x))} /></td>
                  <td>{!readOnly && <button className="btn btn-sm btn-danger" onClick={() => removeRxItem(i)}><BsTrash /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!readOnly && (
            <div className="flex gap-2 mt-2">
              <button className="btn btn-sm" onClick={addRxItem}><BsPlusCircle /> Add drug</button>
              <button className="btn btn-primary btn-sm" onClick={saveRx}>Save prescription</button>
            </div>
          )}
        </div>
      </div>

      <div className="card mt-4"><div className="card-header">Lab / Investigations</div>
        <div className="card-body">
          <table>
            <thead><tr><th>Test</th><th>Code</th><th>Urgency</th><th>Status</th><th>Result</th></tr></thead>
            <tbody>
              {v.lab_orders.map(l => <tr key={l.id}><td>{l.test_name}</td><td>{l.test_code || '—'}</td><td>{l.urgency}</td><td><Badge>{l.status}</Badge></td><td>{l.result_value || '—'}</td></tr>)}
            </tbody>
          </table>
          {!readOnly && (
            <div className="flex gap-2 mt-2">
              <input placeholder="Test name" value={lab.test_name} onChange={e => setLab({ ...lab, test_name: e.target.value })} style={{ flex: 1 }} />
              <input placeholder="LOINC" value={lab.test_code} onChange={e => setLab({ ...lab, test_code: e.target.value })} style={{ width: 120 }} />
              <select value={lab.urgency} onChange={e => setLab({ ...lab, urgency: e.target.value })}>
                <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="stat">Stat</option>
              </select>
              <button className="btn btn-primary btn-sm" onClick={addLab}><BsPlusCircle /> Order</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
