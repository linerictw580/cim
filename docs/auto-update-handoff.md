# 交接文件：自動偵測新版本 + 一鍵更新功能

> 目的：讓另一個實作環境（或另一個 AI session）能直接接手完成此功能。
> 撰寫日期：2026-07-02，分支：`dev`

---

## 1. 需求（使用者原話摘要）

- 偵測到有新版本可下載/安裝時，畫面出現提醒訊息 + 「立即更新」按鈕。
- 點擊後：自動關閉舊軟體 → 下載新版本 → 自動開啟新軟體 → 清理舊檔案。
- **更新絕不可異動 permanent settings**（專案清單、使用者設定等）。

## 2. 已拍板的決策（使用者已確認，不要再問）

| 議題 | 決定 |
|------|------|
| Portable 版處理 | **保留 nsis + portable 兩種打包**。安裝版走完整自動更新；portable 偵測到新版**只顯示提示 + 下載連結**，不自動安裝 |
| Release 通道 | **GitHub Releases（public repo）**，repo 是 `github.com/linerictw580/cim`，不需要任何 token |
| 檢查時機 | **開機自動檢查 + 設定頁手動「檢查更新」按鈕 + 定期輪詢（每 4 小時）** |
| 技術選型 | `electron-updater`（electron-builder 官方搭配） |
| Commit 授權 | 使用者已給本任務一次性 standing approval：**每個 stage 自動 commit，不用再問** |

## 3. 專案現況（接手時的起點）

- **分支**：`dev`（已 push 到 `origin/dev`，有 upstream tracking）。主分支是 `master`。
- **版本**：`package.json` version = `0.1.0`。
- **已完成的部分（Stage 1 做到一半）**：
  - `npm install electron-updater` **已執行成功** → `package.json` dependencies 已含 `electron-updater`、`package-lock.json` 已更新，**尚未 commit**。
  - `electron-builder.yml` 的 `publish` 設定**尚未加**。
- 工作樹目前應該只有 package.json / package-lock.json 的變更。

### 關鍵既有架構（已調查完，可信）

- **Electron + electron-vite + React**，Windows only（打包 target: nsis + portable）。
- **設定儲存**：`src/main/store.js` 用 `electron-store`，存於 userData（`%APPDATA%\cim\config.json`），內含 `projects` 與 `settings`。**NSIS 更新只覆蓋安裝目錄、不碰 userData，所以「更新不動設定」天生成立，不需額外程式碼**（驗證時確認即可）。
- **版本顯示**：`src/renderer/src/components/Sidebar.jsx` 用 `window.api.getVersion()` → IPC `app:getVersion` → `app.getVersion()`，自動同步 package.json，**bump version 時不用改 UI**。
- **IPC 註冊**：集中在 `src/main/ipc.js` 的 `registerIpc()`，由 `src/main/index.js` 的 `app.whenReady()` 呼叫。
- **Preload**：`src/preload/index.js` 曝露 `window.api.*`。
- **electron-builder.yml**：`appId: com.cim.claude-instance-manager`、`productName: CIM`、output 到 `dist/`、nsis 是 assisted installer（`oneClick: false`）。build 已會產生 `latest.yml`（見 `dist/latest.yml`）。

## 4. 實作計畫（staged commits，全部在 `dev` 分支）

### Stage 1（半完成）：`feat: 加入 electron-updater 與 GitHub publish 設定`
1. ✅ `npm install electron-updater`（已做，未 commit）
2. ⬜ `electron-builder.yml` 加：
   ```yaml
   publish:
     provider: github
     owner: linerictw580
     repo: cim
   ```
3. ⬜ commit（含 package.json、package-lock.json、electron-builder.yml）

### Stage 2：`feat: main process 更新偵測與 IPC`
新增 `src/main/updater.js`，並在 `ipc.js`（或 index.js）掛上。要點：

- 用 `electron-updater` 的 `autoUpdater`：
  ```js
  const { autoUpdater } = require('electron-updater') // ESM: import { autoUpdater } from 'electron-updater'
  autoUpdater.autoDownload = false          // 使用者按「立即更新」才下載
  autoUpdater.autoInstallOnAppQuit = false  // 由 quitAndInstall 主動觸發
  ```
