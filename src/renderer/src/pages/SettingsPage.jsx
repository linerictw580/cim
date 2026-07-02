import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [settings, setSettings] = useState(null)
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [updateState, setUpdateState] = useState('idle') // idle | checking | latest | available | error
  const [updateMsg, setUpdateMsg] = useState(null)

  useEffect(() => {
    window.api.getSettings().then(setSettings)
    window.api.getAutoLaunch().then(setAutoLaunch)
  }, [])

  if (!settings) return null

  // 開機自動啟動：以 OS 回傳的實際狀態為準
  const toggleAutoLaunch = async (enabled) => {
    const applied = await window.api.setAutoLaunch(enabled)
    setAutoLaunch(applied)
  }

  // 更新單一欄位並即時持久化
  const update = (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    window.api.setSettings(next)
  }

  // 手動檢查更新：即時回饋檢查中 / 已是最新 / 發現新版 / 失敗
  const checkForUpdate = async () => {
    setUpdateState('checking')
    setUpdateMsg(null)
    const res = await window.api.checkForUpdate()
    if (res.status === 'available') {
      setUpdateState('available')
      setUpdateMsg(`發現新版本 v${res.version}，可於上方橫幅更新。`)
    } else if (res.status === 'latest') {
      setUpdateState('latest')
      setUpdateMsg('已是最新版本。')
    } else if (res.status === 'dev') {
      setUpdateState('latest')
      setUpdateMsg('開發模式不檢查更新。')
    } else {
      setUpdateState('error')
      setUpdateMsg(res.message || '檢查更新失敗，請稍後再試。')
    }
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>設定</h1>
      </header>

      <div className="form">
        <div className="field">
          <span className="field__label">終端機類型</span>
          <div className="radio-group">
            <label className="radio">
              <input
                type="radio"
                name="terminal"
                checked={settings.terminal === 'wt'}
                onChange={() => update({ terminal: 'wt' })}
              />
              Windows Terminal (wt.exe)
            </label>
            <label className="radio">
              <input
                type="radio"
                name="terminal"
                checked={settings.terminal === 'window'}
                onChange={() => update({ terminal: 'window' })}
              />
              傳統獨立視窗
            </label>
          </div>
          <p className="field__hint">
            Windows Terminal 需系統已安裝；若開啟失敗可改用傳統視窗。
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="shell">
            Shell 執行檔
          </label>
          <input
            id="shell"
            className="field__input"
            value={settings.shell}
            onChange={(e) => update({ shell: e.target.value })}
          />
          <p className="field__hint">預設 powershell，可改 pwsh、cmd 或完整路徑。</p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="command">
            啟動指令
          </label>
          <input
            id="command"
            className="field__input"
            value={settings.command}
            onChange={(e) => update({ command: e.target.value })}
          />
          <p className="field__hint">進入目錄後執行的指令，預設 claude。</p>
        </div>

        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={autoLaunch}
              onChange={(e) => toggleAutoLaunch(e.target.checked)}
            />
            開機時自動啟動 CIM
          </label>
          <p className="field__hint">
            登入 Windows 後自動開啟本工具；建議在安裝版啟用。
          </p>
        </div>

        <div className="field">
          <span className="field__label">軟體更新</span>
          <button
            className="btn"
            onClick={checkForUpdate}
            disabled={updateState === 'checking'}
          >
            {updateState === 'checking' ? '檢查中…' : '檢查更新'}
          </button>
          {updateMsg && (
            <p
              className={
                updateState === 'error' ? 'field__hint field__hint--error' : 'field__hint'
              }
            >
              {updateMsg}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
