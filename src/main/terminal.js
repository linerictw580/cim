import { spawn, spawnSync } from 'child_process'
import store from './store'

// ---- Windows Terminal 可用性偵測（首次查詢後快取）----
// tab 功能需 Windows Terminal 的 -w 具名視窗（1.7+）；偵測 wt.exe 是否在 PATH
let wtAvailableCache = null
function isWtAvailable() {
  if (wtAvailableCache !== null) return wtAvailableCache
  try {
    const res = spawnSync('where', ['wt.exe'], { windowsHide: true })
    wtAvailableCache = res.status === 0
  } catch {
    wtAvailableCache = false
  }
  return wtAvailableCache
}

// ---- 視窗群組（記憶體，app 關閉即清空）----
// 每個以「新視窗」開啟的 WT 視窗都給一個具名 id（cim-N），之後才能用 -w 加 tab
let windowSeq = 0
const windowGroups = [] // { id, label, createdAt }

// 供 renderer 列出目前可加 tab 的視窗
export function listWindowGroups() {
  return windowGroups.map((w) => ({ ...w }))
}

// 使用者手動關閉 WT 視窗後清單會失準，提供手動清除
export function clearWindowGroups() {
  windowGroups.length = 0
  return true
}

// 供 renderer 判斷是否顯示 tab 選項
export function getTerminalCapabilities() {
  return { wtAvailable: isWtAvailable() }
}

// 依 settings 產生 Windows Terminal「開新視窗」時的尺寸/最大化全域選項。
// 僅適用開新視窗（加分頁沿用既有視窗尺寸，故呼叫端在 tab 模式不使用此函式）。
// --size 為 欄數,列數（字元格，非像素）；--maximized 時忽略尺寸。
function wtWindowArgs(settings) {
  if (settings.termMaximized) return ['--maximized']
  const cols = Math.min(500, Math.max(20, Number(settings.termCols) || 120))
  const rows = Math.min(200, Math.max(10, Number(settings.termRows) || 30))
  return ['--size', `${cols},${rows}`]
}

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

// 在指定目錄開啟終端機並執行指定的 command，標題以 title 命名
// 依 settings 決定終端機類型與 shell。
// options.mode: 'new'（預設，開新具名視窗）| 'tab'（加到 options.windowId 指定的視窗）
// 僅在使用者選 Windows Terminal 且系統可用時支援 tab；否則一律 fallback 獨立新視窗。
// 回傳 { ok: true } 或 { ok: false, error }
export function openTerminalCommand(cwd, title, command, options = {}) {
  const settings = store.get('settings')
  const shell = settings.shell || 'powershell'
  const terminal = settings.terminal || 'wt'
  const name = title || cwd
  const mode = options.mode === 'tab' ? 'tab' : 'new'
  // 只有選 wt 且系統確實有 wt.exe 才走具名視窗/tab 路徑，其餘一律獨立視窗
  const useWt = terminal === 'wt' && isWtAvailable()

  return new Promise((resolve) => {
    let child
    // 若本次新建了視窗群組，spawn 失敗時需回收，避免幽靈群組
    let createdGroupId = null
    try {
      if (!useWt) {
        // 傳統獨立視窗（conhost 或無 wt 的 fallback）：不支援 tab，忽略 mode
        const args = buildRunArgsWithTitle(shell, command, name)
        child = spawn(shell, args, {
          cwd,
          detached: true,
          stdio: 'ignore',
          windowsHide: false
        })
      } else {
        // Windows Terminal：-w <id> 指定目標視窗，new-tab 於該視窗開新分頁
        // -d 起始目錄，--title 分頁標題，--suppressApplicationTitle 鎖定標題不被改寫
        const runArgs = buildRunArgs(shell, command)
        let windowId
        let winArgs = [] // 尺寸/全螢幕全域選項；僅開新視窗時套用
        if (mode === 'tab' && options.windowId) {
          windowId = options.windowId
        } else {
          // 新視窗：建立具名視窗群組，之後才能用同一 id 加 tab
          windowSeq += 1
          windowId = `cim-${windowSeq}`
          windowGroups.push({ id: windowId, label: name, createdAt: Date.now() })
          createdGroupId = windowId
          winArgs = wtWindowArgs(settings)
        }
        child = spawn(
          'wt.exe',
          [
            '-w',
            windowId,
            ...winArgs,
            'new-tab',
            '-d',
            cwd,
            '--title',
            name,
            '--suppressApplicationTitle',
            shell,
            ...runArgs
          ],
          {
            detached: true,
            stdio: 'ignore',
            windowsHide: false
          }
        )
      }
    } catch (err) {
      resolve({ ok: false, error: err.message })
      return
    }

    child.on('error', (err) => {
      // wt.exe 意外不存在（偵測誤判）時回收剛建立的群組
      if (createdGroupId) {
        const i = windowGroups.findIndex((w) => w.id === createdGroupId)
        if (i >= 0) windowGroups.splice(i, 1)
      }
      resolve({ ok: false, error: err.message })
    })
    child.on('spawn', () => {
      child.unref()
      resolve({ ok: true })
    })
  })
}

