import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import LoginGate from './components/LoginGate'
import ProjectsPage from './pages/ProjectsPage'
import CombosPage from './pages/CombosPage'
import UsagePage from './pages/UsagePage'
import SyncPage from './pages/SyncPage'
import SettingsPage from './pages/SettingsPage'
import UpdateBanner from './components/UpdateBanner'

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

  // 系統匣「設定」等指令：主行程通知後切換分頁
  useEffect(() => {
    return window.api.onNavigate(setPage)
  }, [])

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
    <div className="app-shell">
      <UpdateBanner />
      <div className="layout">
        <Sidebar page={page} onNavigate={setPage} auth={auth} />
        <main className="content">
          {page === 'projects' && <ProjectsPage />}
          {page === 'combos' && <CombosPage />}
          {page === 'usage' && <UsagePage />}
          {page === 'sync' && <SyncPage />}
          {page === 'settings' && (
            <SettingsPage auth={auth} onLogout={handleLogout} onRefreshAuth={refreshAuth} />
          )}
        </main>
      </div>
    </div>
  )
}
