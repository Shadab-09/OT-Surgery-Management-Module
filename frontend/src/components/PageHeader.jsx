export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header flex-between">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
