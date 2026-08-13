import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sections from './pages/Sections'
import Roster from './pages/Roster'
import DailyAttendance from './pages/DailyAttendance'
import MonthlyGrid from './pages/MonthlyGrid'
import CalendarSetup from './pages/CalendarSetup'
import Reports from './pages/Reports'

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/sections" element={<Protected><Sections /></Protected>} />
          <Route path="/sections/:sectionId/roster" element={<Protected><Roster /></Protected>} />
          <Route path="/attendance" element={<Protected><DailyAttendance /></Protected>} />
          <Route path="/grid" element={<Protected><MonthlyGrid /></Protected>} />
          <Route path="/calendar" element={<Protected><CalendarSetup /></Protected>} />
          <Route path="/reports" element={<Protected><Reports /></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
