import { app, ipcMain, dialog, BrowserWindow, shell } from 'electron'
import fs from 'fs'
import { join } from 'path'
import store from './store'
import { openTerminal } from './terminal'
import { getAuthStatus, login, logout, addToPath } from './auth'
import { checkForUpdate, downloadUpdate, installUpdate } from './updater'

export function registerIpc() {
  // 應用程式版本（與 package.json version 同步）
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // 開機自動啟動（真實來源為 OS 登入項設定，不另存 store）
  ipcMain.handle('app:getAutoLaunch', () => app.getLoginItemSettings().openAtLogin)
  ipcMain.handle('app:setAutoLaunch', (event, enabled) => {
    app.setLoginItemSettings({ openAtLogin: enabled })
    return app.getLoginItemSettings().openAtLogin
  })

  // 開啟系統選資料夾對話框，回傳選中的絕對路徑（取消則回傳 null）
  ipcMain.handle('dialog:selectFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // 掃描父目錄第一層子資料夾，供「批次匯入」勾選使用
  // 回傳 [{ name, path, hasGit }]；讀取失敗（權限/不存在）回傳空陣列，不中斷
  ipcMain.handle('fs:scanSubProjects', (event, parentDir) => {
    if (!parentDir) return []
    try {
      return fs
        .readdirSync(parentDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const full = join(parentDir, entry.name)
          return {
            name: entry.name,
            path: full,
            hasGit: fs.existsSync(join(full, '.git'))
          }
        })
    } catch (e) {
      console.error('fs:scanSubProjects error', e)
      return []
    }
  })

  // 專案清單讀寫
  ipcMain.handle('store:getProjects', () => store.get('projects'))
  ipcMain.handle('store:setProjects', (event, projects) => {
    store.set('projects', projects)
    return true
  })

  // 設定讀寫
  ipcMain.handle('store:getSettings', () => store.get('settings'))
  ipcMain.handle('store:setSettings', (event, settings) => {
    store.set('settings', settings)
    return true
  })

  // 在指定目錄開啟終端機並執行 claude，標題以專案名稱命名
  ipcMain.handle('terminal:open', (event, cwd, name) => openTerminal(cwd, name))

  // Claude Code 認證
  ipcMain.handle('auth:status', () => getAuthStatus())
  ipcMain.handle('auth:login', () => login())
  ipcMain.handle('auth:logout', () => logout())
  ipcMain.handle('auth:addToPath', () => addToPath())

  // 自動更新：手動檢查 / 下載 / 安裝（事件另由 updater 主動推送給 renderer）
  ipcMain.handle('updater:check', () => checkForUpdate())
  ipcMain.handle('updater:download', () => downloadUpdate())
  ipcMain.handle('updater:install', () => installUpdate())

  // 以系統預設瀏覽器開啟外部連結（portable 版「前往下載」用）
  ipcMain.handle('shell:openExternal', (event, url) => shell.openExternal(url))
}
