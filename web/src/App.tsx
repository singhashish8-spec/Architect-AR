import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProjectView } from './pages/ProjectView'
import { LocalPreview } from './pages/LocalPreview'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminProjectList } from './pages/admin/AdminProjectList'
import { AdminNewProject } from './pages/admin/AdminNewProject'
import { AdminProjectPage } from './pages/admin/AdminProjectPage'
import { AdminProjectOverview } from './pages/admin/AdminProjectOverview'
import { AdminProjectModels } from './pages/admin/AdminProjectModels'
import { AdminProjectShare } from './pages/admin/AdminProjectShare'
import { AdminProjectSettings } from './pages/admin/AdminProjectSettings'

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
        {/* Multi-page admin, GitHub-repo style (owner's call 2026-08-09):
            a minimal project list, a project's own page reachable by
            clicking it (not a "Manage" button), and tabs within that
            page for the different things you'd do with a project. See
            docs/features/full-admin-dashboard.md. */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminProjectList />} />
          <Route path="new" element={<AdminNewProject />} />
          <Route path="p/:projectId" element={<AdminProjectPage />}>
            <Route index element={<AdminProjectOverview />} />
            <Route path="models" element={<AdminProjectModels />} />
            <Route path="share" element={<AdminProjectShare />} />
            <Route path="settings" element={<AdminProjectSettings />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
