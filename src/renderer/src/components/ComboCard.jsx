import { useState } from 'react'
import { PencilIcon, TrashIcon } from './icons'

// 單一啟動組合卡片：顯示名稱與群組數，可就地重新命名、刪除。
// 群組編輯與一鍵啟動於後續階段接上。
export default function ComboCard({ combo, onRename, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(combo.name)

  const commit = () => {
    const name = draft.trim()
    if (name && name !== combo.name) onRename(combo.id, name)
    else setDraft(combo.name)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(combo.name)
    setEditing(false)
  }

  const groupCount = combo.groups?.length || 0

  return (
    <li className="combo-card">
      <div className="combo-card__head">
        <div className="combo-card__title">
          {editing ? (
            <input
              className="project-item__input"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') cancel()
              }}
            />
          ) : (
            <span
              className="combo-card__name"
              title="雙擊重新命名"
              onDoubleClick={() => setEditing(true)}
            >
              {combo.name}
            </span>
          )}
          <span className="combo-card__meta">{groupCount} 個群組</span>
        </div>
        <div className="combo-card__actions">
          <button className="icon-btn" title="重新命名" onClick={() => setEditing(true)}>
            <PencilIcon />
          </button>
          <button
            className="icon-btn icon-btn--danger"
            title="刪除"
            onClick={() => onRemove(combo)}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </li>
  )
}
