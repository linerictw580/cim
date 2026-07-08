import { readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// 使用者層級 Claude 設定目錄（~/.claude）
export function claudeDir() {
  return join(homedir(), '.claude')
}

// v1 同步白名單：只有列在這裡的項目會被納入跨裝置同步。
// 採「白名單」而非「黑名單」——未列出者一律不碰，避免誤同步機密或執行期產物。
// merge: 'json' 表示該檔以鍵級 deep-merge 合併（shared base + 裝置 overlay），其餘為整檔/整目錄。
export const ALLOWLIST = [
  { key: 'CLAUDE.md', type: 'file', label: '全域指令 (CLAUDE.md)' },
  { key: 'settings.json', type: 'file', label: '設定 (settings.json)', merge: 'json' },
  { key: 'keybindings.json', type: 'file', label: '快捷鍵 (keybindings.json)' },
  { key: 'skills', type: 'dir', label: '技能 (skills/)' },
  { key: 'agents', type: 'dir', label: '子代理 (agents/)' },
  { key: 'commands', type: 'dir', label: '自訂指令 (commands/)' },
  { key: 'output-styles', type: 'dir', label: '輸出樣式 (output-styles/)' },
  { key: 'rules', type: 'dir', label: '規則 (rules/)' }
]

// 永不同步（含機密 / 機器特定 / 執行期狀態）。白名單機制下掃描本就不會納入這些，
// 此清單供文件與後續階段的防呆檢查參照。
// 註：~/.claude.json（含 OAuth token / trust / 使用者層級 MCP）位於 .claude 之外，
// 掃描不會觸及；MCP 同步留待 v2 再處理。
export const NEVER_SYNC = [
  '.credentials.json', // OAuth token
  'settings.local.json', // 個人本機覆寫
  'CLAUDE.local.md', // 個人本機指令
  'projects', // session 對話歷史
  'history',
  'history.jsonl',
  'todos',
  'shell-snapshots',
  'statsig'
]

// 掃描本機 ~/.claude，回報白名單各項目是否存在（唯讀，不寫入任何檔案）。
// 回傳 { claudeDir, items: [{ key, label, type, exists, childCount }] }。
// childCount 僅對存在的目錄計算（略過隱藏檔），供 UI 顯示「N 項」；檔案或不存在時為 null。
export function scanLocal() {
  const dir = claudeDir()
  const items = ALLOWLIST.map((entry) => {
    const full = join(dir, entry.key)
    let exists = false
    let childCount = null
    try {
      const st = statSync(full)
      exists = true
      if (st.isDirectory()) {
        try {
          childCount = readdirSync(full).filter((n) => !n.startsWith('.')).length
        } catch {
          childCount = null
        }
      }
    } catch {
      exists = false
    }
    return { key: entry.key, label: entry.label, type: entry.type, exists, childCount }
  })
  return { claudeDir: dir, items }
}
