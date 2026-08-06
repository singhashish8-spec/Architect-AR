import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { UploadProject } from './pages/UploadProject'
import { ProjectView } from './pages/ProjectView'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadProject />} />
        <Route path="/p/:projectId" element={<ProjectView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
