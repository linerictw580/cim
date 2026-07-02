import { contextBridge, ipcRenderer, clipboard } from 'electron'

// 透過 contextBridge 暴露安全的 API 給 renderer（不開放 nodeIntegration）
contextBridge.exposeInMainWorld('api', {
  // 應用程式版本
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // 開機自動啟動
  getAutoLaunch: () => ipcRenderer.invoke('app:getAutoLaunch'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('app:setAutoLaunch', enabled),

  // 選資料夾對話框，回傳路徑或 null
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // 專案清單持久化
  getProjects: () => ipcRenderer.invoke('store:getProjects'),
  setProjects: (projects) => ipcRenderer.invoke('store:setProjects', projects),

  // 設定持久化
  getSettings: () => ipcRenderer.invoke('store:getSettings'),
  setSettings: (settings) => ipcRenderer.invoke('store:setSettings', settings),

  // 開啟終端機並執行 claude，回傳 { ok, error? }
  openTerminal: (cwd, name) => ipcRenderer.invoke('terminal:open', cwd, name),

  // Claude Code 認證
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  addToPath: () => ipcRenderer.invoke('auth:addToPath'),

  // 複製文字到剪貼簿
  copyText: (text) => clipboard.writeText(text),

  // 自動更新：手動檢查 / 下載 / 安裝
  checkForUpdate: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),

  // 以系統預設瀏覽器開啟外部連結
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // 訂閱更新事件；callback 收到 { type, payload }，回傳解除訂閱函式
  onUpdateEvent: (callback) => {
    const channels = [
      'updater:update-available',
      'updater:download-progress',
      'updater:update-downloaded',
      'updater:error'
    ]
    const bound = channels.map((ch) => {
      const fn = (_event, payload) => callback({ type: ch.replace('updater:', ''), payload })
      ipcRenderer.on(ch, fn)
      return [ch, fn]
    })
    return () => bound.forEach(([ch, fn]) => ipcRenderer.removeListener(ch, fn))
  }
})
