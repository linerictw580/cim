import { useEffect, useState } from 'react'
import SyncPush from '../components/SyncPush'
import SyncPull from '../components/SyncPull'

// 跨裝置設定同步
// Stage 2：偵測系統 git、連線到私有 repo（clone / 初始化骨架 / 註冊本機裝置）。
// Stage 3：連線後可逐單元推送本機設定到 repo（共用 / 僅本機 / 不同步）。
// Stage 4：從 repo 拉取合併後 materialize 回本機 ~/.claude（覆寫前備份）。
export default function SyncPage() {
  const [status, setStatus] = useState(null)
  const [scan, setScan] = useState(null)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    const st = await window.api.syncGetStatus()
    setStatus(st)
    setRemoteUrl(st.remoteUrl || '')
    setDeviceId(st.deviceId || st.hostname || '')
  }

  useEffect(() => {
    load()
    window.api.syncScanLocal().then(setScan)
  }, [])

  if (!status) return null

  const handleConnect = async () => {
    setBusy(true)
    setError(null)
    const r = await window.api.syncConnect({ remoteUrl, deviceId })
    setBusy(false)
    if (!r.ok) return setError(r.error || '連線失敗')
    await load()
  }

  const handleDisconnect = async () => {
    setBusy(true)
    setError(null)
    await window.api.syncDisconnect()
    setBusy(false)
    await load()
  }

  const gitReady = status.git?.available

  return (
    <section className="page">
      <header className="page__header">
        <h1>同步</h1>
      </header>

      <div className="form">
        {/* ---- 連線 ---- */}
        {!gitReady ? (
          <div className="field">
            <span className="field__label">系統 git</span>
            <p className="field__hint field__hint--error">
              找不到系統 git。跨裝置同步以 git 為傳輸層，請先安裝 git 後回到此頁重試。
            </p>
            <button
              className="btn"
              onClick={() => window.api.openExternal('https://git-scm.com/download/win')}
            >
              前往下載 git
            </button>
          </div>
        ) : status.connected ? (
          <>
            <div className="field">
              <span className="field__label">同步 repo</span>
              <p className="field__hint sync-remote-url">
                <code>{status.remoteUrl}</code>
              </p>
            </div>
            <div className="field">
              <span className="field__label">裝置</span>
              <div className="import__tags">
                {status.devices.map((d) => (
                  <span
                    key={d.id}
                    className={`import__tag ${d.id === status.deviceId ? 'import__tag--added' : ''}`}
                  >
                    {d.label}
                    {d.id === status.deviceId ? '（本機）' : ''}
                  </span>
                ))}
              </div>
              <p className="field__hint">已連線。</p>
            </div>

            <SyncPush onChanged={load} />

            <SyncPull onChanged={load} />

            <div className="field">
              <button className="btn" disabled={busy} onClick={handleDisconnect}>
                {busy ? '處理中…' : '變更連線'}
              </button>
              <p className="field__hint">
                會移除本機的同步 repo 快取並清除連線設定（不影響遠端 repo 與 ~/.claude）。
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label className="field__label" htmlFor="sync-remote">
                私有 repo URL
              </label>
              <input
                id="sync-remote"
                className="field__input"
                placeholder="https://github.com/you/claude-config.git"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
              />
              <p className="field__hint">
                請先在 GitHub / GitLab 自建一個<strong>空的私有 repo</strong>，把 URL 貼在這裡。CIM
                會 clone 下來並初始化目錄結構；認證沿用你系統 git 既有設定。
              </p>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="sync-device">
                本機裝置名稱
              </label>
              <input
                id="sync-device"
                className="field__input"
                placeholder="workPC / homePC"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              />
              <p className="field__hint">
                用來區分不同裝置的設定，僅能含英數字、底線、點與連字號。
              </p>
            </div>
            {error && <p className="field__hint field__hint--error">{error}</p>}
            <div className="field">
              <button className="btn btn--primary" disabled={busy} onClick={handleConnect}>
                {busy ? '連線中…' : '連線並初始化'}
              </button>
            </div>
          </>
        )}

        {/* ---- 本機項目掃描（唯讀） ---- */}
        <div className="field">
          <span className="field__label">本機使用者層級設定</span>
          <p className="field__hint">
            偵測到的 <code>~/.claude</code> 可同步項目如下（機密與 <code>*.local</code>、session
            歷史永不納入）。
          </p>
          {scan &&
            (scan.items.some((i) => i.exists) ? (
              <ul className="sync-list">
                {scan.items.map((item) => (
                  <li
                    key={item.key}
                    className={`sync-list__row ${item.exists ? '' : 'is-absent'}`}
                  >
                    <span className="sync-list__name">
                      {item.label}
                      {item.type === 'dir' && item.exists && item.childCount != null && (
                        <span className="sync-list__count">· {item.childCount} 項</span>
                      )}
                    </span>
                    <span className={`sync-list__tag ${item.exists ? 'is-present' : ''}`}>
                      {item.exists ? '偵測到' : '未建立'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">尚未偵測到可同步的使用者層級設定。</p>
            ))}
        </div>
      </div>
    </section>
  )
}
