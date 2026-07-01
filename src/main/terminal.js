import { spawn } from 'child_process'
import store from './store'

// 依 shell 種類組出「設定視窗標題 + 執行指令並保持視窗開啟」的引數
function buildShellArgs(shell, command, title) {
  const name = shell
    .replace(/\.exe$/i, '')
    .split(/[\\/]/)
    .pop()
    .toLowerCase()

  if (name === 'cmd') {
    // cmd：用 title 指令設定標題；移除會破壞命令列的特殊字元
    const safeTitle = title.replace(/[&|<>^"%]/g, ' ')
    return ['/k', `title ${safeTitle} && ${command}`]
  }

  // powershell / pwsh：設定 WindowTitle 後執行指令（單引號字串內的 ' 需跳脫為 ''）
  const psTitle = title.replace(/'/g, "''")
  return ['-NoExit', '-Command', `$host.UI.RawUI.WindowTitle = '${psTitle}'; ${command}`]
}

// 在指定目錄開啟終端機並執行設定中的指令，標題以 title 命名
// 回傳 { ok: true } 或 { ok: false, error }
export function openTerminal(cwd, title) {
  const settings = store.get('settings')
  const shell = settings.shell || 'powershell'
  const command = settings.command || 'claude'
  const terminal = settings.terminal || 'wt'
  const name = title || cwd
  const args = buildShellArgs(shell, command, name)

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
        // Windows Terminal：-d 指定起始目錄，--title 明確設定分頁標題
        child = spawn('wt.exe', ['-d', cwd, '--title', name, shell, ...args], {
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
