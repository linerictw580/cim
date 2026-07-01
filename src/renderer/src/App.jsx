import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ProjectsPage from './pages/ProjectsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const [page, setPage] = useState('projects')

  return (
    <div className="layout">
      <Sidebar page={page} onNavigate={setPage} />
      <main className="content">
        {page === 'projects' ? <ProjectsPage /> : <SettingsPage />}
      </main>
    </div>
  )
}
