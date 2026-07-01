import { exec } from 'child_process'
import { homedir } from 'os'
import { openTerminalCommand } from './terminal'

// 檢查指令是否存在於 PATH。用 where 的 exit code 判斷（0=找到），
// 不解析輸出文字 —— 繁中 Windows 的錯誤訊息為 cp950 編碼，在 exec 下會變亂碼而無法比對
function commandExists(cmd) {
  return new Promise((resolve) => {
    exec(`where ${cmd}`, { timeout: 10000, windowsHide: true }, (err) => resolve(!err))
  })
}

// 查詢 Claude Code 認證狀態
// 回傳 { installed, loggedIn, email?, subscriptionType?, orgName?, error? }
export async function getAuthStatus() {
  // 先確認 claude 是否安裝；未安裝直接回報，避免落入需要解析（可能亂碼）錯誤訊息的路徑
  const installed = await commandExists('claude')
  if (!installed) return { installed: false, loggedIn: false }

  return new Promise((resolve) => {
    exec('claude auth status --json', { timeout: 15000, windowsHide: true }, (err, stdout) => {
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
