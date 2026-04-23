const MAP = {
  waiting: 'b-warning',
  called: 'b-info',
  in_service: 'b-primary',
  completed: 'b-success',
  skipped: 'b-muted',
  no_show: 'b-muted',
  cancelled: 'b-danger',
  normal: 'b-muted',
  elderly: 'b-warning',
  disabled: 'b-info',
  emergency: 'b-danger',
  kiosk: 'b-info',
  counter: 'b-primary',
  web: 'b-success',
  app: 'b-success',
  available: 'b-success',
  busy: 'b-warning',
  paused: 'b-muted',
  closed: 'b-danger',
}

export default function Badge({ children, variant }) {
  const cls = MAP[children] || MAP[variant] || 'b-muted'
  const label = String(children ?? '').replaceAll('_', ' ')
  return <span className={`badge ${cls}`}>{label}</span>
}
