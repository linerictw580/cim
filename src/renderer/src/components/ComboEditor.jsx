import { useState } from 'react'

// combo 的展開編輯區：管理其下的 group 與成員。
// 所有異動都算出新的 combo 物件，透過 onChange 交給上層持久化（不自持狀態）。
// group 結構：{ id, name, projectIds: [] }；成員以 project.id 參照現有專案。
export default function ComboEditor({ combo, projects, onChange }) {
  // 目前展開「加入專案」挑選器的 group id（同時只開一個）
  const [pickerGroupId, setPickerGroupId] = useState(null)

  const groups = combo.groups || []
  const nameById = new Map(projects.map((p) => [p.id, p.name]))

  const update = (nextGroups) => onChange({ ...combo, groups: nextGroups })

  // 陣列內相鄰交換（dir: -1 上移 / +1 下移），越界則原樣返回
  const swap = (arr, idx, dir) => {
    const j = idx + dir
    if (j < 0 || j >= arr.length) return arr
    const next = arr.slice()
    ;[next[idx], next[j]] = [next[j], next[idx]]
    return next
  }

  const addGroup = () => {
    update([...groups, { id: crypto.randomUUID(), name: '', projectIds: [] }])
  }

  const removeGroup = (gid) => {
    if (pickerGroupId === gid) setPickerGroupId(null)
    update(groups.filter((g) => g.id !== gid))
  }

  const renameGroup = (gid, name) => {
    update(groups.map((g) => (g.id === gid ? { ...g, name } : g)))
  }

  const moveGroup = (idx, dir) => {
    update(swap(groups, idx, dir))
  }

  const addProject = (gid, pid) => {
    update(
      groups.map((g) =>
        g.id === gid && !g.projectIds.includes(pid)
          ? { ...g, projectIds: [...g.projectIds, pid] }
          : g
      )
    )
  }

  const removeProject = (gid, pid) => {
    update(
      groups.map((g) =>
        g.id === gid ? { ...g, projectIds: g.projectIds.filter((id) => id !== pid) } : g
      )
    )
  }

  const moveProject = (gid, idx, dir) => {
    update(groups.map((g) => (g.id === gid ? { ...g, projectIds: swap(g.projectIds, idx, dir) } : g)))
  }

  return (
    <div className="combo-editor">
      {groups.length === 0 && (
        <div className="combo-editor__empty">尚無群組。每個群組會開成一個終端機視窗。</div>
      )}

      {groups.map((g, gi) => {
        const available = projects.filter((p) => !g.projectIds.includes(p.id))
        return (
          <div key={g.id} className="group-box">
            <div className="group-box__head">
              <input
                className="project-item__input group-box__name"
                value={g.name}
                placeholder={`群組 ${gi + 1}（可命名）`}
                onChange={(e) => renameGroup(g.id, e.target.value)}
              />
              <div className="group-box__head-actions">
                <button
                  className="icon-btn icon-btn--sm"
                  title="上移群組"
                  disabled={gi === 0}
                  onClick={() => moveGroup(gi, -1)}
                >
                  ↑
                </button>
                <button
                  className="icon-btn icon-btn--sm"
                  title="下移群組"
                  disabled={gi === groups.length - 1}
                  onClick={() => moveGroup(gi, 1)}
                >
                  ↓
                </button>
                <button
                  className="icon-btn icon-btn--sm icon-btn--danger"
                  title="刪除群組"
                  onClick={() => removeGroup(g.id)}
                >
                  <span className="group-box__x">✕</span>
                </button>
              </div>
            </div>

            {g.projectIds.length === 0 ? (
              <div className="group-box__empty">尚未加入專案</div>
            ) : (
              <ul className="group-members">
                {g.projectIds.map((pid, pi) => (
                  <li key={pid} className="group-member">
                    <span className="group-member__name">
                      {nameById.get(pid) || <span className="group-member__missing">（已移除的專案）</span>}
                    </span>
                    <div className="group-member__actions">
                      <button
                        className="icon-btn icon-btn--sm"
                        title="上移"
                        disabled={pi === 0}
                        onClick={() => moveProject(g.id, pi, -1)}
                      >
                        ↑
                      </button>
                      <button
                        className="icon-btn icon-btn--sm"
                        title="下移"
                        disabled={pi === g.projectIds.length - 1}
                        onClick={() => moveProject(g.id, pi, 1)}
                      >
                        ↓
                      </button>
                      <button
                        className="icon-btn icon-btn--sm icon-btn--danger"
                        title="從群組移除"
                        onClick={() => removeProject(g.id, pid)}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {pickerGroupId === g.id ? (
              <div className="group-picker">
                {available.length === 0 ? (
                  <span className="group-picker__hint">所有專案都已加入此群組</span>
                ) : (
                  available.map((p) => (
                    <button
                      key={p.id}
                      className="group-picker__chip"
                      title={p.path}
                      onClick={() => addProject(g.id, p.id)}
                    >
                      + {p.name}
                    </button>
                  ))
                )}
                <button
                  className="group-picker__close"
                  onClick={() => setPickerGroupId(null)}
                >
                  完成
                </button>
              </div>
            ) : (
              <button
                className="btn btn--sm group-box__add"
                onClick={() => setPickerGroupId(g.id)}
              >
                + 加入專案
              </button>
            )}
          </div>
        )
      })}

      <button className="btn btn--sm combo-editor__add-group" onClick={addGroup}>
        + 新增群組
      </button>
    </div>
  )
}
