import { app, BrowserWindow } from 'electron'
// electron-updater 是 CommonJS，named export 在 ESM 下不穩定，
// 故以 default import 後再解構取出 autoUpdater。
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

// portable 模式：electron-builder 的 portable target 執行時會設定此環境變數。
// portable 版只提示新版 + 提供下載連結，不走自動下載/安裝。
const isPortable = !!process.env.PORTABLE_EXECUTABLE_DIR

// 每 4 小時定期輪詢一次
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

let checkTimer = null

// 推送事件給所有 renderer 視窗（視窗數量少，無效能疑慮）
function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

// 初始化 autoUpdater：設定 + 事件綁定 + 開機檢查 + 定期輪詢。
// 由 index.js 在建立視窗後呼叫。
export function initUpdater() {
  autoUpdater.autoDownload = false // 使用者按「立即更新」才下載
  autoUpdater.autoInstallOnAppQuit = false // 由 quitAndInstall 主動觸發

  // 偵測到新版 → 通知 renderer 顯示橫幅（portable 帶旗標讓 UI 只顯示下載連結）
  autoUpdater.on('update-available', (info) => {
    broadcast('updater:update-available', { version: info.version, portable: isPortable })
  })
  // 下載進度（percent 取整數方便 UI 呈現）
  autoUpdater.on('download-progress', (p) => {
    broadcast('updater:download-progress', { percent: Math.round(p.percent) })
  })
  // 下載完成 → renderer 收到後自動觸發安裝
  autoUpdater.on('update-downloaded', () => {
    broadcast('updater:update-downloaded')
  })
  // 錯誤僅記錄；使用者可見的錯誤改由 check/download 的 promise 回傳處理，
  // 自動檢查失敗（斷網等）保持靜默，不打擾使用者。
  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err?.message || err)
  })

  // 開機後檢查一次，之後每 4 小時輪詢
  runAutoCheck()
  checkTimer = setInterval(runAutoCheck, CHECK_INTERVAL_MS)
  app.on('before-quit', () => {
    if (checkTimer) clearInterval(checkTimer)
  })
}

// 自動檢查：dev 模式跳過（electron-updater 預設不查未打包程式）；錯誤靜默。
async function runAutoCheck() {
  if (!app.isPackaged) {
    console.log('[updater] dev 模式，跳過自動更新檢查')
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    console.error('[updater] 自動檢查失敗（靜默）:', err?.message || err)
  }
}

// 手動檢查（設定頁按鈕）：回傳結果供即時回饋。
// status: dev | available | latest | error
export async function checkForUpdate() {
  if (!app.isPackaged) {
    return { status: 'dev', message: '開發模式不檢查更新' }
  }
  try {
    const result = await autoUpdater.checkForUpdates()
    if (result?.isUpdateAvailable) {
      return { status: 'available', version: result.updateInfo?.version, portable: isPortable }
    }
    return { status: 'latest' }
  } catch (err) {
    return { status: 'error', message: err?.message || '檢查更新失敗' }
  }
}

// 開始下載（portable 不下載，回傳 portable 旗標讓 UI 走下載連結）。
// 進度與完成透過事件推送給 renderer。
export async function downloadUpdate() {
  if (isPortable) return { ok: false, portable: true }
  try {
    await autoUpdater.downloadUpdate()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err?.message || '下載失敗' }
  }
}

// 安裝並重啟：silent 安裝、關舊開新，NSIS 自行清理舊檔（portable 不支援）。
export function installUpdate() {
  if (isPortable) return { ok: false, portable: true }
  // isSilent=true, isForceRunAfter=true → 安靜安裝並於完成後自動開新版
  autoUpdater.quitAndInstall(true, true)
  return { ok: true }
}
