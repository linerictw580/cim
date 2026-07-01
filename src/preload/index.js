import { contextBridge, ipcRenderer } from 'electron'

// 透過 contextBridge 暴露安全的 API 給 renderer（不開放 nodeIntegration）
contextBridge.exposeInMainWorld('api', {
  // 選資料夾對話框，回傳路徑或 null
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),

  // 專案清單持久化
  getProjects: () => ipcRenderer.invoke('store:getProjects'),
  setProjects: (projects) => ipcRenderer.invoke('store:setProjects', projects),

  // 設定持久化
  getSettings: () => ipcRenderer.invoke('store:getSettings'),
  setSettings: (settings) => ipcRenderer.invoke('store:setSettings', settings)
})
