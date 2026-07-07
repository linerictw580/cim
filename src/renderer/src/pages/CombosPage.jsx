import { useEffect, useState } from 'react'
import ComboCard from '../components/ComboCard'
import ConfirmDialog from '../components/ConfirmDialog'
import { resolveCommand } from '../commands'

// 啟動組合頁：列出使用者自定義的 combo，每個 combo 可一鍵啟動其下所有 group。
// 此階段提供 combo 外層 CRUD（新增 / 重新命名 / 刪除）；群組編輯與啟動於後續階段接上。
export default function CombosPage() {
  const [combos, setCombos] = useState([])
  const [projects, setProjects] = useState([]) // 供編輯時挑選加入群組
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState(null) // 啟動結果提示
  const [pendingRemove, setPendingRemove] = useState(null) // 待確認刪除的 combo
  const [globalCommand, setGlobalCommand] = useState('claude') // 未自訂時的 fallback 指令

  useEffect(() => {
    Promise.all([
      window.api.getCombos(),
      window.api.getProjects(),
      window.api.getSettings()
    ]).then(([cs, ps, s]) => {
      setCombos(cs || [])
      setProjects(ps || [])
      setGlobalCommand(s?.command || 'claude')
      setLoaded(true)
    })
  }, [])

  // 更新 state 並持久化（整包覆寫，比照 ProjectsPage）
  const persist = (next) => {
    setCombos(next)
    window.api.setCombos(next)
  }

  const handleAdd = () => {
    const combo = { id: crypto.randomUUID(), name: '新組合', groups: [] }
    persist([...combos, combo])
  }

  // combo 內容異動（名稱 / 群組 / 成員）統一經此回寫
  const handleChange = (nextCombo) => {
    persist(combos.map((c) => (c.id === nextCombo.id ? nextCombo : c)))
  }

  const handleRemove = (combo) => {
    setPendingRemove(combo)
  }

  // 一鍵啟動：逐一群組解析成員（過濾已被刪除的專案）後呼叫 openGroup。
  // 每個有成員的群組開一個終端機視窗（WT 可用時為多分頁）。
  const handleLaunch = async (combo) => {
    setNotice(null)
    const byId = new Map(projects.map((p) => [p.id, p]))
    const groups = combo.groups || []
    let launched = 0
    let missing = 0
    const errors = []
    const launchedIds = new Set() // 成功啟動的專案 id，供蓋章 lastRunAt

    for (const g of groups) {
      const members = []
      const ids = []
      for (const pid of g.projectIds) {
        const p = byId.get(pid)
        if (p) {
          // 依成員選定的指令解析（未選/預設→全域）
          const command = resolveCommand(p, g.commandByProject?.[pid], globalCommand)
          members.push({ cwd: p.path, name: p.name, command })
          ids.push(pid)
        } else missing += 1
      }
      if (members.length === 0) continue
      launched += 1
      const res = await window.api.openGroup(members, g.name)
      if (res.ok) ids.forEach((id) => launchedIds.add(id))
      else errors.push(res.error)
    }

    // 蓋章最後啟動時間（僅成功啟動者），與專案頁單獨啟動一致
    if (launchedIds.size > 0) {
      const now = Date.now()
      const nextProjects = projects.map((p) =>
        launchedIds.has(p.id) ? { ...p, lastRunAt: now } : p
      )
      setProjects(nextProjects)
      window.api.setProjects(nextProjects)
    }

    if (launched === 0) {
      setNotice(`組合「${combo.name}」沒有可啟動的專案。`)
    } else if (errors.length > 0) {
      setNotice(`部分群組啟動失敗：${errors[0]}`)
    } else if (missing > 0) {
      setNotice(`已啟動，但略過了 ${missing} 個已被移除的專案。`)
    }
  }

  const confirmRemove = () => {
    persist(combos.filter((c) => c.id !== pendingRemove.id))
    setPendingRemove(null)
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>組合</h1>
        <div className="page__header-actions">
          <button className="btn btn--primary" onClick={handleAdd}>
            + 新增
          </button>
        </div>
      </header>

      {notice && (
        <div className="notice" role="alert">
          <span>{notice}</span>
          <button className="notice__close" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}

      {loaded && combos.length === 0 ? (
        <div className="empty">尚未建立任何組合。點右上「新增」建立一個。</div>
      ) : (
        <ul className="combo-list">
          {combos.map((c) => (
            <ComboCard
              key={c.id}
              combo={c}
              projects={projects}
              onChange={handleChange}
              onRemove={handleRemove}
              onLaunch={handleLaunch}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingRemove !== null}
        title="刪除組合"
        message={`確定要刪除組合「${pendingRemove?.name}」嗎？此操作不影響專案本身。`}
        confirmText="刪除"
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </section>
  )
}
