import { useState } from 'react'
import { TerminalIcon, PencilIcon, TrashIcon } from './icons'

export default function ProjectItem({ project, onRename, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.name)

  const commit = () => {
    const name = draft.trim()
    if (name && name !== project.name) onRename(project.id, name)
    else setDraft(project.name)
    setEditing(false)
  }

  const cancel = () => {
    setDraft(project.name)
    setEditing(false)
  }

  return (
    <li className="project-item">
      <div className="project-item__main">
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
            className="project-item__name"
            title="雙擊重新命名"
            onDoubleClick={() => setEditing(true)}
          >
            {project.name}
          </span>
        )}
        <span className="project-item__path" title={project.path}>
          {project.path}
        </span>
      </div>

      <div className="project-item__actions">
        <button
          className="icon-btn icon-btn--terminal"
          title="開啟終端機並執行 claude（階段 4 啟用）"
          disabled
        >
          <TerminalIcon />
        </button>
        <button className="icon-btn" title="重新命名" onClick={() => setEditing(true)}>
          <PencilIcon />
        </button>
        <button
          className="icon-btn icon-btn--danger"
          title="移除"
          onClick={() => onRemove(project.id)}
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  )
}
