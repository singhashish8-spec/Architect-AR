import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { UploadProject } from './pages/UploadProject'
import { ProjectView } from './pages/ProjectView'
import { LocalPreview } from './pages/LocalPreview'
import { AdminDashboard } from './pages/AdminDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadProject />} />
        <Route path="/p/:projectId" element={<ProjectView />} />
        <Route path="/local" element={<LocalPreview />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
