import Store from 'electron-store'

// 持久化到系統 userData 目錄下的 config.json
// projects: 使用者加入的專案清單
// combos: 自定義啟動組合（每個 combo 含多個 group，每個 group 對應一個終端機視窗）
// settings: 終端機開啟偏好
const store = new Store({
  defaults: {
    projects: [],
    // combos: [{ id, name, groups: [{ id, name, projectIds: [] }] }]
    combos: [],
    settings: {
      terminal: 'wt', // 'wt' = Windows Terminal, 'window' = 傳統獨立視窗
      shell: 'powershell', // shell 執行檔，可自訂 (powershell / pwsh / cmd)
      command: 'claude', // 進入目錄後執行的指令
      // 以下三項僅適用 Windows Terminal，且只在「開新視窗」時套用（加分頁沿用既有視窗）
      termCols: 120, // 開新視窗寬度（字元欄數）
      termRows: 30, // 開新視窗高度（字元列數）
      termMaximized: false, // 以最大化開啟（勾選時忽略 cols/rows）
      sort: 'manual', // 專案清單排序：'manual' 加入順序 / 'name' 名稱 / 'recent' 最近啟動
      searchScope: 'name' // 專案搜尋範圍：'name' 名稱 / 'path' 路徑
    }
  }
})

export default store