- **Portable 偵測**：`process.env.PORTABLE_EXECUTABLE_DIR` 存在 ⇒ portable 模式。portable 下 `checkForUpdates` 仍可查版本（或直接打 GitHub API 比對），但**不下載**，事件回報 `{ portable: true }` 讓 UI 顯示「前往下載」連結（`https://github.com/linerictw580/cim/releases/latest`）。
- **開發模式**：`app.isPackaged === false` 時 electron-updater 預設不會檢查；用 log 提示即可，別 crash。
- 時機：`app.whenReady` 後檢查一次；`setInterval` 每 4 小時再查。
- IPC handlers（配合 preload 曝露）：
  - `updater:check` → 手動檢查，回傳結果
  - `updater:download` → 開始下載（回傳 promise 或靠事件）
  - `updater:install` → `autoUpdater.quitAndInstall()`（silent 安裝、關舊開新，NSIS 自行清理舊檔）
- 事件推送到 renderer（`win.webContents.send`）：
  - `updater:update-available` `{ version, portable }`
  - `updater:download-progress` `{ percent }`
  - `updater:update-downloaded`
  - `updater:error`（靜默記錄，UI 只在「手動檢查」時顯示錯誤；自動檢查失敗不打擾使用者）
- `src/preload/index.js` 加對應 API：`checkForUpdate()`, `downloadUpdate()`, `installUpdate()`, `onUpdateEvent(callback)`（ipcRenderer.on 包裝，記得回傳解除訂閱函式）。

### Stage 3：`feat: 更新提醒 UI 與立即更新按鈕`
- 全域橫幅（建議放 `App.jsx` 頂層）：偵測到新版 → 顯示「有新版本 vX.Y.Z 可以安裝」
  - 安裝版：**「立即更新」按鈕** → 觸發下載 → 顯示進度（percent）→ 下載完成自動呼叫 `installUpdate()`（或顯示「重新啟動並安裝」按鈕，實作者可視 UX 決定，但使用者需求是點一下全自動，建議下載完直接裝）
  - portable：**「前往下載」按鈕** → `shell.openExternal` 開 releases 頁
  - 可關閉（dismiss）本次提醒
- 設定頁加「檢查更新」按鈕：顯示檢查中 / 已是最新版本 / 檢查失敗的即時回饋
- 樣式跟隨現有 CSS 慣例（renderer 裡現有 class 命名是 BEM-ish，如 `sidebar__version`）

### Stage 4：驗證
- `npm run build` 通過（electron-vite build）
- dev 模式起 app 確認 UI 不壞、手動檢查按鈕有合理回饋
- **驗證邊界（要如實告知使用者）**：完整 e2e（真的偵測到新版→下載→重啟）必須等下一個真實 GitHub Release 存在才能驗。可先發 v0.2.0 release、裝 v0.1.0 的 setup.exe 來實測。
- 確認更新後 `%APPDATA%\cim\config.json` 沒被動到（設定保留）。

## 5. 發佈流程（配合此功能的 release workflow）

使用者既有規範（存在專案 memory `release-workflow.md`）：

1. 平時開發都在 `dev`；開新分支要 `git push -u origin <branch>` 同步 remote。
2. 上版時：**專門一個 commit** bump `package.json` version（UI 版本自動同步）→ merge 到 `master` → 打 tag `vX.Y.Z`。
3. **配合 auto-update 新增**：build 出的 `latest.yml` + `CIM-X.Y.Z-setup.exe`（+ blockmap）要上傳到該 tag 的 GitHub Release（可手動上傳，或之後用 `electron-builder --publish`）。**Release 必須是 published 狀態**（不是 draft），`electron-updater` 才抓得到。

## 6. 其他注意事項

- 使用者是繁中溝通（zh-TW），commit message 目前慣例：`feat:` / `fix:` + 繁中描述（看 git log 即知）。
- 未簽章（no code signing）：Windows 可能出 SmartScreen 警告，屬已知現況，不在此任務範圍。
- `electron-updater` 是 CommonJS；此專案 main process 用 ESM import，electron-vite 會處理，但注意 `import { autoUpdater } from 'electron-updater'` 在某些版本需要 `import electronUpdater from 'electron-updater'; const { autoUpdater } = electronUpdater;` 的寫法（named export 問題），build 不過時先試這個。
- 檢查更新失敗（斷網等）：自動檢查靜默，手動檢查才顯示錯誤。
