import { useState, useRef, useEffect } from 'react'
import { TerminalIcon, PencilIcon, TrashIcon, ChevronDownIcon } from './icons'

export default function ProjectItem({ project, onOpen, onRename, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [windows, setWindows] = useState([]) // 可加 tab 的視窗群組
  const [wtAvailable, setWtAvailable] = useState(true)
  const menuRef = useRef(null)

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

  // 點選單外側時關閉執行選項選單
  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  // 展開選單前先查詢目前的視窗群組與 tab 能力
  const toggleMenu = async () => {
    if (!menuOpen) {
      const [caps, list] = await Promise.all([
        window.api.getTerminalCapabilities(),
        window.api.listTerminalWindows()
      ])
      setWtAvailable(caps.wtAvailable)
      setWindows(list)
    }
    setMenuOpen((v) => !v)
  }

  const run = (options) => {
    setMenuOpen(false)
    onOpen(project, options)
  }

  const clearWindows = async () => {
    await window.api.clearTerminalWindows()
    setWindows([])
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
        <div className="run-split" ref={menuRef}>
          <button
            className="icon-btn icon-btn--terminal run-split__main"
            title="開啟終端機並執行 claude"
            onClick={() => onOpen(project)}
          >
            <TerminalIcon />
          </button>
          <button
            className="icon-btn icon-btn--terminal run-split__caret"
            title="執行選項（新視窗 / 加到分頁）"
            onClick={toggleMenu}
          >
            <ChevronDownIcon />
          </button>
          {menuOpen && (
            <div className="run-menu">
              <button className="run-menu__item" onClick={() => run({ mode: 'new' })}>
                新視窗
              </button>
              {wtAvailable ? (
                windows.length > 0 && (
                  <>
                    <div className="run-menu__sep" />
                    {windows.map((w) => (
                      <button
                        key={w.id}
                        className="run-menu__item"
                        onClick={() => run({ mode: 'tab', windowId: w.id })}
                      >
                        加到分頁：{w.label}
                      </button>
                    ))}
                    <div className="run-menu__sep" />
                    <button
                      className="run-menu__item run-menu__item--dim"
                      onClick={clearWindows}
                    >
                      清除視窗清單
                    </button>
                  </>
                )
              ) : (
                <div className="run-menu__hint">分頁功能需 Windows Terminal</div>
              )}
            </div>
          )}
        </div>
        <button className="icon-btn" title="重新命名" onClick={() => setEditing(true)}>
          <PencilIcon />
        </button>
        <button className="icon-btn icon-btn--danger" title="移除" onClick={() => onRemove(project)}>
          <TrashIcon />
        </button>
      </div>
    </li>
  )
}
