import { useState, useRef, useEffect } from 'react'
import { TerminalIcon, PencilIcon, TrashIcon, ChevronDownIcon, PinIcon } from './icons'

// 將最後執行時間戳格式化為相對時間；超過一週改顯示日期
function formatLastRun(ts) {
  const diff = Date.now() - ts
  const min = 60 * 1000
  const hr = 60 * min
  const day = 24 * hr
  if (diff < min) return '剛剛'
  if (diff < hr) return `${Math.floor(diff / min)} 分鐘前`
  if (diff < day) return `${Math.floor(diff / hr)} 小時前`
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
}

export default function ProjectItem({ project, onOpen, onRename, onRemove, onPin }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState(null) // fixed 定位座標，避免被 .content 的 overflow 裁切
  const [windows, setWindows] = useState([]) // 可加 tab 的視窗群組
  const [wtAvailable, setWtAvailable] = useState(true)
  const menuRef = useRef(null)
  const caretRef = useRef(null)

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

  // 點選單外側、捲動或改變視窗大小時關閉選單（fixed 定位在捲動後會與按鈕脫節）
  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    const close = () => setMenuOpen(false)
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('resize', close)
    // 捕捉階段監聽，才能收到 .content 容器的捲動
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [menuOpen])

  // 依 caret 位置與可用空間，計算選單向下或向上展開（fixed 定位，估算高度決定方向）
  const computeMenuStyle = (list, wt) => {
    const rect = caretRef.current.getBoundingClientRect()
    const itemH = 34
    const sepH = 9
    let est = 16 + itemH // 內距 +「新視窗」
    if (wt && list.length > 0) est += sepH + list.length * itemH + sepH + itemH
    if (!wt) est += 30
    const right = window.innerWidth - rect.right
    const spaceBelow = window.innerHeight - rect.bottom
    if (spaceBelow < est + 8 && rect.top > spaceBelow) {
      // 下方空間不足且上方較大 → 向上展開
      return { position: 'fixed', bottom: window.innerHeight - rect.top + 4, top: 'auto', right }
    }
    return { position: 'fixed', top: rect.bottom + 4, bottom: 'auto', right }
  }

  // 展開選單前先查詢目前的視窗群組與 tab 能力
  const toggleMenu = async () => {
    if (!menuOpen) {
      const [caps, list] = await Promise.all([
        window.api.getTerminalCapabilities(),
        window.api.listTerminalWindows()
      ])
      setWtAvailable(caps.wtAvailable)
      setWindows(list)
      setMenuStyle(computeMenuStyle(list, caps.wtAvailable))
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
          <div className="project-item__name-row">
            <span
              className="project-item__name"
              title="雙擊重新命名"
              onDoubleClick={() => setEditing(true)}
            >
              {project.name}
            </span>
            {project.lastRunAt != null && (
              <span
                className="project-item__time"
                title={`最後執行：${new Date(project.lastRunAt).toLocaleString()}`}
              >
                {formatLastRun(project.lastRunAt)}
              </span>
            )}
          </div>
        )}
        <span className="project-item__path" title={project.path}>
          {project.path}
        </span>
      </div>

      <div className="project-item__actions">
        <button
          className={`icon-btn ${project.pinned ? 'icon-btn--pinned' : ''}`}
          title={project.pinned ? '取消釘選' : '釘選'}
          onClick={() => onPin(project.id)}
        >
          <PinIcon filled={!!project.pinned} />
        </button>
        <div className="run-split" ref={menuRef}>
          <button
            className="icon-btn icon-btn--terminal run-split__main"
            title="開啟終端機並執行 claude"
            onClick={() => onOpen(project)}
          >
            <TerminalIcon />
          </button>
          <button
            ref={caretRef}
            className="icon-btn icon-btn--terminal run-split__caret"
            title="執行選項（新視窗 / 加到分頁）"
            onClick={toggleMenu}
          >
            <ChevronDownIcon />
          </button>
          {menuOpen && (
            <div className="run-menu" style={menuStyle}>
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
