import { useEffect, useState } from 'react'

const RELEASES_URL = 'https://github.com/linerictw580/cim/releases/latest'

// 全域更新橫幅：偵測到新版時顯示。
// 安裝版：立即更新 → 下載（顯示進度）→ 下載完成自動安裝重啟。
// portable 版：只提供「前往下載」連結，不自動安裝。
export default function UpdateBanner() {
  const [update, setUpdate] = useState(null) // { version, portable } | null
  const [phase, setPhase] = useState('idle') // idle | downloading | downloaded | error
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsubscribe = window.api.onUpdateEvent(({ type, payload }) => {
      if (type === 'update-available') {
        setUpdate(payload)
        setDismissed(false)
        setPhase('idle')
      } else if (type === 'download-progress') {
        setPercent(payload?.percent ?? 0)
      } else if (type === 'update-downloaded') {
        // 下載完成 → 自動安裝並重啟（安裝版）
        setPhase('downloaded')
        window.api.installUpdate()
      }
    })
    // 進入 app 主動檢查一次（listener 已掛上，update-available 事件會被接到）
    window.api.checkForUpdate()
    return unsubscribe
  }, [])

  if (!update || dismissed) return null

  const handleUpdate = async () => {
    setPhase('downloading')
    setPercent(0)
    setError(null)
    const res = await window.api.downloadUpdate()
    if (res && res.ok === false && !res.portable) {
      setPhase('error')
      setError(res.error || '下載失敗')
    }
  }

  const handleGoDownload = () => window.api.openExternal(RELEASES_URL)

  return (
    <div className="update-banner">
      <div className="update-banner__body">
        <span className="update-banner__text">有新版本 v{update.version} 可以安裝</span>
        {phase === 'downloading' && (
          <span className="update-banner__progress">下載中… {percent}%</span>
        )}
        {phase === 'downloaded' && (
          <span className="update-banner__progress">下載完成，即將重新啟動安裝…</span>
        )}
        {phase === 'error' && <span className="update-banner__error">{error}</span>}
      </div>

      <div className="update-banner__actions">
        {update.portable ? (
          <button className="update-banner__btn" onClick={handleGoDownload}>
            前往下載
          </button>
        ) : (
          <button
            className="update-banner__btn"
            onClick={handleUpdate}
            disabled={phase === 'downloading' || phase === 'downloaded'}
          >
            {phase === 'downloading' || phase === 'downloaded' ? '更新中…' : '立即更新'}
          </button>
        )}
        {phase === 'idle' && (
          <button
            className="update-banner__close"
            onClick={() => setDismissed(true)}
            title="稍後再說"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
