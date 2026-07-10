import { app } from 'electron'
import { execFile } from 'child_process'
import {
  readdirSync,
  statSync,
  existsSync,
  writeFileSync,
  readFileSync,
  rmSync,
  mkdirSync,
  cpSync
} from 'fs'
import { homedir, hostname } from 'os'
import { join, dirname } from 'path'

// ===== 使用者層級 Claude 設定（~/.claude） =====

// 使用者層級 Claude 設定目錄（~/.claude）
export function claudeDir() {
  return join(homedir(), '.claude')
}

// v1 同步白名單：只有列在這裡的項目會被納入跨裝置同步。
// 採「白名單」而非「黑名單」——未列出者一律不碰，避免誤同步機密或執行期產物。
// merge: 'json' 表示該檔以鍵級 deep-merge 合併（shared base + 裝置 overlay），其餘為整檔/整目錄。
// 註：hook 的「定義」是 settings.json 內的 hooks 鍵，已隨 settings.json 同步；
// 這裡的 hooks/ 目錄涵蓋的是 hook 定義所呼叫的「腳本檔」（如 notify.ps1），
// 否則會同步了 hook 設定卻漏掉它要執行的腳本。
export const ALLOWLIST = [
  { key: 'CLAUDE.md', type: 'file', label: '全域指令 (CLAUDE.md)' },
  { key: 'settings.json', type: 'file', label: '設定 (settings.json)', merge: 'json' },
  { key: 'keybindings.json', type: 'file', label: '快捷鍵 (keybindings.json)' },
  { key: 'skills', type: 'dir', label: '技能 (skills/)' },
  { key: 'agents', type: 'dir', label: '子代理 (agents/)' },
  { key: 'commands', type: 'dir', label: '自訂指令 (commands/)' },
  { key: 'output-styles', type: 'dir', label: '輸出樣式 (output-styles/)' },
  { key: 'rules', type: 'dir', label: '規則 (rules/)' },
  { key: 'hooks', type: 'dir', label: 'Hooks 腳本 (hooks/)' }
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

// ===== Git 同步 repo（Stage 2） =====

// 本機用來存放同步 repo 的目錄（CIM 代管於 userData 下，使用者不需手動管理）
export function repoDir() {
  return join(app.getPath('userData'), 'sync-repo')
}

// 執行 git 子指令。用 execFile 以陣列傳參，避免使用者提供的 remote URL 觸發 shell 引號/注入問題。
// 回傳 { ok, stdout, stderr }
function runGit(args, cwd, timeout = 60000) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout, windowsHide: true }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        stdout: (stdout || '').trim(),
        stderr: (stderr || (err && err.message) || '').trim()
      })
    })
  })
}

// 偵測系統 git 是否可用（比照 terminal.js 的 wt.exe 能力探測）。
// 只快取「可用」結果，讓使用者安裝 git 後回到本頁可重新偵測到。
let gitProbeCache = null
export async function probeGit() {
  if (gitProbeCache && gitProbeCache.available) return gitProbeCache
  const r = await runGit(['--version'], undefined, 10000)
  gitProbeCache = r.ok
    ? { available: true, version: r.stdout.replace(/^git version\s*/i, '') }
    : { available: false, version: null }
  return gitProbeCache
}

const MANIFEST = 'cim-sync.json'

function defaultManifest() {
  return { schemaVersion: 1, devices: [], items: {} }
}

function readManifest() {
  try {
    return JSON.parse(readFileSync(join(repoDir(), MANIFEST), 'utf8'))
  } catch {
    return null
  }
}

function writeManifest(m) {
  writeFileSync(join(repoDir(), MANIFEST), JSON.stringify(m, null, 2) + '\n', 'utf8')
}

function writeReadme(dir) {
  const p = join(dir, 'README.md')
  if (existsSync(p)) return
  writeFileSync(
    p,
    '# CIM 同步 repo\n\n此 repo 由 CIM（Claude Instance Manager）代管，用於跨裝置同步使用者層級的 Claude Code 設定。\n目錄結構與 cim-sync.json 由 CIM 維護，請避免手動修改。\n',
    'utf8'
  )
}

// 設定 repo-local 的提交者身分，避免使用者無全域 git identity 時 commit 失敗
async function ensureGitIdentity(dir) {
  const name = await runGit(['config', 'user.name'], dir)
  if (!name.ok || !name.stdout) await runGit(['config', 'user.name', 'CIM'], dir)
  const email = await runGit(['config', 'user.email'], dir)
  if (!email.ok || !email.stdout) await runGit(['config', 'user.email', 'cim@localhost'], dir)
}

async function currentBranch(dir) {
  const r = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], dir)
  return r.ok && r.stdout && r.stdout !== 'HEAD' ? r.stdout : 'main'
}

