import { useEffect, useState } from 'react'
import ProjectItem from '../components/ProjectItem'

// 從絕對路徑取最後一段作為預設顯示名稱（相容 Windows \ 與 / 分隔）
function basename(p) {
  return p.split(/[\\/]/).filter(Boolean).pop() || p
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    window.api.getProjects().then((list) => {
      setProjects(list || [])
      setLoaded(true)
    })
  }, [])

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

  const handleRename = (id, name) => {
    persist(projects.map((p) => (p.id === id ? { ...p, name } : p)))
  }

  const handleRemove = (id) => {
    persist(projects.filter((p) => p.id !== id))
  }

  const handleOpen = async (project) => {
    setNotice(null)
    const res = await window.api.openTerminal(project.path)
    if (!res.ok) {
      setNotice(`「${project.name}」開啟終端機失敗：${res.error}`)
    }
  }

  return (
    <section className="page">
      <header className="page__header">
        <h1>專案</h1>
        <button className="btn btn--primary" onClick={handleAdd}>
          + 新增
        </button>
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
        <ul className="project-list">
          {projects.map((p) => (
            <ProjectItem
              key={p.id}
              project={p}
              onOpen={handleOpen}
              onRename={handleRename}
              onRemove={handleRemove}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
