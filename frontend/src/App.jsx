import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Kiosk from './pages/Kiosk'
import Counter from './pages/Counter'
import Display from './pages/Display'
import TokensPage from './pages/Tokens'
import Departments from './pages/Departments'
import Services from './pages/Services'
import CountersPage from './pages/CountersPage'
import Patients from './pages/Patients'
import AnalyticsPage from './pages/AnalyticsPage'
import NotificationsPage from './pages/NotificationsPage'
import DoctorsPage from './pages/Doctors'
import AppointmentsPage from './pages/Appointments'
import VisitsList from './pages/Visits'
import VisitDetail from './pages/VisitDetail'
import OPDToday from './pages/OPDToday'
import ABHAPage from './pages/ABHA'
import HealthRecordsPage from './pages/HealthRecords'
import OTDashboard from './pages/OT/OTDashboard'
import OTSchedule from './pages/OT/OTSchedule'
import OTBookingForm from './pages/OT/OTBookingForm'
import OTBookingDetail from './pages/OT/OTBookingDetail'
import OTRooms from './pages/OT/OTRooms'
import SurgicalTeam from './pages/OT/SurgicalTeam'
import OTInventory from './pages/OT/OTInventory'

export default function App() {
  return (
    <Routes>
      <Route path="/kiosk" element={<Kiosk />} />
      <Route path="/display" element={<Display />} />

      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="counter" element={<Counter />} />
        <Route path="tokens" element={<TokensPage />} />

        {/* OPD module */}
        <Route path="opd" element={<OPDToday />} />
        <Route path="doctors" element={<DoctorsPage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="visits" element={<VisitsList />} />
        <Route path="visits/:id" element={<VisitDetail />} />

        {/* ABDM / Eka Care module */}
        <Route path="abha" element={<ABHAPage />} />
        <Route path="health-records" element={<HealthRecordsPage />} />

        {/* OT Module */}
        <Route path="ot" element={<OTDashboard />} />
        <Route path="ot/schedule" element={<OTSchedule />} />
        <Route path="ot/bookings/new" element={<OTBookingForm />} />
        <Route path="ot/bookings/:id" element={<OTBookingDetail />} />
        <Route path="ot/rooms" element={<OTRooms />} />
        <Route path="ot/team" element={<SurgicalTeam />} />
        <Route path="ot/inventory" element={<OTInventory />} />

        <Route path="departments" element={<Departments />} />
        <Route path="services" element={<Services />} />
        <Route path="counters" element={<CountersPage />} />
        <Route path="patients" element={<Patients />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
      </Route>
    </Routes>
  )
}
