import { exec } from 'child_process'
import { homedir } from 'os'
import { openTerminalCommand } from './terminal'

// 判斷 exec 錯誤是否代表「找不到 claude 指令」（新電腦可能尚未安裝）
function isCommandNotFound(err, stderr) {
  if (!err) return false
  const msg = `${stderr || ''} ${err.message || ''}`.toLowerCase()
  // Windows cmd 找不到指令的 exit code 為 9009；訊息含 not recognized / 不是內部或外部命令
  return (
    err.code === 9009 ||
    err.code === 127 ||
    err.code === 'ENOENT' ||
    /not recognized|not found|不是內部或外部|無法辨識/.test(msg)
  )
}

// 查詢 Claude Code 認證狀態
// 回傳 { installed, loggedIn, email?, subscriptionType?, orgName?, error? }
export function getAuthStatus() {
  return new Promise((resolve) => {
    exec(
      'claude auth status --json',
      { timeout: 15000, windowsHide: true },
      (err, stdout, stderr) => {
        // 未登入時 exit code 可能非 0，但 stdout 仍有 JSON，故優先解析 stdout
        const text = (stdout || '').trim()
        if (text) {
          try {
            const o = JSON.parse(text)
            resolve({ installed: true, loggedIn: !!o.loggedIn, ...o })
            return
          } catch {
            // 落到下方錯誤處理
          }
        }
        if (isCommandNotFound(err, stderr)) {
          resolve({ installed: false, loggedIn: false })
          return
        }
        resolve({
          installed: true,
          loggedIn: false,
          error: (stderr || err?.message || '無法取得認證狀態').trim()
        })
      }
    )
  })
}

// 開啟終端機執行 claude auth login（互動式 OAuth，需在終端內完成）
export function login() {
  return openTerminalCommand(homedir(), 'Claude 登入', 'claude auth login')
}

// 登出（非互動，直接清除認證）
export function logout() {
  return new Promise((resolve) => {
    exec('claude auth logout', { timeout: 15000, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ ok: !err, error: err ? (stderr || err.message).trim() : null })
    })
  })
}
