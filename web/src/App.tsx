import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { UploadProject } from './pages/UploadProject'
import { ProjectView } from './pages/ProjectView'
import { LocalPreview } from './pages/LocalPreview'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadProject />} />
        <Route path="/p/:projectId" element={<ProjectView />} />
        <Route path="/local" element={<LocalPreview />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
