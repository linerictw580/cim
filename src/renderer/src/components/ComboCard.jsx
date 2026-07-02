import { useState } from 'react'
import { PencilIcon, TrashIcon, ChevronDownIcon, TerminalIcon } from './icons'
import ComboEditor from './ComboEditor'

// 單一啟動組合卡片：顯示名稱與群組數，可一鍵啟動、就地重新命名、展開編輯群組、刪除。
// 所有內容異動經由 onChange(nextCombo) 交上層持久化；onLaunch/onRemove 由上層處理。
export default function ComboCard({ combo, projects, onChange, onRemove, onLaunch }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(combo.name)
  const [expanded, setExpanded] = useState(false)

  const commit = () => {
    const name = draft.trim()
    if (name && name !== combo.name) onChange({ ...combo, name })
    else setDraft(combo.name)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(combo.name)
    setEditing(false)
  }

  const groupCount = combo.groups?.length || 0
  const hasLaunchable = (combo.groups || []).some((g) => g.projectIds.length > 0)

  return (
    <li className="combo-card">
      <div className="combo-card__head">
        <button
          className={`combo-card__toggle ${expanded ? 'is-open' : ''}`}
          title={expanded ? '收合' : '展開編輯'}
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDownIcon />
        </button>
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
          <button
            className="btn btn--primary combo-card__launch"
            title={hasLaunchable ? '啟動此組合的所有群組' : '此組合尚無可啟動的專案'}
            disabled={!hasLaunchable}
            onClick={() => onLaunch(combo)}
          >
            <TerminalIcon />
            啟動
          </button>
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

      {expanded && <ComboEditor combo={combo} projects={projects} onChange={onChange} />}
    </li>
  )
}
