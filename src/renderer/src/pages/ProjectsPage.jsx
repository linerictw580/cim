import { useEffect, useMemo, useState } from 'react'
import ProjectItem from '../components/ProjectItem'
import ConfirmDialog from '../components/ConfirmDialog'
import ImportDialog from '../components/ImportDialog'
import Dropdown from '../components/Dropdown'

// 從絕對路徑取最後一段作為預設顯示名稱（相容 Windows \ 與 / 分隔）
function basename(p) {
  return p.split(/[\\/]/).filter(Boolean).pop() || p
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState(null)
  const [pendingRemove, setPendingRemove] = useState(null) // 待確認移除的專案
  const [importState, setImportState] = useState(null) // { parentDir, items } 或 null
  const [query, setQuery] = useState('') // 搜尋字串（依 scope 比對名稱或路徑）
  const [settings, setSettings] = useState(null) // 供讀寫排序偏好，寫入時保留其他欄位

  const sort = settings?.sort || 'manual' // 'manual' | 'name' | 'recent'
  const scope = settings?.searchScope || 'name' // 'name' | 'path'

  useEffect(() => {
    window.api.getProjects().then((list) => {
      setProjects(list || [])
      setLoaded(true)
    })
    window.api.getSettings().then(setSettings)
  }, [])

  // 過濾＋排序後的可見清單，並拆成「釘選」與「其他」兩組（釘選永遠置頂）
  // 搜尋只比對 scope 指定的單一欄位（名稱或路徑），避免另一欄位意外命中造成困惑
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = projects
    if (q) {
      list = list.filter((p) => (scope === 'path' ? p.path : p.name).toLowerCase().includes(q))
    }
    const sorted = [...list]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'recent') sorted.sort((a, b) => (b.lastRunAt || 0) - (a.lastRunAt || 0))
    return {
      pinned: sorted.filter((p) => p.pinned),
      rest: sorted.filter((p) => !p.pinned)
    }
  }, [projects, query, sort, scope])

  // 更新 state 並持久化
  const persist = (next) => {
    setProjects(next)
    window.api.setProjects(next)
  }

  const handleAdd = async () => {
    const path = await window.api.selectFolder()
    if (!path) return
    if (projects.some((p) => p.path === path)) return // 避免重複加入同一路徑
    const project = { id: crypto.randomUUID(), name: basename(path), path }
    persist([...projects, project])
  }

  // 選一個父目錄，掃描其下子資料夾後開啟批次匯入彈窗
  const handleBatchImport = async () => {
    const parentDir = await window.api.selectFolder()
    if (!parentDir) return
    const items = await window.api.scanSubProjects(parentDir)
    setImportState({ parentDir, items })
  }

  // 批次匯入彈窗確認：以 path 去重合併後持久化
  const confirmImport = (selectedItems) => {
    const existing = new Set(projects.map((p) => p.path))
    const added = selectedItems
      .filter((it) => !existing.has(it.path))
      .map((it) => ({ id: crypto.randomUUID(), name: it.name, path: it.path }))
    if (added.length > 0) persist([...projects, ...added])
    setImportState(null)
  }

  const handleRename = (id, name) => {
    persist(projects.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  const handlePin = (id) => {
    persist(projects.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)))
  }

  // 更新排序 / 搜尋範圍等清單偏好並持久化（保留 terminal/shell/command 等其他欄位）
  const patchSettings = (patch) => {
    if (!settings) return
    const next = { ...settings, ...patch }
    setSettings(next)
    window.api.setSettings(next)
  }

  const handleRemove = (project) => {
    setPendingRemove(project)
  }

  const confirmRemove = () => {
    persist(projects.filter((p) => p.id !== pendingRemove.id))
    setPendingRemove(null)
  }

  // options: { mode: 'new' | 'tab', windowId }；省略時後端預設開新視窗
  const handleOpen = async (project, options) => {
    setNotice(null)
    const res = await window.api.openTerminal(project.path, project.name, options)
    if (!res.ok) {
      setNotice(`「${project.name}」開啟終端機失敗：${res.error}`)
      return
    }
    // 蓋章最後啟動時間，供「最近啟動」排序使用
    persist(projects.map((p) => (p.id === project.id ? { ...p, lastRunAt: Date.now() } : p)))
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>專案</h1>
        <div className="page__header-actions">
          <button className="btn" onClick={handleBatchImport}>
            批次匯入
          </button>
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

      {loaded && projects.length === 0 ? (
        <div className="empty">尚未加入任何專案。點右上「新增」選擇資料夾。</div>
      ) : (
        <>
          <div className="list-toolbar">
            <Dropdown
              value={scope}
              onChange={(v) => patchSettings({ searchScope: v })}
              title="搜尋範圍"
              options={[
                { value: 'name', label: '名稱' },
                { value: 'path', label: '路徑' }
              ]}
            />
            <input
              className="list-toolbar__search"
              type="search"
              placeholder={`搜尋${scope === 'path' ? '路徑' : '名稱'}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Dropdown
              value={sort}
              onChange={(v) => patchSettings({ sort: v })}
              title="排序方式"
              align="right"
              options={[
                { value: 'manual', label: '加入順序' },
                { value: 'name', label: '名稱' },
                { value: 'recent', label: '最近啟動' }
              ]}
            />
          </div>

          {visible.pinned.length + visible.rest.length === 0 ? (
            <div className="empty">找不到符合「{query}」的專案。</div>
          ) : (
            <ul className="project-list">
              {visible.pinned.map((p) => (
                <ProjectItem
                  key={p.id}
                  project={p}
                  onOpen={handleOpen}
                  onRename={handleRename}
                  onRemove={handleRemove}
                  onPin={handlePin}
                />
              ))}
              {visible.pinned.length > 0 && visible.rest.length > 0 && (
                <li className="project-sep" aria-hidden="true" />
              )}
              {visible.rest.map((p) => (
                <ProjectItem
                  key={p.id}
                  project={p}
                  onOpen={handleOpen}
                  onRename={handleRename}
                  onRemove={handleRemove}
                  onPin={handlePin}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={pendingRemove !== null}
        title="移除專案"
        message={`確定要移除「${pendingRemove?.name}」嗎？此操作不會刪除實際資料夾。`}
        confirmText="移除"
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemove(null)}
      />

      {importState && (
        <ImportDialog
          parentDir={importState.parentDir}
          items={importState.items}
          existingPaths={new Set(projects.map((p) => p.path))}
          onConfirm={confirmImport}
          onCancel={() => setImportState(null)}
        />
      )}
    </section>
  )
}
