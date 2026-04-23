import { useEffect, useState } from 'react'
import { BsShieldCheck, BsPhone, BsArrowRepeat, BsCardImage } from 'react-icons/bs'
import { ABHA as API, Patients } from '../api/client'
import PageHeader from '../components/PageHeader'
import Badge from '../components/Badge'

export default function ABHAPage() {
  const [tab, setTab] = useState('profiles')
  const [profiles, setProfiles] = useState([])
  const [patients, setPatients] = useState([])

  const load = async () => setProfiles((await API.list({ page_size: 100 })).data.results || [])
  useEffect(() => {
    load()
    Patients.list({ page_size: 200 }).then(r => setPatients(r.data.results || []))
  }, [])

  return (
    <>
      <PageHeader title="ABHA · Ayushman Bharat Health Account"
        subtitle="Create, link and manage ABHA addresses via Eka Care (ABDM gateway)" />

      <div className="flex gap-2 mb-4">
        <button className={`btn ${tab === 'profiles' ? 'btn-primary' : ''}`} onClick={() => setTab('profiles')}><BsShieldCheck /> Linked Profiles</button>
        <button className={`btn ${tab === 'aadhaar' ? 'btn-primary' : ''}`} onClick={() => setTab('aadhaar')}><BsShieldCheck /> Create via Aadhaar</button>
        <button className={`btn ${tab === 'mobile' ? 'btn-primary' : ''}`} onClick={() => setTab('mobile')}><BsPhone /> Login via Mobile</button>
      </div>

      {tab === 'profiles' && <ProfilesTab profiles={profiles} reload={load} />}
      {tab === 'aadhaar' && <AadhaarTab patients={patients} reload={load} />}
      {tab === 'mobile' && <MobileTab patients={patients} />}
    </>
  )
}


function ProfilesTab({ profiles, reload }) {
  const [card, setCard] = useState(null)
  const refresh = async (id) => { await API.refresh(id); reload() }
  const showCard = async (p) => {
    const r = await API.card(p.id)
    setCard({ ...p, ...r.data })
  }

  return (
    <div className="card">
      <div className="card-body" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>ABHA Address</th><th>ABHA Number</th><th>Patient</th><th>Mobile</th><th>KYC</th><th>Linked at</th><th></th></tr></thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id}>
                <td className="font-bold">{p.abha_address}</td>
                <td className="text-sm">{p.abha_number}</td>
                <td>{p.patient_name}<div className="text-sm" style={{ color: '#64748b' }}>{p.patient_mrn}</div></td>
                <td className="text-sm">{p.mobile || '—'}</td>
                <td><Badge>{p.kyc_verified ? 'completed' : 'no_show'}</Badge></td>
                <td className="text-sm">{p.linked_at ? new Date(p.linked_at).toLocaleString() : '—'}</td>
                <td className="flex gap-2">
                  <button className="btn btn-sm" onClick={() => refresh(p.id)} title="Refresh from Eka Care"><BsArrowRepeat /></button>
                  <button className="btn btn-sm" onClick={() => showCard(p)} title="View ABHA card"><BsCardImage /></button>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && <tr><td colSpan={7} className="text-center" style={{ padding: 20, color: '#64748b' }}>No linked ABHA profiles yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {card && (
        <div className="card-body" style={{ borderTop: '1px solid #e2e8f0' }}>
          <div className="flex-between mb-2">
            <strong>ABHA Card — {card.abha_address}</strong>
            <button className="btn btn-sm" onClick={() => setCard(null)}>Close</button>
          </div>
          {card.card_base64 ? (
            <img src={`data:${card.mime || 'image/png'};base64,${card.card_base64}`} alt="ABHA card"
                 style={{ maxWidth: 320, border: '1px solid #cbd5e1', borderRadius: 8 }} />
          ) : <pre>{JSON.stringify(card, null, 2)}</pre>}
        </div>
      )}
    </div>
  )
}


