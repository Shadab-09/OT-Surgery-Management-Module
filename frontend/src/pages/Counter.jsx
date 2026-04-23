import { useEffect, useState } from 'react'
import { BsArrowRight, BsCheckCircle, BsSkipForward, BsMegaphone, BsXCircle, BsPlayCircle } from 'react-icons/bs'
import { Counters, Tokens } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

function fmtSec(s) {
  if (s == null) return '—'
  const m = Math.floor(s / 60), sec = s % 60
  return m ? `${m}m ${sec}s` : `${sec}s`
}

export default function Counter() {
  const [counters, setCounters] = useState([])
  const [selected, setSelected] = useState(null)
  const [active, setActive] = useState(null)   // token at this counter
  const [queue, setQueue] = useState([])
  const [msg, setMsg] = useState('')

  const loadCounters = async () => {
    const r = await Counters.list()
    const list = r.data.results || r.data
    setCounters(list)
    if (!selected && list.length) setSelected(list[0].id)
  }

  const refresh = async () => {
    if (!selected) return
    const c = counters.find(c => c.id === +selected)
    if (!c) return
    const { data } = await Tokens.live({ department: c.department })
    setQueue(data.next_up)
    const mine = data.now_serving.find(t => t.counter === +selected)
    setActive(mine || null)
  }

  useEffect(() => { loadCounters() }, [])
  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [selected, counters.length])

  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }

  const callNext = async () => {
    try {
      const { data } = await Tokens.callNext(selected)
      if (data?.number) {
        setActive(data); flash(`Called ${data.number}`)
      } else flash('Queue is empty.')
    } catch (e) { flash('No token in queue.') }
    refresh()
  }
  const start = async () => { if (!active) return; await Tokens.start(active.id); refresh() }
  const complete = async () => {
    if (!active) return
    await Tokens.complete(active.id)
    setActive(null); flash('Service completed.'); refresh()
  }
  const recall = async () => { if (active) { await Tokens.recall(active.id); flash('Re-called.'); refresh() } }
  const skip = async () => {
    if (active) {
      await Tokens.skip(active.id); flash('Skipped.'); setActive(null); refresh()
    }
  }
  const cancel = async () => {
    if (active) {
      await Tokens.cancel(active.id); flash('Cancelled.'); setActive(null); refresh()
    }
  }

  const current = counters.find(c => c.id === +selected)

  return (
    <>
      <PageHeader
        title="Counter Service"
        subtitle="Call, serve and close tokens from your counter"
        actions={
          <select value={selected || ''} onChange={e => setSelected(e.target.value)} className="form-row"
                  style={{ padding: 8, border: '1px solid #cbd5e1', borderRadius: 6 }}>
            {counters.map(c => <option key={c.id} value={c.id}>{c.department_name} · {c.name}</option>)}
          </select>
        }
      />

      {msg && <div className="card" style={{ background: '#dbeafe', borderColor: '#1d4999' }}>
        <div className="card-body" style={{ padding: 10 }}>{msg}</div>
      </div>}

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header">
            <span>Active Token</span>
            {current && <Badge>{current.status}</Badge>}
          </div>
          <div className="card-body">
            {!active ? (
              <>
                <p className="text-muted">No active token. Click "Call Next" to serve the next patient.</p>
                <button className="btn btn-primary" onClick={callNext} disabled={!selected}>
                  <BsArrowRight /> Call Next
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', padding: '10px 0' }}>
                  <p className="text-muted text-sm" style={{ margin: 0 }}>NOW SERVING</p>
                  <p style={{ fontSize: 56, fontWeight: 800, margin: '4px 0', color: '#1d4999' }}>{active.number}</p>
                  <p style={{ margin: 0 }}>{active.patient_detail?.full_name || '—'}</p>
                  <p className="text-muted text-sm">{active.service_name} · <Badge>{active.priority}</Badge> · <Badge>{active.status}</Badge></p>
                  <p className="text-muted text-sm">Waited {fmtSec(active.wait_seconds)} · Re-calls: {active.skip_count}</p>
                </div>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {active.status === 'called' &&
                    <button className="btn btn-success" onClick={start}><BsPlayCircle /> Start Service</button>}
                  <button className="btn btn-success" onClick={complete}><BsCheckCircle /> Complete</button>
                  <button className="btn" onClick={recall}><BsMegaphone /> Re-call</button>
                  <button className="btn btn-warning" onClick={skip}><BsSkipForward /> Skip / Absent</button>
                  <button className="btn btn-danger" onClick={cancel}><BsXCircle /> Cancel</button>
                  <button className="btn btn-primary" onClick={callNext}><BsArrowRight /> Call Next</button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">Queue — Next Up</div>
          <div className="card-body" style={{ padding: 0 }}>
            {queue.length === 0 ? (
              <p className="text-muted" style={{ padding: 16 }}>Queue is empty.</p>
            ) : (
              <table>
                <thead><tr><th>#</th><th>Token</th><th>Patient</th><th>Priority</th><th>Waited</th></tr></thead>
                <tbody>
                  {queue.map((t, i) => (
                    <tr key={t.id}>
                      <td>{i + 1}</td>
                      <td className="font-bold">{t.number}</td>
                      <td>{t.patient_detail?.full_name || '—'}</td>
                      <td><Badge>{t.priority}</Badge></td>
                      <td className="text-sm">{fmtSec(t.wait_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
