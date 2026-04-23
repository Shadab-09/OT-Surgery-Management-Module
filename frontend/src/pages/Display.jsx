import { useEffect, useRef, useState } from 'react'
import { Departments, Tokens } from '../api/client'
import { LanguagePicker, useI18n } from '../i18n.jsx'

export default function Display() {
  const { t, announce, speechLocale, lang } = useI18n()
  const [departments, setDepartments] = useState([])
  const [dept, setDept] = useState('')
  const [data, setData] = useState({ now_serving: [], next_up: [], recently_completed: [], waiting_count: 0, priority_count: 0 })
  const spokenRef = useRef(new Set())

  useEffect(() => { Departments.list({ is_active: true }).then(r => {
    const list = r.data.results || r.data
    setDepartments(list)
    if (list.length) setDept(list[0].id)
  }) }, [])

  useEffect(() => {
    if (!dept) return
    const load = async () => {
      const { data } = await Tokens.live({ department: dept })
      setData(data)
      data.now_serving.forEach(tok => {
        const key = `${tok.id}-${tok.called_at}`
        if (spokenRef.current.has(key)) return
        if (!('speechSynthesis' in window)) return
        const phrase = tok.announcement || announce('announce.call', {
          token: tok.number,
          counter: tok.counter_name || '',
        })
        if (!phrase) return
        const u = new SpeechSynthesisUtterance(phrase)
        u.lang = speechLocale
        u.rate = 0.9
        window.speechSynthesis.speak(u)
        spokenRef.current.add(key)
      })
    }
    load()
    const h = setInterval(load, 4000)
    return () => clearInterval(h)
  }, [dept, lang, announce, speechLocale])

  // Re-speak the current "now serving" line when language changes so operators
  // can verify a switch in real time.
  useEffect(() => { spokenRef.current = new Set() }, [lang])

  const deptName = departments.find(d => d.id === +dept)?.name || ''

  return (
    <div className="board">
      <div className="flex-between">
        <div>
          <h1>{deptName || t('ui.now_serving', 'Queue Display')}</h1>
          <p className="subtitle">{t('ui.please_wait', 'Please wait for your turn')}</p>
        </div>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          <LanguagePicker
            style={{ padding: 10, borderRadius: 8, background: '#1e293b', color: 'white', border: '1px solid #334155' }}
          />
          <select value={dept} onChange={e => setDept(e.target.value)}
            style={{ padding: 10, borderRadius: 8, background: '#1e293b', color: 'white', border: '1px solid #334155' }}>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>

      <h3 style={{ marginTop: 20, color: '#94a3b8', fontSize: 13, textTransform: 'uppercase' }}>
        {t('ui.now_serving', 'Now Serving')}
      </h3>
      <div className="now-serving">
        {data.now_serving.length === 0 ? (
          [0, 1, 2].map(i => (
            <div key={i} className="now-card" style={{ opacity: 0.4 }}>
              <p className="num">---</p>
              <p className="sub">{t('ui.please_wait', 'Waiting for next call')}</p>
            </div>
          ))
        ) : (
          data.now_serving.slice(0, 3).map(tok => (
            <div key={tok.id} className="now-card">
              <p className="num">{tok.number}</p>
              <p className="sub">
                {t('ui.counter', 'Counter')}: {tok.counter_name || '—'}
              </p>
              <p className="sub" style={{ fontSize: 12, color: '#fbbf24' }}>
                {tok.priority !== 'normal'
                  ? `★ ${(tok.priority_label || tok.priority).toUpperCase()}`
                  : ''}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="next-up">
        <h3>{t('ui.up_next', 'Up Next')}</h3>
        {data.next_up.length === 0 ? (
          <p className="subtitle">{t('ui.queue_empty', 'Queue is empty.')}</p>
        ) : (
          <div className="next-list">
            {data.next_up.slice(0, 10).map(tok => (
              <div key={tok.id}
                className={`tok ${tok.priority !== 'normal' ? 'priority' : ''}`}
                title={tok.status_label || tok.status}>
                {tok.number}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 20, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
        {t('ui.total_waiting', 'Total waiting')}: <b style={{ color: 'white' }}>{data.waiting_count}</b> · {t('ui.priority_queue', 'Priority')}: <b style={{ color: '#fbbf24' }}>{data.priority_count}</b>
      </div>
    </div>
  )
}
