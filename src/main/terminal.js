import { spawn } from 'child_process'
import store from './store'

function shellName(shell) {
  return shell
    .replace(/\.exe$/i, '')
    .split(/[\\/]/)
    .pop()
    .toLowerCase()
}

// 純執行指令的 args（不設標題）。給 wt 模式用 —— 標題由 wt 的 --title 負責，
// 且 command 內不可含分號，否則會被 wt 當成開新分頁的分隔符。
function buildRunArgs(shell, command) {
  if (shellName(shell) === 'cmd') return ['/k', command]
  return ['-NoExit', '-Command', command]
}

// 執行指令並在 shell 內設定視窗標題。給傳統獨立視窗用（沒有外部 --title 機制）。
function buildRunArgsWithTitle(shell, command, title) {
  if (shellName(shell) === 'cmd') {
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

  return new Promise((resolve) => {
    let child
    try {
      if (terminal === 'window') {
        // 傳統獨立視窗：detached 讓子程序取得自己的 console 視窗，標題於 shell 內設定
        const args = buildRunArgsWithTitle(shell, command, name)
        child = spawn(shell, args, {
          cwd,
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        })
      } else {
        // Windows Terminal：-d 指定起始目錄，--title 設定分頁標題，command 保持無分號
        const args = buildRunArgs(shell, command)
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