// 開啟專案終端：執行 settings 中設定的預設指令（預設 claude）
// options 轉傳給 openTerminalCommand（mode / windowId）
export function openTerminal(cwd, title, options) {
  const command = store.get('settings').command || 'claude'
  return openTerminalCommand(cwd, title, command, options)
}

// 群組未命名時，用成員名稱自動組出視窗標籤（過長截斷）
function autoGroupLabel(members) {
  const joined = members.map((m) => m.name).join(', ')
  return joined.length > 40 ? `${joined.slice(0, 39)}…` : joined
}

// 啟動一個群組：成員 members = [{ cwd, name }]，每個成員跑 settings 的預設指令。
// Windows Terminal 可用時：開「單一具名視窗」，成員各為一個分頁（單一 wt.exe 呼叫，
// 以 ';' token 串接多個 new-tab），並登記一筆 windowGroups（label 為 groupLabel 或自動標籤），
// 使該視窗出現在專案列表的「加到分頁」選單。
// 否則 fallback：每個成員各開一個獨立視窗（無分頁能力）。
// 回傳 { ok: true } 或 { ok: false, error }
export async function openGroup(members, groupLabel) {
  const list = (members || []).filter((m) => m && m.cwd)
  if (list.length === 0) return { ok: true }

  const settings = store.get('settings')
  const shell = settings.shell || 'powershell'
  const command = settings.command || 'claude'
  const terminal = settings.terminal || 'wt'
  const useWt = terminal === 'wt' && isWtAvailable()

  if (!useWt) {
    // fallback：逐一開獨立視窗，任一失敗即回報第一個錯誤
    for (const m of list) {
      const res = await openTerminalCommand(m.cwd, m.name || m.cwd, command)
      if (!res.ok) return res
    }
    return { ok: true }
  }

  // Windows Terminal：單一具名視窗多分頁
  const label = (groupLabel && groupLabel.trim()) || autoGroupLabel(list)
  windowSeq += 1
  const windowId = `cim-${windowSeq}`
  windowGroups.push({ id: windowId, label, createdAt: Date.now() })

  const runArgs = buildRunArgs(shell, command)
  const args = ['-w', windowId, ...wtWindowArgs(settings)]
  list.forEach((m, i) => {
    if (i > 0) args.push(';') // wt 以獨立的 ';' 參數作為分頁分隔符
    args.push(
      'new-tab',
      '-d',
      m.cwd,
      '--title',
      m.name || m.cwd,
      '--suppressApplicationTitle',
      shell,
      ...runArgs
    )
  })

  return new Promise((resolve) => {
    let child
    try {
      child = spawn('wt.exe', args, { detached: true, stdio: 'ignore', windowsHide: false })
    } catch (err) {
      // spawn 失敗回收剛登記的視窗群組，避免幽靈群組
      const i = windowGroups.findIndex((w) => w.id === windowId)
      if (i >= 0) windowGroups.splice(i, 1)
      resolve({ ok: false, error: err.message })
      return
    }
    child.on('error', (err) => {
      const i = windowGroups.findIndex((w) => w.id === windowId)
      if (i >= 0) windowGroups.splice(i, 1)
      resolve({ ok: false, error: err.message })
    })
    child.on('spawn', () => {
      child.unref()
      resolve({ ok: true })
    })
  })
}
