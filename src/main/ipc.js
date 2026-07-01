import { ipcMain, dialog, BrowserWindow } from 'electron'
import store from './store'

export function registerIpc() {
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
}
