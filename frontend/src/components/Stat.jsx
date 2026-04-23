export default function Stat({ icon, iconBg = '#fff0ed', iconColor = '#ff6b4a', value, label, hint }) {
  return (
    <div className="stat">
      <div className="icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      <div style={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
        <p className="value">{value}</p>
        <p className="label">{label}</p>
        {hint && <p className="text-xs text-muted mt-1" style={{ marginBottom: 0 }}>{hint}</p>}
      </div>
    </div>
  )
}
