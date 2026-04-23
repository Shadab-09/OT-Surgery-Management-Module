import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Appointments, Visits, Doctors, Patients, Departments } from '../api/client'
import PageHeader from '../components/PageHeader'
import Stat from '../components/Stat'
import Badge from '../components/Badge'

export default function OPDToday() {
  const nav = useNavigate()
  const [appts, setAppts] = useState([])
  const [visits, setVisits] = useState([])
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [depts, setDepts] = useState([])
  const [walkin, setWalkin] = useState(null)

  const load = async () => {
    const [a, v, d, p, de] = await Promise.all([
      Appointments.today(),
      Visits.list({ page_size: 20, ordering: '-opened_at' }),
      Doctors.list({ page_size: 100 }),
      Patients.list({ page_size: 200 }),
      Departments.list({ page_size: 50 }),
    ])
    setAppts(a.data)
    setVisits(v.data.results || [])
    setDoctors(d.data.results || [])
    setPatients(p.data.results || [])
    setDepts(de.data.results || [])
  }
  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const stats = useMemo(() => {
    const byStatus = appts.reduce((m, a) => ({ ...m, [a.status]: (m[a.status] || 0) + 1 }), {})
    const openVisits = visits.filter(v => v.status === 'open').length
    const syncedToday = visits.filter(v => v.abdm_synced_at &&
      new Date(v.abdm_synced_at).toDateString() === new Date().toDateString()).length
    return { ...byStatus, openVisits, syncedToday, total: appts.length }
  }, [appts, visits])

  const checkIn = async (id) => { await Appointments.checkIn(id); load() }
  const startFromAppt = async (a) => {
    const r = await Visits.start({ appointment: a.id })
    nav(`/visits/${r.data.id}`)
  }

  const startWalkIn = async (e) => {
    e.preventDefault()
    try {
      const doctor = doctors.find(d => d.id === Number(walkin.doctor))
      const r = await Visits.start({
        patient: Number(walkin.patient),
        doctor: Number(walkin.doctor),
        department: doctor?.department || Number(walkin.department),
      })
      setWalkin(null)
      nav(`/visits/${r.data.id}`)
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not start walk-in visit')
    }
  }

  return (
    <>
      <PageHeader
        title="OPD Today"
        subtitle={`Live outpatient operations · ${new Date().toLocaleDateString()}`}
        actions={
          <>
            <Link className="btn" to="/appointments"><i className="bi bi-calendar-event" /> Appointments</Link>
            <button className="btn btn-primary" onClick={() =>
              setWalkin({ patient: patients[0]?.id || '', doctor: doctors[0]?.id || '', department: depts[0]?.id || '' })}>
              <i className="bi bi-person-plus" /> Walk-in Visit
            </button>
          </>
        }
      />

      <div className="grid grid-4 mb-4">
        <Stat icon={<i className="bi bi-calendar-check" />} iconBg="#fff0ed" iconColor="#ff6b4a"
          value={stats.total || 0} label="Appointments Today"
          hint={`${stats.scheduled || 0} scheduled · ${stats.checked_in || 0} waiting`} />
        <Stat icon={<i className="bi bi-hourglass-split" />} iconBg="#fef3c7" iconColor="#b45309"
          value={stats.checked_in || 0} label="Awaiting Consultation"
          hint={`${stats.in_consultation || 0} in progress`} />
        <Stat icon={<i className="bi bi-journal-medical" />} iconBg="#dbeafe" iconColor="#1e40af"
          value={stats.openVisits || 0} label="Open Visits" hint="Charting in progress" />
        <Stat icon={<i className="bi bi-cloud-check" />} iconBg="#d1fae5" iconColor="#065f46"
          value={stats.syncedToday || 0} label="ABDM Pushed Today" hint="FHIR bundles acknowledged" />
      </div>

      {walkin && (
        <div className="card mb-4">
          <div className="card-header">Start Walk-in Visit</div>
          <form onSubmit={startWalkIn} className="card-body">
            <div className="grid grid-3">
              <div className="form-row"><label>Patient *</label>
                <select required value={walkin.patient} onChange={e => setWalkin({ ...walkin, patient: e.target.value })}>
                  <option value="">—</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.mrn} — {p.full_name}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Doctor *</label>
                <select required value={walkin.doctor} onChange={e => setWalkin({ ...walkin, doctor: e.target.value })}>
                  <option value="">—</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name} · {d.department_code}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Department (fallback)</label>
                <select value={walkin.department} onChange={e => setWalkin({ ...walkin, department: e.target.value })}>
                  <option value="">—</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button type="submit" className="btn btn-primary">Start Visit</button>
              <button type="button" className="btn" onClick={() => setWalkin(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header">
            <span><i className="bi bi-calendar-event" /> Today's Appointments</span>
            <Link className="btn btn-sm" to="/appointments">View all</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {appts.slice(0, 10).map(a => (
                  <tr key={a.id}>
                    <td className="text-sm">{new Date(a.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{a.patient_name}<div className="text-xs text-muted">{a.patient_mrn}</div></td>
                    <td className="text-sm">Dr. {a.doctor_name}</td>
                    <td><Badge>{a.status}</Badge></td>
                    <td className="flex gap-2">
                      {a.status === 'scheduled' && (
                        <button className="btn btn-sm" onClick={() => checkIn(a.id)} title="Check-in">
                          <i className="bi bi-box-arrow-in-right" />
                        </button>
                      )}
                      {(a.status === 'checked_in' || a.status === 'scheduled') && (
                        <button className="btn btn-sm btn-primary" onClick={() => startFromAppt(a)} title="Start consultation">
                          <i className="bi bi-play-fill" />
                        </button>
                      )}
                      {a.status === 'in_consultation' && (
                        <Link className="btn btn-sm btn-primary" to={`/visits?appointment=${a.id}`} title="Open visit">
                          <i className="bi bi-journal-medical" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {appts.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 20 }}>No appointments today.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span><i className="bi bi-journal-medical" /> Recent Visits</span>
            <Link className="btn btn-sm" to="/visits">View all</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table>
              <thead><tr><th>Visit #</th><th>Patient</th><th>Doctor</th><th>Status</th><th>ABDM</th><th></th></tr></thead>
              <tbody>
                {visits.slice(0, 10).map(v => (
                  <tr key={v.id}>
                    <td className="font-600 text-sm">{v.visit_number}</td>
                    <td>{v.patient_name}</td>
                    <td className="text-sm">Dr. {v.doctor_name}</td>
                    <td><Badge>{v.status}</Badge></td>
                    <td className="text-xs">
                      {v.abdm_synced_at
                        ? <span className="badge b-success">acked</span>
                        : <span className="badge b-muted">—</span>}
                    </td>
                    <td>
                      <Link className="btn btn-sm btn-primary" to={`/visits/${v.id}`}>
                        <i className="bi bi-arrow-right-short" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {visits.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 20 }}>No visits yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span><i className="bi bi-diagram-3" /> OPD Workflow</span></div>
        <div className="card-body">
          <div className="grid grid-4">
            {[
              ['1', 'Book', 'Book appointment or walk-in', 'bi-calendar-plus'],
              ['2', 'Check-in', 'Patient arrives · queue token issued', 'bi-box-arrow-in-right'],
              ['3', 'Consult', 'Vitals · Dx · Rx · Labs', 'bi-clipboard2-pulse'],
              ['4', 'Close & Push', 'FHIR bundle → ABDM / Eka Care', 'bi-cloud-check'],
            ].map(([n, title, desc, icon]) => (
              <div key={n} className="stat">
                <div className="icon" style={{ background: '#fff0ed', color: '#ff6b4a' }}>
                  <i className={`bi ${icon}`} />
                </div>
                <div>
                  <p className="value" style={{ fontSize: '1rem' }}>{n}. {title}</p>
                  <p className="label" style={{ textTransform: 'none', letterSpacing: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
