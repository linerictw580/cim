import { useEffect, useState } from 'react'

// 跨裝置設定同步
// Stage 1（唯讀骨架）：只偵測並顯示本機 ~/.claude 的白名單項目，
// 不連 git、不寫入任何檔案。推送 / 拉取到私有 repo 於後續階段實作。
export default function SyncPage() {
  const [scan, setScan] = useState(null)

  useEffect(() => {
    window.api.syncScanLocal().then(setScan)
  }, [])

  if (!scan) return null

  const present = scan.items.filter((i) => i.exists)

  return (
    <section className="page">
      <header className="page__header">
        <h1>同步</h1>
      </header>

      <div className="form">
        <div className="field">
          <span className="field__label">本機使用者層級設定</span>
          <p className="field__hint">
            偵測到的 <code>~/.claude</code> 可同步項目如下。跨裝置同步（推送 / 拉取到私有 git
            repo）將於後續版本開放。
          </p>
        </div>

        <div className="field">
          {present.length === 0 ? (
            <p className="empty">尚未偵測到可同步的使用者層級設定。</p>
          ) : (
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
          )}
          <p className="field__hint">
            機密與機器特定檔案（<code>.credentials.json</code>、<code>settings.local.json</code>、
            <code>CLAUDE.local.md</code>、session 歷史等）永不納入同步。
          </p>
        </div>
      </div>
    </section>
  )
}
