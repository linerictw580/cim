import { exec } from 'child_process'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { openTerminalCommand } from './terminal'

// 從 registry 讀取最新 PATH（Machine + User）並覆蓋 process.env.PATH。
// 解決：安裝 claude 後 registry User PATH 已更新，但 explorer / CIM 進程仍是舊 PATH 快照，
// 導致剛裝好的 claude 偵測不到（需登出/重開機才生效）。主動讀 registry 可繞過此快照。
function refreshPath() {
  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`,
      { timeout: 10000, windowsHide: true },
      (err, stdout) => {
        const fresh = (stdout || '').trim()
        if (!err && fresh) process.env.PATH = fresh
        resolve()
      }
    )
  })
}

// 解析 claude 執行檔的完整路徑（先刷新 PATH，用 where 找；再退回原生安裝已知路徑）
async function resolveClaudePath() {
  await refreshPath()

  const fromWhere = await new Promise((resolve) => {
    exec('where claude', { timeout: 10000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(null)
      const first = (stdout || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)[0]
      resolve(first || null)
    })
  })
  if (fromWhere) return fromWhere

  // 退回原生安裝的已知路徑（%USERPROFILE%\.local\bin\claude.exe）
  const known = join(homedir(), '.local', 'bin', 'claude.exe')
  return existsSync(known) ? known : null
}

// 查詢 Claude Code 認證狀態
// 回傳 { installed, loggedIn, email?, subscriptionType?, orgName?, error? }
export async function getAuthStatus() {
  const claudePath = await resolveClaudePath()
  if (!claudePath) return { installed: false, loggedIn: false }

  return new Promise((resolve) => {
    // 用引號包住的絕對路徑執行，避免 CIM 進程 PATH 尚未含 claude 時失敗
    exec(`"${claudePath}" auth status --json`, { timeout: 15000, windowsHide: true }, (err, stdout) => {
      // 未登入時仍會輸出 JSON（loggedIn:false），故優先解析 stdout
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
      // 固定中文訊息，不回傳 raw stderr（可能為 cp950 亂碼）
      resolve({
        installed: true,
        loggedIn: false,
        error: '無法取得認證狀態，請點「重新檢查」或於終端執行 claude auth status'
      })
    })
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
