import { useEffect, useState } from 'react'

// 專案自訂指令編輯彈窗：管理 project.commands（[{ id, name, command }]）。
// name 可留空（留空時各處顯示 command 文字）；command 留空的列於儲存時捨棄。
// props:
//   project       目前編輯的專案（讀 name 與初始 commands）
//   globalCommand 全域預設指令（顯示於提示，作為未自訂時的 fallback）
//   onSave        (commands) => void  儲存清理後的指令清單
//   onCancel      () => void
export default function CommandsDialog({ project, globalCommand, onSave, onCancel }) {
  // 以現有 commands 複製為初始草稿（避免就地改動上層 state）
  const [rows, setRows] = useState(() =>
    (project.commands || []).map((c) => ({
      id: c.id,
      name: c.name || '',
      command: c.command || ''
    }))
  )

  // Esc 取消（比照其他彈窗）
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const addRow = () => setRows((r) => [...r, { id: crypto.randomUUID(), name: '', command: '' }])

  const patchRow = (id, patch) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  const removeRow = (id) => setRows((r) => r.filter((row) => row.id !== id))

  // 陣列內相鄰交換（dir: -1 上移 / +1 下移），越界則原樣返回（比照 ComboEditor）
  const move = (idx, dir) =>
    setRows((r) => {
      const j = idx + dir
      if (j < 0 || j >= r.length) return r
      const next = r.slice()
      ;[next[idx], next[j]] = [next[j], next[idx]]
      return next
    })

  const save = () => {
    // 捨棄 command 為空的列；name/command 前後空白去除
    const cleaned = rows
      .map((r) => ({ id: r.id, name: r.name.trim(), command: r.command.trim() }))
      .filter((r) => r.command)
    onSave(cleaned)
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">「{project.name}」自訂指令</h2>
        <p className="modal__message">
          設定此專案可執行的指令，執行時可挑選要跑哪一個。未新增任何指令時，執行會使用全域預設：
          <code className="import__path">{globalCommand}</code>
        </p>

        {rows.length === 0 ? (
          <div className="import__empty">尚無自訂指令，點下方「新增指令」建立一個。</div>
        ) : (
          <ul className="cmd-edit__list">
            {rows.map((row, i) => (
              <li key={row.id} className="cmd-edit__row">
                <div className="cmd-edit__fields">
                  <input
                    className="field__input cmd-edit__name"
                    placeholder="名稱（可留空）"
                    value={row.name}
                    onChange={(e) => patchRow(row.id, { name: e.target.value })}
                  />
                  <input
                    className="field__input cmd-edit__cmd"
                    placeholder="指令，如 claude --resume"
                    value={row.command}
                    onChange={(e) => patchRow(row.id, { command: e.target.value })}
                  />
                </div>
                <div className="cmd-edit__actions">
                  <button
                    className="icon-btn icon-btn--sm"
                    title="上移"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="icon-btn icon-btn--sm"
                    title="下移"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="icon-btn icon-btn--sm icon-btn--danger"
                    title="刪除"
                    onClick={() => removeRow(row.id)}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <button className="btn btn--sm cmd-edit__add" onClick={addRow}>
          + 新增指令
        </button>
        <p className="field__hint cmd-edit__note">
          第一個指令為此專案的預設。使用 Windows Terminal 時，指令請避免包含分號（;）。
        </p>

        <div className="modal__actions">
          <button className="btn" onClick={onCancel}>
            取消
          </button>
          <button className="btn btn--primary" onClick={save}>
            儲存
          </button>
        </div>
      </div>
    </div>
  )
}
