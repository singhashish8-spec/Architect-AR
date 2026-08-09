import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProjectView } from './pages/ProjectView'
import { LocalPreview } from './pages/LocalPreview'
import { AdminDashboard } from './pages/AdminDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Project creation moved entirely behind the admin passcode
            (Phase 3, owner's call 2026-08-09) -- there's no public
            creation page any more, so "/" just sends anyone who lands
            there to the one place project management actually happens.
            See docs/features/full-admin-dashboard.md. */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/p/:projectId" element={<ProjectView />} />
        <Route path="/local" element={<LocalPreview />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