function AadhaarTab({ patients, reload }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ patient: '', aadhaar: '', mobile: '', preferred_abha_address: '' })
  const [txn, setTxn] = useState(null)
  const [otp, setOtp] = useState('')
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')

  const sendOtp = async (e) => {
    e.preventDefault(); setErr('')
    try {
      const r = await API.aadhaarStart({ patient: Number(form.patient), aadhaar: form.aadhaar })
      setTxn(r.data); setStep(2)
    } catch (ex) { setErr(ex.response?.data?.detail || 'Failed to send OTP') }
  }

  const verify = async (e) => {
    e.preventDefault(); setErr('')
    try {
      const r = await API.aadhaarVerify({
        patient: Number(form.patient), txn_id: txn.txn_id, otp,
        mobile: form.mobile, preferred_abha_address: form.preferred_abha_address,
      })
      setResult(r.data); setStep(3); reload()
    } catch (ex) { setErr(ex.response?.data?.detail || 'OTP verification failed') }
  }

  return (
    <div className="card"><div className="card-header">Create ABHA via Aadhaar OTP</div>
    <div className="card-body">
      {step === 1 && (
        <form onSubmit={sendOtp}>
          <div className="grid grid-2">
            <div className="form-row"><label>Patient *</label>
              <select required value={form.patient} onChange={e => setForm({ ...form, patient: e.target.value })}>
                <option value="">—</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.mrn} — {p.full_name}</option>)}
              </select>
            </div>
            <div className="form-row"><label>Aadhaar (12 digits) *</label>
              <input required maxLength={12} value={form.aadhaar} onChange={e => setForm({ ...form, aadhaar: e.target.value.replace(/\D/g, '') })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Send Aadhaar OTP</button>
          <p className="text-sm mt-2" style={{ color: '#64748b' }}>
            Mock mode is active — use OTP <code>123456</code> on the next step.
          </p>
        </form>
      )}
      {step === 2 && (
        <form onSubmit={verify}>
          <p>OTP sent to <strong>{txn.sent_to}</strong> (txn {txn.txn_id})</p>
          <div className="grid grid-2">
            <div className="form-row"><label>OTP *</label>
              <input required value={otp} onChange={e => setOtp(e.target.value)} /></div>
            <div className="form-row"><label>Mobile to link</label>
              <input value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
            <div className="form-row" style={{ gridColumn: 'span 2' }}><label>Preferred ABHA address</label>
              <input placeholder="e.g. yourname@abdm" value={form.preferred_abha_address}
                onChange={e => setForm({ ...form, preferred_abha_address: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 mt-2">
            <button type="submit" className="btn btn-primary">Verify & Create ABHA</button>
            <button type="button" className="btn" onClick={() => setStep(1)}>Back</button>
          </div>
        </form>
      )}
      {step === 3 && result && (
        <div>
          <h3 style={{ marginTop: 0 }}>✓ ABHA created & linked</h3>
          <p><strong>ABHA address:</strong> {result.abha_address}</p>
          <p><strong>ABHA number:</strong> {result.abha_number}</p>
          <p><strong>KYC:</strong> {result.kyc_method} {result.kyc_verified && '· verified'}</p>
          <button className="btn" onClick={() => { setStep(1); setResult(null); setOtp(''); setTxn(null); }}>Enrol another</button>
        </div>
      )}
      {err && <p style={{ color: '#b91c1c' }}>{err}</p>}
    </div></div>
  )
}


function MobileTab({ patients }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ patient: '', mobile: '' })
  const [txn, setTxn] = useState(null)
  const [otp, setOtp] = useState('')
  const [addresses, setAddresses] = useState([])
  const [err, setErr] = useState('')

  const send = async (e) => {
    e.preventDefault(); setErr('')
    try {
      const r = await API.mobileStart({ patient: Number(form.patient), mobile: form.mobile })
      setTxn(r.data); setStep(2)
    } catch (ex) { setErr(ex.response?.data?.detail || 'Failed') }
  }
  const verify = async (e) => {
    e.preventDefault(); setErr('')
    try {
      const r = await API.mobileVerify({ patient: Number(form.patient), txn_id: txn.txn_id, otp })
      setAddresses(r.data.abha_addresses || []); setStep(3)
    } catch (ex) { setErr(ex.response?.data?.detail || 'Failed') }
  }

  return (
    <div className="card"><div className="card-header">Log in via mobile OTP</div>
      <div className="card-body">
        {step === 1 && (
          <form onSubmit={send}>
            <div className="grid grid-2">
              <div className="form-row"><label>Patient *</label>
                <select required value={form.patient} onChange={e => setForm({ ...form, patient: e.target.value })}>
                  <option value="">—</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.mrn} — {p.full_name}</option>)}
                </select>
              </div>
              <div className="form-row"><label>Mobile *</label>
                <input required value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} /></div>
            </div>
            <button className="btn btn-primary">Send OTP</button>
          </form>
        )}
        {step === 2 && (
          <form onSubmit={verify}>
            <p>OTP sent to <strong>{txn.sent_to}</strong></p>
            <div className="form-row"><label>OTP *</label><input required value={otp} onChange={e => setOtp(e.target.value)} /></div>
            <button className="btn btn-primary">Verify</button>
          </form>
        )}
        {step === 3 && (
          <div>
            <h3>ABHA addresses linked to this mobile:</h3>
            <ul>{addresses.map(a => <li key={a}><code>{a}</code></li>)}</ul>
            <button className="btn" onClick={() => { setStep(1); setOtp(''); setTxn(null); setAddresses([]) }}>Done</button>
          </div>
        )}
        {err && <p style={{ color: '#b91c1c' }}>{err}</p>}
      </div>
    </div>
  )
}
