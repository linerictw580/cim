import { useEffect, useState } from 'react'

// 推送本機設定到 repo（Stage 3）
// 逐「單元」（頂層檔案 / skills 等目錄的每個子項）指定 scope：共用 / 僅本機 / 不同步。
const SCOPES = [
  { key: 'shared', label: '共用' },
  { key: 'device', label: '僅本機' },
  { key: 'none', label: '不同步' }
]

export default function SyncPush({ onChanged }) {
  const [plan, setPlan] = useState(null)
  const [scopes, setScopes] = useState({}) // path -> scope
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)

  const load = async () => {
    const p = await window.api.syncGetPushPlan()
    setPlan(p)
    const init = {}
    p.units.forEach((u) => {
      init[u.path] = u.scope
    })
    setScopes(init)
  }

  useEffect(() => {
    load()
  }, [])

  if (!plan) return null

  const setScope = (path, scope) => setScopes((s) => ({ ...s, [path]: scope }))
  const setAll = (scope) => {
    const next = {}
    plan.units.forEach((u) => {
      next[u.path] = scope
    })
    setScopes(next)
  }

  const push = async () => {
    setBusy(true)
    setError(null)
    setMsg(null)
    const assignments = plan.units.map((u) => ({
      path: u.path,
      type: u.type,
      scope: scopes[u.path] || 'none'
    }))
    const r = await window.api.syncPush(assignments)
    setBusy(false)
    if (!r.ok) return setError(r.error || '推送失敗')
    setMsg(r.noChange ? '沒有變更需要推送。' : `已更新 repo（共用 / 本機 ${r.pushed} 項）。`)
    await load()
    onChanged && onChanged()
  }

  // 依 group（頂層 / skills / agents…）分組顯示
  const groups = []
  const byGroup = {}
  plan.units.forEach((u) => {
    const g = u.group || '__top'
    if (!byGroup[g]) {
      byGroup[g] = { key: g, label: u.groupLabel || '一般', units: [] }
      groups.push(byGroup[g])
    }
    byGroup[g].units.push(u)
  })

  const counts = plan.units.reduce(
    (acc, u) => {
      const s = scopes[u.path] || 'none'
      acc[s] = (acc[s] || 0) + 1
      return acc
    },
    { shared: 0, device: 0, none: 0 }
  )

  return (
    <div className="field">
      <span className="field__label">推送本機設定到 repo</span>
      <p className="field__hint">
        逐項選擇如何同步：<strong>共用</strong>（所有裝置）、<strong>僅本機</strong>（只有此裝置）、
        <strong>不同步</strong>。機密與 <code>*.local</code>、session 歷史永不納入。
      </p>

      {plan.units.length === 0 ? (
        <p className="empty">本機沒有可推送的設定項目。</p>
      ) : (
        <>
          <div className="scope-bulk">
            <span className="scope-bulk__label">全部設為：</span>
            {SCOPES.map((s) => (
              <button key={s.key} className="btn btn--sm" onClick={() => setAll(s.key)}>
                {s.label}
              </button>
            ))}
          </div>

          {groups.map((g) => (
            <div key={g.key} className="push-group">
              {g.key !== '__top' && <div className="push-group__title">{g.label}</div>}
              <ul className="sync-list">
                {g.units.map((u) => (
                  <li key={u.path} className="sync-list__row">
                    <span className="sync-list__name">{u.label}</span>
                    <div className="scope-seg">
                      {SCOPES.map((s) => (
                        <button
                          key={s.key}
                          className={`scope-seg__btn ${
                            (scopes[u.path] || 'none') === s.key ? 'is-active' : ''
                          }`}
                          onClick={() => setScope(u.path, s.key)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="push-actions">
            <button className="btn btn--primary" disabled={busy} onClick={push}>
              {busy ? '推送中…' : '推送到 repo'}
            </button>
            <span className="push-actions__summary">
              共用 {counts.shared}、僅本機 {counts.device}、不同步 {counts.none}
            </span>
          </div>
          {msg && <p className="field__hint">{msg}</p>}
          {error && <p className="field__hint field__hint--error">{error}</p>}
        </>
      )}
    </div>
  )
}
