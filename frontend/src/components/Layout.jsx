import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const NAV = [
  {
    module: 'Overview',
    defaultOpen: true,
    items: [
      { to: '/', label: 'Dashboard', icon: 'bi-grid-1x2-fill', end: true },
      // { to: '/opd', label: 'OPD Today', icon: 'bi-clipboard2-pulse' }, // TEMP: OPD hidden
    ],
  },
  {
    module: 'Queue Management',
    defaultOpen: true,
    items: [
      { to: '/counter', label: 'Counter Service', icon: 'bi-person-badge' },
      { to: '/tokens', label: 'Tokens', icon: 'bi-ticket-perforated' },
      { to: '/kiosk', label: 'Kiosk Check-in', icon: 'bi-door-open', newTab: true },
      { to: '/display', label: 'Display Board', icon: 'bi-display', newTab: true },
    ],
  },
  // TEMP: Outpatient (OPD) section hidden — re-enable when OPD module is ready
  // {
  //   module: 'Outpatient (OPD)',
  //   defaultOpen: true,
  //   items: [
  //     { to: '/doctors', label: 'Doctors', icon: 'bi-person-vcard' },
  //     { to: '/appointments', label: 'Appointments', icon: 'bi-calendar-event' },
  //     { to: '/visits', label: 'Visits', icon: 'bi-journal-medical' },
  //   ],
  // },
  {
    module: 'Operation Theatre',
    defaultOpen: true,
    items: [
      { to: '/ot', label: 'OT Dashboard', icon: 'bi-hospital', end: true },
      { to: '/ot/schedule', label: 'OT Schedule', icon: 'bi-calendar3' },
      { to: '/ot/bookings/new', label: 'New Booking', icon: 'bi-plus-circle' },
      { to: '/ot/rooms', label: 'OT Rooms', icon: 'bi-door-closed' },
      { to: '/ot/team', label: 'Surgical Team', icon: 'bi-people' },
      { to: '/ot/inventory', label: 'OT Inventory', icon: 'bi-box-seam' },
    ],
  },
  {
    module: 'ABDM · Eka Care',
    defaultOpen: true,
    items: [
      { to: '/abha', label: 'ABHA Profiles', icon: 'bi-shield-check' },
      { to: '/health-records', label: 'Health Records', icon: 'bi-cloud-check' },
    ],
  },
  {
    module: 'Master Data',
    defaultOpen: false,
    items: [
      { to: '/departments', label: 'Departments', icon: 'bi-buildings' },
      { to: '/services', label: 'Services', icon: 'bi-gear' },
      { to: '/counters', label: 'Counters', icon: 'bi-box-arrow-in-right' },
      { to: '/patients', label: 'Patients', icon: 'bi-people' },
    ],
  },
  {
    module: 'Reports',
    defaultOpen: false,
    items: [
      { to: '/analytics', label: 'Analytics', icon: 'bi-bar-chart' },
      { to: '/notifications', label: 'Notifications', icon: 'bi-megaphone' },
    ],
  },
]

