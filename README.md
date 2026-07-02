# CIM · Claude Instance Manager

<p align="center">
  <img src="build/icon.ico" width="96" alt="CIM icon" />
</p>

一個 Windows 桌面小工具，用來管理常用專案路徑，並**一鍵在終端機開啟該目錄並執行 `claude`**。

解決的痛點：重開機（例如安裝防毒軟體後）之後，不必再一個個手動切目錄、開終端、啟動 Claude —— 把常用專案加入列表，點一下就開一個跑著 `claude` 的終端分頁。

---

## 下載

<p align="center">
  <a href="https://github.com/linerictw580/cim/releases/latest"><b>⬇️ 下載最新版本</b></a>
</p>

前往 [**Releases 頁面**](https://github.com/linerictw580/cim/releases)，在 **Assets** 區塊下載：

- `CIM-<version>-setup.exe` — NSIS 安裝檔（可選安裝目錄、建立捷徑），**一般使用者建議用這個**
- `CIM-<version>-portable.exe` — 免安裝版，下載後直接執行

安裝版支援自動更新：有新版發布時 App 會自動偵測並提示更新。

---

## 功能特色

- **Claude 登入 gate**：啟動時偵測 Claude Code 認證狀態，未安裝或未登入時顯示全畫面引導，登入後才進入主畫面
- **專案列表**：加入本機資料夾，預設以目錄名命名，可重新命名（顯示名稱，不影響實際路徑）
- **一鍵開終端**：在專案目錄開啟終端機並執行 `claude`，分頁標題以專案名稱命名
- **兩種終端模式**：Windows Terminal（`wt.exe`）或傳統獨立視窗，可於設定切換
- **可自訂**：shell 執行檔（`powershell` / `pwsh` / `cmd`）與啟動指令（預設 `claude`）
- **開機自動啟動**：登入 Windows 後自動開啟 CIM
- **持久化**：專案與設定存於系統 userData，重開 App 仍在
- **安全刪除**：移除專案前跳確認彈窗，避免誤刪

---

## 技術棧

| 分類 | 使用 |
|------|------|
| 桌面框架 | Electron 31 |
| 建置工具 | electron-vite + Vite 5 |
| UI | React 18 |
| 持久化 | electron-store |
| 打包 | electron-builder（NSIS 安裝檔 + portable exe） |

安全性採 `contextIsolation` + preload `contextBridge`，未開放 `nodeIntegration`。

---

## 開發

需求：Node.js 20+、Windows 10/11。

```powershell
npm install      # 安裝相依
npm run dev      # 開發模式（熱重載）啟動 App
npm run build    # 編譯 main / preload / renderer
npm run package  # 打包成 Windows 安裝檔 + portable exe（輸出到 dist\）
```

打包產物：

- `dist\CIM-<version>-setup.exe` — NSIS 安裝檔（可選安裝目錄、建立捷徑）
- `dist\CIM-<version>-portable.exe` — 免安裝，直接執行

---

## 使用說明

0. **登入 Claude**：首次啟動若尚未登入，會顯示登入畫面。點「登入」開終端執行 `claude auth login`，在終端完成 OAuth 後，CIM 會自動偵測並進入主畫面。若連 Claude Code 都未安裝，畫面會改為顯示安裝指引。已登入後，專案頁頂部會顯示帳號與「登出」。
1. **新增專案**：在「專案」頁點右上「+ 新增」，選擇本機資料夾。
2. **重新命名**：雙擊名稱或點鉛筆圖示，`Enter` 儲存 / `Esc` 取消。
3. **開啟終端**：點該專案的終端機圖示，即在該目錄開終端並執行 `claude`。
4. **移除專案**：點垃圾桶圖示，確認後移除（不會刪除實際資料夾）。
5. **設定**：於「設定」頁調整終端機類型、shell、啟動指令、開機自動啟動。

### 設定項目

| 項目 | 說明 | 預設 |
|------|------|------|
| 終端機類型 | Windows Terminal 或 傳統獨立視窗 | Windows Terminal |
| Shell 執行檔 | `powershell` / `pwsh` / `cmd` 或完整路徑 | `powershell` |
| 啟動指令 | 進入目錄後執行的指令 | `claude` |
| 開機自動啟動 | 登入後自動開啟 CIM | 關閉 |

---

## 已知限制

- **傳統視窗模式的標題**：Windows Terminal 模式用 `--suppressApplicationTitle` 鎖定分頁標題為專案名；但傳統 console 視窗無等效機制，`claude` 執行後會把標題改成「Claude Code」。想固定顯示專案名請使用 Windows Terminal 模式。
- **開機自動啟動請用安裝版**：此設定綁定當前執行檔路徑。在 `npm run dev` 下啟用會指向 `node_modules` 裡的 `electron.exe`，開機只會拉起空殼；請務必在**打包安裝後的版本**啟用。
- **Windows Terminal 需已安裝**：預設走 `wt.exe`；若系統未安裝，開啟時會於通知列回報失敗，改用「傳統獨立視窗」即可。
- **登入須在終端完成**：`claude auth login` 為互動式 OAuth，無法在 App 內嵌完成，CIM 開終端引導、完成後自動偵測。此外 CIM 偵測登入狀態需能在自身程序的 PATH 中找到 `claude`；一般 npm 全域安裝會登記於 PATH，若打包版偵測不到，請確認 `claude` 已在系統 PATH。

---

## 專案結構

```
src/
  main/            Electron 主程序
    index.js         建立視窗
    ipc.js           IPC handlers（選資料夾 / 持久化 / 開終端 / 版本 / 自動啟動）
    store.js         electron-store 持久化
    terminal.js      開終端機邏輯（wt.exe / 傳統視窗）
  preload/
    index.js         contextBridge 暴露 window.api
  renderer/          React UI
    src/
      components/    Sidebar / ProjectItem / ConfirmDialog / icons
      pages/         ProjectsPage / SettingsPage
build/icon.ico     應用程式圖示
electron-builder.yml  打包設定
electron.vite.config.js
```

---

## 更換 App icon

替換 `build\icon.ico`（256×256 以上的多尺寸 `.ico`），再 `npm run package` 即可自動套用到 exe、安裝檔與捷徑。
