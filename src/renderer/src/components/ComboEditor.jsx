import { useState } from 'react'
import Dropdown from './Dropdown'
import { commandLabel } from '../commands'

// combo 的展開編輯區：管理其下的 group 與成員。
// 所有異動都算出新的 combo 物件，透過 onChange 交給上層持久化（不自持狀態）。
// group 結構：{ id, name, projectIds: [], commandByProject?: { [projectId]: commandId } }
//   projectIds       成員（以 project.id 參照現有專案，順序即分頁順序）
//   commandByProject 每個成員選定的指令 id（挑自該專案自訂指令；缺省＝預設，即全域）
export default function ComboEditor({ combo, projects, onChange }) {
  // 目前展開「加入專案」挑選器的 group id（同時只開一個）
  const [pickerGroupId, setPickerGroupId] = useState(null)

  const groups = combo.groups || []
  const projById = new Map(projects.map((p) => [p.id, p]))

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
      groups.map((g) => {
        if (g.id !== gid) return g
        // 一併清掉該成員的指令選擇，避免殘留孤兒對照
        const { [pid]: _omit, ...rest } = g.commandByProject || {}
        return { ...g, projectIds: g.projectIds.filter((id) => id !== pid), commandByProject: rest }
      })
    )
  }

  // 設定成員要執行的指令（commandId 為空＝回到「預設」，刪除對照）
  const setMemberCommand = (gid, pid, commandId) => {
    update(
      groups.map((g) => {
        if (g.id !== gid) return g
        const map = { ...(g.commandByProject || {}) }
        if (commandId) map[pid] = commandId
        else delete map[pid]
        return { ...g, commandByProject: map }
      })
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
                {g.projectIds.map((pid, pi) => {
                  const proj = projById.get(pid)
                  const projCommands = proj?.commands || []
                  // 選定的指令 id；若已在專案端被刪除則退回顯示「預設」
                  const chosen = g.commandByProject?.[pid]
                  const chosenValue = projCommands.some((c) => c.id === chosen) ? chosen : ''
                  return (
                    <li key={pid} className="group-member">
                      <span className="group-member__name">
                        {proj ? (
                          proj.name
                        ) : (
                          <span className="group-member__missing">（已移除的專案）</span>
                        )}
                      </span>
                      <div className="group-member__right">
                        {projCommands.length > 0 && (
                          <Dropdown
                            value={chosenValue}
                            onChange={(v) => setMemberCommand(g.id, pid, v)}
                            title="選擇此成員要執行的指令"
                            align="right"
                            options={[
                              { value: '', label: '預設' },
                              ...projCommands.map((c) => ({ value: c.id, label: commandLabel(c) }))
                            ]}
                          />
                        )}
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
                      </div>
                    </li>
                  )
                })}
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
