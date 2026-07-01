import { useState } from 'react'

// 全畫面認證引導：未安裝 claude 或尚未登入時顯示
export default function LoginGate({ status, onRefresh }) {
  const [checking, setChecking] = useState(false)
  const notInstalled = !status.installed

  const handleLogin = async () => {
    await window.api.login() // 開終端執行 claude auth login
  }

  const handleRecheck = async () => {
    setChecking(true)
    await onRefresh()
    setChecking(false)
  }

  return (
    <div className="gate">
      <div className="gate__card">
        <div className="gate__logo">CIM</div>

        {notInstalled ? (
          <>
            <h1 className="gate__title">尚未安裝 Claude Code</h1>
            <p className="gate__text">請先安裝 Claude Code 才能使用本工具。可透過 npm 安裝：</p>
            <pre className="gate__code">npm install -g @anthropic-ai/claude-code</pre>
            <div className="gate__actions">
              <button className="btn btn--primary" onClick={handleRecheck} disabled={checking}>
                {checking ? '檢查中…' : '重新檢查'}
              </button>
            </div>
            <p className="gate__hint">安裝完成後點「重新檢查」。</p>
          </>
        ) : (
          <>
            <h1 className="gate__title">尚未登入 Claude</h1>
            <p className="gate__text">
              點「登入」會開啟終端機執行 <code>claude auth login</code>，請在終端內完成登入。
            </p>
            {status.error && <p className="gate__error">{status.error}</p>}
            <div className="gate__actions">
              <button className="btn btn--primary" onClick={handleLogin}>
                登入
              </button>
              <button className="btn" onClick={handleRecheck} disabled={checking}>
                {checking ? '檢查中…' : '重新檢查'}
              </button>
            </div>
            <p className="gate__hint">完成登入後會自動偵測並進入主畫面。</p>
          </>
        )}
      </div>
    </div>
  )
}
