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

  // 掃描父目錄第一層子資料夾（批次匯入），回傳 [{ name, path, hasGit }]
  scanSubProjects: (parentDir) => ipcRenderer.invoke('fs:scanSubProjects', parentDir),

  // 專案清單持久化
  getProjects: () => ipcRenderer.invoke('store:getProjects'),
  setProjects: (projects) => ipcRenderer.invoke('store:setProjects', projects),

  // 啟動組合持久化
  getCombos: () => ipcRenderer.invoke('store:getCombos'),
  setCombos: (combos) => ipcRenderer.invoke('store:setCombos', combos),

  // 設定持久化
  getSettings: () => ipcRenderer.invoke('store:getSettings'),
  setSettings: (settings) => ipcRenderer.invoke('store:setSettings', settings),

  // 開啟終端機並執行 claude，回傳 { ok, error? }
  // options: { mode: 'new' | 'tab', windowId }
  openTerminal: (cwd, name, options) => ipcRenderer.invoke('terminal:open', cwd, name, options),

  // 啟動一個群組（單一視窗多分頁 / 或退化為多個獨立視窗），回傳 { ok, error? }
  // members: [{ cwd, name }]
  openGroup: (members, groupLabel) =>
    ipcRenderer.invoke('terminal:openGroup', members, groupLabel),

  // 終端機視窗群組與能力（tab 功能）
  listTerminalWindows: () => ipcRenderer.invoke('terminal:listWindows'),
  clearTerminalWindows: () => ipcRenderer.invoke('terminal:clearWindows'),
  getTerminalCapabilities: () => ipcRenderer.invoke('terminal:capabilities'),

  // Claude Code 認證
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  addToPath: () => ipcRenderer.invoke('auth:addToPath'),

  // Claude 方案額度用量（/usage），回傳 { ok, session, weekly, scoped, fetchedAt } 或 { ok:false, error }
  getUsage: () => ipcRenderer.invoke('usage:get'),

  // 複製文字到剪貼簿
  copyText: (text) => clipboard.writeText(text),

  // 自動更新：手動檢查 / 下載 / 安裝
  checkForUpdate: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),

  // 以系統預設瀏覽器開啟外部連結
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // 訂閱主行程的分頁切換指令（系統匣「設定」觸發）；callback 收到 page 字串，回傳解除訂閱函式
  onNavigate: (callback) => {
    const fn = (_event, page) => callback(page)
    ipcRenderer.on('nav:goto', fn)
    return () => ipcRenderer.removeListener('nav:goto', fn)
  },

  // 系統匣客製選單（tray-menu.html）專用
  trayAction: (id) => ipcRenderer.send('tray:action', id),
  reportMenuSize: (width, height) => ipcRenderer.send('tray:menuSize', { width, height }),

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