// 連線到私有 repo：clone（或更新既有 clone）、必要時初始化骨架、把本機裝置註冊進 manifest。
// 不複製任何 ~/.claude 設定、不 materialize（那是 Stage 3/4）。
// 回傳 { ok, error?, devices? }
export async function connect({ remoteUrl, deviceId } = {}) {
  const url = (remoteUrl || '').trim()
  const id = (deviceId || '').trim()
  if (!url) return { ok: false, error: '請輸入私有 repo 的 URL。' }
  if (!id) return { ok: false, error: '請輸入本機裝置名稱。' }
  if (!/^[A-Za-z0-9._-]+$/.test(id))
    return { ok: false, error: '裝置名稱僅能包含英數字、底線、點與連字號。' }

  const probe = await probeGit()
  if (!probe.available) return { ok: false, error: '找不到系統 git，請先安裝 git 後再試。' }

  const dir = repoDir()

  // 取得 / 更新本機 clone
  if (existsSync(join(dir, '.git'))) {
    await runGit(['remote', 'set-url', 'origin', url], dir)
    const f = await runGit(['fetch', 'origin'], dir)
    if (!f.ok) return { ok: false, error: `git fetch 失敗：${f.stderr}` }
  } else {
    if (existsSync(dir)) {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // 移除殘留失敗不致命，clone 會再回報
      }
    }
    const c = await runGit(['clone', url, dir], app.getPath('userData'))
    if (!c.ok) return { ok: false, error: `git clone 失敗：${c.stderr}` }
  }

  await ensureGitIdentity(dir)

  // 判斷 repo 是否為空（無任何 commit），並決定要操作的分支
  const head = await runGit(['rev-parse', '--verify', 'HEAD'], dir)
  const isEmpty = !head.ok
  let branch
  if (isEmpty) {
    const sym = await runGit(['symbolic-ref', '--short', 'HEAD'], dir)
    branch = sym.ok && sym.stdout ? sym.stdout : 'main'
  } else {
    branch = await currentBranch(dir)
    await runGit(['pull', '--ff-only', 'origin', branch], dir) // best-effort 對齊遠端
  }

  // 準備 manifest（空 repo 或遠端無 manifest → 建立預設）
  let manifest = isEmpty ? null : readManifest()
  const manifestMissing = !manifest
  if (!manifest) manifest = defaultManifest()

  // 註冊本機裝置
  let deviceAdded = false
  if (!manifest.devices.some((d) => d.id === id)) {
    manifest.devices.push({ id, label: id })
    deviceAdded = true
  }

  // 有變更才寫入 / commit / push
  if (isEmpty || manifestMissing || deviceAdded) {
    writeManifest(manifest)
    writeReadme(dir)
    await runGit(['add', '-A'], dir)
    const msg = isEmpty || manifestMissing ? '初始化 CIM 同步 repo' : `註冊裝置 ${id}`
    await runGit(['commit', '-m', `chore: ${msg}`], dir)
    const pushArgs = isEmpty ? ['push', '-u', 'origin', branch] : ['push', 'origin', branch]
    const p = await runGit(pushArgs, dir)
    if (!p.ok)
      return { ok: false, error: `git push 失敗（請確認對此 repo 有寫入權限）：${p.stderr}` }
  }

  return { ok: true, devices: (readManifest() || manifest).devices, branch }
}

// 目前同步狀態（供 UI 顯示）。cfg 由呼叫端傳入 store.get('sync')。
// 回傳 { git, connected, remoteUrl, deviceId, hostname, devices }
export async function getStatus(cfg = {}) {
  const git = await probeGit()
  const hasClone = existsSync(join(repoDir(), '.git'))
  const connected = !!(cfg.remoteUrl && cfg.deviceId && hasClone)
  const manifest = connected ? readManifest() : null
  return {
    git,
    connected,
    remoteUrl: cfg.remoteUrl || '',
    deviceId: cfg.deviceId || '',
    hostname: hostname().replace(/[^A-Za-z0-9._-]/g, '-'),
    devices: (manifest && manifest.devices) || []
  }
}

// 解除連線：移除本機 repo 快取（不影響遠端 repo 與 ~/.claude）。
// store 端的 remoteUrl/deviceId 由 ipc 呼叫端清除。
export function disconnect() {
  try {
    rmSync(repoDir(), { recursive: true, force: true })
  } catch {
    // 目錄不存在或移除失敗皆視為已解除
  }
  return { ok: true }
}

// ===== 推送：本機 → repo（Stage 3） =====

// 列舉本機可同步的「單元」：頂層檔案項目 + 目錄項目下的每個子項。
// 目錄項目（skills / agents…）以「每個子項目」為粒度，達成
// 「共用個人 skill、公司 skill 留本機」的需求。
export function listUnits() {
  const base = claudeDir()
  const units = []
  for (const entry of ALLOWLIST) {
    const full = join(base, entry.key)
    if (entry.type === 'file') {
      if (existsSync(full)) {
        units.push({ path: entry.key, label: entry.label, type: 'file', group: null })
      }
    } else {
      let children = []
      try {
        children = readdirSync(full, { withFileTypes: true }).filter((d) => !d.name.startsWith('.'))
      } catch {
        children = []
      }
      for (const c of children) {
        units.push({
          path: `${entry.key}/${c.name}`,
          label: c.name,
          type: c.isDirectory() ? 'dir' : 'file',
          group: entry.key,
          groupLabel: entry.label
        })
      }
    }
  }
  return units
}

