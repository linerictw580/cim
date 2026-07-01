import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import LoginGate from './components/LoginGate'
import ProjectsPage from './pages/ProjectsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  const [page, setPage] = useState('projects')
  const [auth, setAuth] = useState(null) // null = 檢查中

  const refreshAuth = useCallback(async () => {
    const status = await window.api.getAuthStatus()
    setAuth(status)
    return status
  }, [])

  useEffect(() => {
    refreshAuth()
  }, [refreshAuth])

  const handleLogout = useCallback(async () => {
    await window.api.logout()
    await refreshAuth() // 登出後 loggedIn 變 false，自動退回 gate
  }, [refreshAuth])

  // 停在 gate（未登入 / 未安裝）時自動輪詢，偵測到登入完成即進入主畫面
  useEffect(() => {
    if (auth && !auth.loggedIn) {
      const timer = setInterval(refreshAuth, 3000)
      return () => clearInterval(timer)
    }
  }, [auth, refreshAuth])

  if (auth === null) {
    return (
      <div className="gate">
        <div className="gate__card">
          <div className="gate__logo">CIM</div>
          <p className="gate__text">檢查 Claude 登入狀態…</p>
        </div>
      </div>
    )
  }

  if (!auth.loggedIn) {
    return <LoginGate status={auth} onRefresh={refreshAuth} />
  }

  return (
    <div className="layout">
      <Sidebar page={page} onNavigate={setPage} />
      <main className="content">
        {page === 'projects' ? (
          <ProjectsPage auth={auth} onLogout={handleLogout} />
        ) : (
          <SettingsPage />
        )}
      </main>
    </div>
  )
}
