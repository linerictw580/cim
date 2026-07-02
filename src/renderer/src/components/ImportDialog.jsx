import { useMemo, useState } from 'react'

// 批次匯入彈窗：顯示掃描到的子資料夾，勾選後一次加入
// props:
//   parentDir     父目錄路徑（顯示於標題）
//   items         [{ name, path, hasGit }]
//   existingPaths Set<string> 已在清單中的路徑（顯示為已加入且不可勾選）
//   onConfirm     (selectedItems) => void
//   onCancel      () => void
export default function ImportDialog({ parentDir, items, existingPaths, onConfirm, onCancel }) {
  const [onlyGit, setOnlyGit] = useState(true)
  // 預設勾選所有「含 git 且尚未加入」的項目
  const [selected, setSelected] = useState(
    () => new Set(items.filter((it) => it.hasGit && !existingPaths.has(it.path)).map((it) => it.path))
  )

  // 依 onlyGit 篩選要顯示的清單
  const visible = useMemo(
    () => (onlyGit ? items.filter((it) => it.hasGit) : items),
    [items, onlyGit]
  )
  // 目前可勾選（顯示中且尚未加入）的項目
  const selectable = useMemo(
    () => visible.filter((it) => !existingPaths.has(it.path)),
    [visible, existingPaths]
  )

  const toggle = (path) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const allSelected = selectable.length > 0 && selectable.every((it) => selected.has(it.path))
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) selectable.forEach((it) => next.delete(it.path))
      else selectable.forEach((it) => next.add(it.path))
      return next
    })
  }

  // 只匯入目前顯示中且被勾選的項目
  const chosen = visible.filter((it) => selected.has(it.path) && !existingPaths.has(it.path))

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">批次匯入</h2>
        <p className="modal__message">
          從 <code className="import__path">{parentDir}</code> 選擇要加入的專案。
        </p>

        <div className="import__toolbar">
          <label className="checkbox">
            <input type="checkbox" checked={onlyGit} onChange={(e) => setOnlyGit(e.target.checked)} />
            只顯示 git 專案
          </label>
          <button className="btn btn--sm" onClick={toggleAll} disabled={selectable.length === 0}>
            {allSelected ? '全不選' : '全選'}
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="import__empty">
            {onlyGit ? '此目錄下沒有 git 專案，可關閉上方篩選查看全部子資料夾。' : '此目錄下沒有子資料夾。'}
          </div>
        ) : (
          <ul className="import__list">
            {visible.map((it) => {
              const added = existingPaths.has(it.path)
              return (
                <li key={it.path} className={`import__row${added ? ' import__row--added' : ''}`}>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={added || selected.has(it.path)}
                      disabled={added}
                      onChange={() => toggle(it.path)}
                    />
                    <span className="import__name">{it.name}</span>
                  </label>
                  <span className="import__tags">
                    {it.hasGit && <span className="import__tag">git</span>}
                    {added && <span className="import__tag import__tag--added">已加入</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <div className="modal__actions">
          <button className="btn" onClick={onCancel}>
            取消
          </button>
          <button
            className="btn btn--primary"
            onClick={() => onConfirm(chosen)}
            disabled={chosen.length === 0}
          >
            匯入 {chosen.length} 個
          </button>
        </div>
      </div>
    </div>
  )
}
