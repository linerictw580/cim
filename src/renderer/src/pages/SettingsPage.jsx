import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  if (!settings) return null

  // 更新單一欄位並即時持久化
  const update = (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    window.api.setSettings(next)
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
      </div>
    </section>
  )
}