export default function Layout() {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const stored = localStorage.getItem('sidebar-open')
    return stored === null ? true : stored === 'true'
  })
  const [openSections, setOpenSections] = useState(() => {
    const stored = localStorage.getItem('sidebar-sections')
    if (stored) { try { return JSON.parse(stored) } catch {} }
    return Object.fromEntries(NAV.map(s => [s.module, s.defaultOpen]))
  })

  useEffect(() => { localStorage.setItem('sidebar-open', sidebarOpen) }, [sidebarOpen])
  useEffect(() => { localStorage.setItem('sidebar-sections', JSON.stringify(openSections)) }, [openSections])

  const toggleSidebar = () => setSidebarOpen(v => !v)
  const toggleSection = (m) => setOpenSections(s => ({ ...s, [m]: !s[m] }))

  const pageTitle = computeTitle(location.pathname)

  return (
    <div className="modern-layout">
      <aside className={`sidebar-modern ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header-modern">
          <div className="sidebar-logo">
            <img src="/logo.png" alt="AIIMS" className="logo-image" />
            <div className="logo-icon-collapsed">A</div>
          </div>
          <button className="sidebar-toggle-btn" onClick={toggleSidebar} title="Toggle sidebar">
            <i className={`bi ${sidebarOpen ? 'bi-chevron-double-left' : 'bi-chevron-double-right'}`} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(section => {
            const open = openSections[section.module] ?? section.defaultOpen
            return (
              <div key={section.module} className={`nav-section ${open ? '' : 'collapsed'}`}>
                <div className="nav-section-label" onClick={() => toggleSection(section.module)}>
                  <span>{section.module}</span>
                  <i className="bi bi-chevron-down chev" />
                </div>
                <div className="nav-section-items">
                  {section.items.map(it => (
                    it.newTab ? (
                      <a key={it.to} href={it.to} target="_blank" rel="noreferrer" className="nav-link">
                        <i className={`bi ${it.icon} nav-icon`} /><span>{it.label}</span>
                      </a>
                    ) : (
                      <NavLink key={it.to} to={it.to} end={it.end}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <i className={`bi ${it.icon} nav-icon`} /><span>{it.label}</span>
                      </NavLink>
                    )
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-modern">
            <div className="user-avatar-modern">A</div>
            <div className="user-info-modern">
              <div className="user-name-modern">Administrator</div>
              <div className="user-role-modern">Digital AIIMS</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-content-modern">
        <header className="top-header-modern">
          <div className="header-left">
            <h1 className="header-title">{pageTitle}</h1>
          </div>
          <div className="header-center">
            <div className="search-box">
              <i className="bi bi-search search-icon" />
              <input className="search-input" placeholder="Search patients, tokens, appointments…" />
            </div>
          </div>
          <div className="header-right">
            <a href="/kiosk" target="_blank" rel="noreferrer" className="header-icon-btn" title="Kiosk">
              <i className="bi bi-door-open" />
            </a>
            <a href="/display" target="_blank" rel="noreferrer" className="header-icon-btn" title="Display Board">
              <i className="bi bi-display" />
            </a>
            <button className="header-icon-btn" title="Notifications">
              <i className="bi bi-bell" />
              <span className="header-badge-dot" />
            </button>
            <div className="header-user">
              <i className="bi bi-person-circle" />
              <span>admin</span>
            </div>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
      </div>
    </div>
  )
}

function computeTitle(path) {
  if (path === '/') return 'Dashboard'
  if (path.startsWith('/opd')) return 'OPD Today'
  if (path.startsWith('/counter')) return 'Counter Service'
  if (path.startsWith('/tokens')) return 'Tokens'
  if (path.startsWith('/doctors')) return 'Doctors'
  if (path.startsWith('/appointments')) return 'Appointments'
  if (path.startsWith('/visits')) return 'Visits'
  if (path.startsWith('/ot/bookings/new')) return 'New OT Booking'
  if (path.startsWith('/ot/bookings/')) return 'OT Booking Detail'
  if (path.startsWith('/ot/schedule')) return 'OT Schedule'
  if (path.startsWith('/ot/rooms')) return 'OT Rooms'
  if (path.startsWith('/ot/team')) return 'Surgical Team'
  if (path.startsWith('/ot/inventory')) return 'OT Inventory'
  if (path.startsWith('/ot')) return 'OT Dashboard'
  if (path.startsWith('/abha')) return 'ABHA Profiles'
  if (path.startsWith('/health-records')) return 'Health Records'
  if (path.startsWith('/departments')) return 'Departments'
  if (path.startsWith('/services')) return 'Services'
  if (path.startsWith('/counters')) return 'Counters'
  if (path.startsWith('/patients')) return 'Patients'
  if (path.startsWith('/analytics')) return 'Analytics'
  if (path.startsWith('/notifications')) return 'Notifications'
  return 'Digital AIIMS'
}
