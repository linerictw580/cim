// 專案自訂指令的解析與顯示工具（renderer 共用）
// 資料形狀：project.commands?: [{ id, name, command }]（name 可留空）

// 解析某專案在給定選擇下實際要執行的指令字串。
// 優先序：指定的 commandId 命中 → 專案第一個自訂指令（專案預設）→ 全域指令。
// 「有自訂就 override 全域」即由此體現：專案有 commands 時就不會落到 globalCommand。
export function resolveCommand(project, commandId, globalCommand) {
  const cmds = project?.commands || []
  if (commandId) {
    const hit = cmds.find((c) => c.id === commandId)
    if (hit) return hit.command
  }
  if (cmds.length > 0) return cmds[0].command
  return globalCommand
}

// 選單／標籤顯示文字：名稱優先，否則顯示指令內容。
export function commandLabel(cmd) {
  return (cmd?.name && cmd.name.trim()) || cmd?.command || ''
}
