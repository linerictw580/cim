import { useEffect, useState } from 'react'
import ComboCard from '../components/ComboCard'
import ConfirmDialog from '../components/ConfirmDialog'

// 啟動組合頁：列出使用者自定義的 combo，每個 combo 可一鍵啟動其下所有 group。
// 此階段提供 combo 外層 CRUD（新增 / 重新命名 / 刪除）；群組編輯與啟動於後續階段接上。
export default function CombosPage() {
  const [combos, setCombos] = useState([])
  const [projects, setProjects] = useState([]) // 供編輯時挑選加入群組
  const [loaded, setLoaded] = useState(false)
  const [pendingRemove, setPendingRemove] = useState(null) // 待確認刪除的 combo

  useEffect(() => {
    Promise.all([window.api.getCombos(), window.api.getProjects()]).then(([cs, ps]) => {
      setCombos(cs || [])
      setProjects(ps || [])
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