// 單元在 repo 內的相對路徑（settings.json 特別對應到 base/overlay 檔名）
function repoRelPath(unitPath, scope, deviceId) {
  if (unitPath === 'settings.json') {
    return scope === 'shared'
      ? 'shared/settings.base.json'
      : `devices/${deviceId}/settings.device.json`
  }
  return scope === 'shared' ? `shared/${unitPath}` : `devices/${deviceId}/${unitPath}`
}

function copyPath(src, dest) {
  mkdirSync(dirname(dest), { recursive: true })
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
}

function removePath(p) {
  try {
    rmSync(p, { recursive: true, force: true })
  } catch {
    // 不存在即視為已移除
  }
}

// 計算推送計畫：列出本機單元與其目前在 repo 的 scope（供 UI 預選）。
// scope：'shared'（shared/ 內）/ 'device'（本機的 devices/<id>/ 內）/ 'none'。
export function getPushPlan(cfg = {}) {
  const id = (cfg.deviceId || '').trim()
  const manifest = readManifest() || defaultManifest()
  const items = manifest.items || {}
  const units = listUnits().map((u) => {
    const rec = items[u.path]
    let scope = 'none'
    if (rec) {
      if (rec.shared) scope = 'shared'
      else if ((rec.devices || []).includes(id)) scope = 'device'
    }
    return { ...u, scope }
  })
  return { deviceId: id, units }
}

// 依 assignments（[{ path, type, scope }]）把本機單元複製進 repo、更新 manifest、commit + push。
// scope=shared → shared/<unit>；scope=device → devices/<id>/<unit>；scope=none → 移除本機這台的 overlay。
// 為避免影響其他裝置，none 不刪除 shared/（跨裝置「取消共用」為後續明確動作）。
// 回傳 { ok, error?, pushed, noChange }
export async function pushUnits(cfg = {}, assignments = []) {
  const id = (cfg.deviceId || '').trim()
  if (!id) return { ok: false, error: '尚未設定裝置名稱。' }
  const dir = repoDir()
  if (!existsSync(join(dir, '.git'))) return { ok: false, error: '尚未連線到同步 repo。' }
  const probe = await probeGit()
  if (!probe.available) return { ok: false, error: '找不到系統 git。' }

  const branch = await currentBranch(dir)
  await runGit(['pull', '--ff-only', 'origin', branch], dir) // best-effort 對齊遠端

  const manifest = readManifest() || defaultManifest()
  manifest.items = manifest.items || {}
  const claudeBase = claudeDir()
  let applied = 0

  for (const a of assignments || []) {
    const unitPath = a.path
    const scope = a.scope
    const src = join(claudeBase, unitPath)
    const deviceDest = join(dir, repoRelPath(unitPath, 'device', id))
    const sharedDest = join(dir, repoRelPath(unitPath, 'shared', id))
    const rec = manifest.items[unitPath] || { shared: false, devices: [], type: a.type || 'file' }
    rec.type = a.type || rec.type || 'file'

    if (scope === 'shared') {
      if (!existsSync(src)) continue
      copyPath(src, sharedDest)
      removePath(deviceDest) // 本機 overlay 冗餘，移除（只影響本機層）
      rec.shared = true
      rec.devices = (rec.devices || []).filter((d) => d !== id)
      applied++
    } else if (scope === 'device') {
      if (!existsSync(src)) continue
      copyPath(src, deviceDest)
      rec.devices = Array.from(new Set([...(rec.devices || []), id]))
      applied++
    } else {
      // none：移除本機這台在 repo 內的 overlay（不動 shared）
      removePath(deviceDest)
      rec.devices = (rec.devices || []).filter((d) => d !== id)
    }

    if (!rec.shared && (!rec.devices || rec.devices.length === 0)) {
      delete manifest.items[unitPath]
    } else {
      manifest.items[unitPath] = rec
    }
  }

  writeManifest(manifest)
  await runGit(['add', '-A'], dir)
  const staged = await runGit(['diff', '--cached', '--name-only'], dir)
  if (!staged.stdout) return { ok: true, pushed: 0, noChange: true } // 無實質變更，不產生空 commit

  await runGit(['commit', '-m', `chore: 從 ${id} 推送設定`], dir)
  const p = await runGit(['push', 'origin', branch], dir)
  if (!p.ok) return { ok: false, error: `git push 失敗：${p.stderr}` }
  return { ok: true, pushed: applied, noChange: false }
}
