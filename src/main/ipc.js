import { app, ipcMain, dialog, BrowserWindow } from 'electron'
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
}
