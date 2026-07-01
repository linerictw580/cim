import { spawn } from 'child_process'
import store from './store'

// 依 shell 種類組出「執行指令後保持視窗開啟」的引數
function buildShellArgs(shell, command) {
  const name = shell
    .replace(/\.exe$/i, '')
    .split(/[\\/]/)
    .pop()
    .toLowerCase()
  if (name === 'cmd') return ['/k', command]
  // powershell / pwsh 及其他預設
  return ['-NoExit', '-Command', command]
}

// 在指定目錄開啟終端機並執行設定中的指令
// 回傳 { ok: true } 或 { ok: false, error }
export function openTerminal(cwd) {
  const settings = store.get('settings')
  const shell = settings.shell || 'powershell'
  const command = settings.command || 'claude'
  const terminal = settings.terminal || 'wt'
  const args = buildShellArgs(shell, command)

  return new Promise((resolve) => {
    let child
    try {
      if (terminal === 'window') {
        // 傳統獨立視窗：detached 讓子程序取得自己的 console 視窗
        child = spawn(shell, args, {
          cwd,
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        })
      } else {
        // Windows Terminal：用 -d 指定起始目錄
        child = spawn('wt.exe', ['-d', cwd, shell, ...args], {
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        })
      }
    } catch (err) {
      resolve({ ok: false, error: err.message })
      return
    }

    child.on('error', (err) => resolve({ ok: false, error: err.message }))
    child.on('spawn', () => {
      child.unref()
      resolve({ ok: true })
    })
  })
}
