import { app } from 'electron'
import { exec } from 'child_process'
import { existsSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'

// 從 registry 讀取最新 PATH（Machine + User）並覆蓋 process.env.PATH。
// 解決：安裝 claude 後 registry User PATH 已更新，但 explorer / CIM 進程仍是舊 PATH 快照，
// 導致剛裝好的 claude 偵測不到（需登出/重開機才生效）。主動讀 registry 可繞過此快照。
// 注意：registry 的 Machine PATH 常含未展開的 %SystemRoot% 等，需 ExpandEnvironmentVariables
// 展開，否則塞進 process.env.PATH 會讓後續靠 PATH 的 spawn（如 powershell）找不到執行檔。
function refreshPath() {
  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -Command "[Environment]::ExpandEnvironmentVariables([Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User'))"`,
      { timeout: 10000, windowsHide: true },
      (err, stdout) => {
        const fresh = (stdout || '').trim()
        if (!err && fresh) process.env.PATH = fresh
        resolve()
      }
    )
  })
}

// 解析 claude 執行檔（先刷新 PATH 用 where 找；再退回原生安裝已知路徑）
// 回傳 { path, inPath }：inPath 表示是否從系統 PATH 找到（false = 已安裝但不在 PATH）
async function resolveClaude() {
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
  if (fromWhere) return { path: fromWhere, inPath: true }

  // 退回原生安裝的已知路徑（%USERPROFILE%\.local\bin），launcher 副檔名可能為
  // .exe / .cmd / .bat 或無副檔名，逐一檢查。找到但非來自 where = 不在 PATH。
  const binDir = join(homedir(), '.local', 'bin')
  for (const name of ['claude.exe', 'claude.cmd', 'claude.bat', 'claude']) {
    const p = join(binDir, name)
    if (existsSync(p)) return { path: p, inPath: false }
  }
  return { path: null, inPath: false }
}

// 查詢 Claude Code 認證狀態
// 回傳 { installed, loggedIn, inPath, email?, subscriptionType?, orgName?, error? }
export async function getAuthStatus() {
  const { path: claudePath, inPath } = await resolveClaude()
  if (!claudePath) return { installed: false, loggedIn: false, inPath: false }

  return new Promise((resolve) => {
    // 用引號包住的絕對路徑執行，避免 CIM 進程 PATH 尚未含 claude 時失敗
    exec(`"${claudePath}" auth status --json`, { timeout: 15000, windowsHide: true }, (err, stdout) => {
      // 未登入時仍會輸出 JSON（loggedIn:false），故優先解析 stdout
      const text = (stdout || '').trim()
      if (text) {
        try {
          const o = JSON.parse(text)
          resolve({ installed: true, loggedIn: !!o.loggedIn, inPath, ...o })
          return
        } catch {
          // 落到下方錯誤處理
        }
      }
      // 固定中文訊息，不回傳 raw stderr（可能為 cp950 亂碼）
      resolve({
        installed: true,
        loggedIn: false,
        inPath,
        error: '無法取得認證狀態，請點「重新檢查」或於終端執行 claude auth status'
      })
    })
  })
}

// 開啟終端機執行 claude auth login（互動式 OAuth，需在終端內完成）
// 用 start 保證開出可見視窗（Electron GUI 進程下 detached spawn 不一定開窗），
// 並把命令寫進暫存 .ps1 檔徹底避開引號問題，claude 以絕對路徑執行（不依賴 PATH）。
export async function login() {
  const claudePath = (await resolveClaude()).path || 'claude'

  let ps1Path
  try {
    ps1Path = join(app.getPath('userData'), 'claude-login.ps1')
    const script = `$host.UI.RawUI.WindowTitle = 'Claude 登入'\r\n& "${claudePath}" auth login\r\n`
    writeFileSync(ps1Path, script, 'utf8')
  } catch (err) {
    return { ok: false, error: `寫入登入腳本失敗：${err.message}` }
  }

  return new Promise((resolve) => {
    // exec 經 cmd 執行 start：start 會開出獨立可見的 powershell 視窗
    exec(
      `start "" powershell -NoExit -ExecutionPolicy Bypass -File "${ps1Path}"`,
      { windowsHide: true, cwd: homedir() },
      (err) => {
        if (err) resolve({ ok: false, error: err.message })
        else resolve({ ok: true })
      }
    )
  })
}

// 登出（非互動，直接清除認證）—— 同樣用絕對路徑，避免 PATH 尚未含 claude
export async function logout() {
  const claudePath = (await resolveClaude()).path || 'claude'
  return new Promise((resolve) => {
    exec(`"${claudePath}" auth logout`, { timeout: 15000, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ ok: !err, error: err ? (stderr || err.message).trim() : null })
    })
  })
}

// 把 claude 所在目錄加進「使用者」PATH（只改 User，不合併 Machine、不用 setx）
// 回傳 { ok, dir? , error? }。加完需重開終端才生效。
export async function addToPath() {
  const { path: claudePath } = await resolveClaude()
  if (!claudePath) return { ok: false, error: '找不到 claude 執行檔' }
  const dir = dirname(claudePath)

  // 單引號字串內放路徑（字面，不跳脫）；-notlike 檢查避免重複加入
  const script = [
    `$d='${dir}'`,
    `$p=[Environment]::GetEnvironmentVariable('Path','User')`,
    `if($p -notlike ('*'+$d+'*')){[Environment]::SetEnvironmentVariable('Path',($p.TrimEnd(';')+';'+$d),'User')}`
  ].join('; ')

  return new Promise((resolve) => {
    exec(
      `powershell -NoProfile -Command "${script}"`,
      { timeout: 15000, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) resolve({ ok: false, error: (stderr || err.message).trim() })
        else resolve({ ok: true, dir })
      }
    )
  })
}
