// 專案自訂指令的解析與顯示工具（renderer 共用）
// 資料形狀：project.commands?: [{ id, name, command }]（name 可留空）

// 解析某專案在給定選擇下實際要執行的指令字串。
// 優先序：指定的 commandId 命中某自訂指令 → 該自訂指令；否則（含「預設」/未選/已失效）→ 全域指令。
// 即「預設＝全域」：自訂指令是明確挑選才會 override 全域。
export function resolveCommand(project, commandId, globalCommand) {
  const cmds = project?.commands || []
  if (commandId) {
    const hit = cmds.find((c) => c.id === commandId)
    if (hit) return hit.command
  }
  return globalCommand
}

// 選單／標籤顯示文字：名稱優先，否則顯示指令內容。
export function commandLabel(cmd) {
  return (cmd?.name && cmd.name.trim()) || cmd?.command || ''
}
