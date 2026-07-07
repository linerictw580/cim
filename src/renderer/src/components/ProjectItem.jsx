import { useState, useRef, useEffect } from 'react'
import { TerminalIcon, PencilIcon, TrashIcon, ChevronDownIcon, PinIcon } from './icons'
import { resolveCommand, commandLabel } from '../commands'

// 依觸發按鈕位置計算 fixed 選單樣式，右對齊觸發按鈕；下方空間不足且上方較大時向上展開。
// 用 fixed 定位是為了不被 .content 的 overflow 裁切（與 run-menu 同理）。
function fixedMenuStyle(triggerEl, estHeight) {
  const rect = triggerEl.getBoundingClientRect()
  const right = window.innerWidth - rect.right
  const spaceBelow = window.innerHeight - rect.bottom
  if (spaceBelow < estHeight + 8 && rect.top > spaceBelow) {
    return { position: 'fixed', bottom: window.innerHeight - rect.top + 4, top: 'auto', right }
  }
  return { position: 'fixed', top: rect.bottom + 4, bottom: 'auto', right }
}

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

export default function ProjectItem({
  project,
  globalCommand,
  onOpen,
  onRename,
  onRemove,
  onPin,
  onEditCommands
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.name)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState(null) // fixed 定位座標，避免被 .content 的 overflow 裁切
  const [windows, setWindows] = useState([]) // 可加 tab 的視窗群組
  const [wtAvailable, setWtAvailable] = useState(true)
  const [cmdMenuOpen, setCmdMenuOpen] = useState(false) // 指令選擇選單
  const [cmdMenuStyle, setCmdMenuStyle] = useState(null)
  const [activeCommandId, setActiveCommandId] = useState(null) // 目前作用中的指令（null＝專案預設）
  const menuRef = useRef(null)
  const caretRef = useRef(null)
  const cmdMenuRef = useRef(null)
  const cmdTriggerRef = useRef(null)

  // 此專案的自訂指令；effective＝目前作用中的自訂指令，null 代表「預設（全域）」
  const commands = project.commands || []
  const effective = commands.find((c) => c.id === activeCommandId) || null

  // 解析本次要執行的指令字串（未選自訂時為全域）
  const currentCommand = () => resolveCommand(project, activeCommandId, globalCommand)

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
  // 兩個選單（執行選項 / 指令選擇）共用同一組監聽
  useEffect(() => {
    if (!menuOpen && !cmdMenuOpen) return
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
      if (cmdMenuRef.current && !cmdMenuRef.current.contains(e.target)) setCmdMenuOpen(false)
    }
    const closeAll = () => {
      setMenuOpen(false)
      setCmdMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    window.addEventListener('resize', closeAll)
    // 捕捉階段監聽，才能收到 .content 容器的捲動
    window.addEventListener('scroll', closeAll, true)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('resize', closeAll)
      window.removeEventListener('scroll', closeAll, true)
    }
  }, [menuOpen, cmdMenuOpen])

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
      setCmdMenuOpen(false)
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

  // 執行時一律帶入目前作用中的指令（options 省略＝後端開新視窗）
  const run = (options) => {
    setMenuOpen(false)
    onOpen(project, options, currentCommand())
  }

  // 展開指令選單：估算高度後以 fixed 定位開啟（同時關閉執行選項選單）
  const toggleCmdMenu = () => {
    if (!cmdMenuOpen) {
      setMenuOpen(false)
      // 有自訂：預設 + 各自訂 + 編輯，另含兩條分隔線；無自訂：提示 + 新增
      const itemCount = commands.length > 0 ? commands.length + 2 : 2
      const est = 8 + itemCount * 32 + 18
      setCmdMenuStyle(fixedMenuStyle(cmdTriggerRef.current, est))
    }
    setCmdMenuOpen((v) => !v)
  }

  const openEditor = () => {
    setCmdMenuOpen(false)
    onEditCommands(project)
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
        <div className="cmd-select" ref={cmdMenuRef}>
          <button
            ref={cmdTriggerRef}
            type="button"
            className={`cmd-select__trigger ${effective ? 'cmd-select__trigger--custom' : ''}`}
            title="選擇 / 編輯此專案要執行的指令"
            onClick={toggleCmdMenu}
          >
            <span className="cmd-select__label">
              {commands.length === 0 ? '指令' : effective ? commandLabel(effective) : '預設'}
            </span>
            <ChevronDownIcon />
          </button>
          {cmdMenuOpen && (
            <div className="run-menu" style={cmdMenuStyle}>
              {commands.length > 0 ? (
                <>
                  <button
                    className={`run-menu__item ${!effective ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveCommandId(null)
                      setCmdMenuOpen(false)
                    }}
                  >
                    預設（{globalCommand}）
                  </button>
                  <div className="run-menu__sep" />
                  {commands.map((c) => (
                    <button
                      key={c.id}
                      className={`run-menu__item ${effective && c.id === effective.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setActiveCommandId(c.id)
                        setCmdMenuOpen(false)
                      }}
                    >
                      {commandLabel(c)}
                    </button>
                  ))}
                  <div className="run-menu__sep" />
                  <button className="run-menu__item run-menu__item--dim" onClick={openEditor}>
                    編輯指令…
                  </button>
                </>
              ) : (
                <>
                  <div className="run-menu__hint">目前使用全域：{globalCommand}</div>
                  <button className="run-menu__item" onClick={openEditor}>
                    ＋ 新增自訂指令…
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="run-split" ref={menuRef}>
          <button
            className="icon-btn icon-btn--terminal run-split__main"
            title={`開啟終端機並執行：${currentCommand() || globalCommand}`}
            onClick={() => onOpen(project, undefined, currentCommand())}
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
