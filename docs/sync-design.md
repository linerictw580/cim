# 使用者層級設定跨裝置同步 — 設計規格

CIM 內建的「同步」功能：把使用者層級的 Claude Code 設定（`~/.claude`）以**私有 git repo**
為傳輸層，在多台裝置間同步；並支援**分層模型**，讓「共用設定」與「各裝置專屬設定」共存。

本文件為實作的單一事實來源（single source of truth）。分階段實作，逐 stage commit。

---

## 1. 目標與非目標

**目標**
- 使用者可透過 CIM 圖形化 UI，方便地把想同步的使用者層級設定推送到另一台裝置。
- 支援分層：部分設定所有裝置共用，部分僅特定裝置生效（例：公司電腦的內部 skill 不同步到家用電腦）。
- 全程安全：機密與機器特定檔案永不離開本機。

**非目標（v1）**
- 不同步 MCP 使用者層級設定（存於 `~/.claude.json`，混雜 token/trust，留待 v2）。
- 不同步對話 / session 歷史（`~/.claude/projects/`）。
- 不做內容端對端加密（v1 以「私有 repo + 白名單」為安全邊界；加密列為後續選項）。

---

## 2. 分層模型（base + per-device overlay）

某台裝置實際生效的 `~/.claude` 設定 =

```
shared 層  ⊕  devices/<本機裝置>層
```

- **`shared/`**：所有裝置共用，只存一份。改一次，全裝置生效。
- **`devices/<id>/`**：該裝置專屬的疊加 / 覆寫。
- 合併規則見 §5。

> 為何不用「純裝置目錄」：那會讓共用內容在每個裝置目錄各複製一份，改一次得改多處，
> 違背「共用」初衷。分層模型讓共用內容集中一份、裝置差異獨立管理。

---

## 3. Repo 佈局

```
<private-repo>/
  cim-sync.json               # manifest：schema 版本、裝置清單、各項目 scope
  shared/                     # 共用層
    CLAUDE.md
    settings.base.json        # settings.json 的「共用鍵」
    keybindings.json
    skills/<name>/…
    agents/<name>/…
    commands/…
    output-styles/…
    rules/…
  devices/
    workPC/
      settings.device.json    # 僅屬本裝置的鍵（deep-merge 疊在 base 上）
      skills/acme-internal/…  # 僅屬本裝置的 skill，或對共用項目的覆寫
    homePC/
      …
```

---

## 4. 白名單（v1）

只有列在白名單的項目會被同步；採白名單而非黑名單，未列出者一律不碰。
定義於 `src/main/sync.js` 的 `ALLOWLIST`。

| key | 類型 | 合併方式 |
|---|---|---|
| `CLAUDE.md` | file | 整檔 |
| `settings.json` | file | 鍵級 deep-merge（base + overlay） |
| `keybindings.json` | file | 整檔 |
| `skills/` | dir | 整目錄，依子項目名稱 |
| `agents/` | dir | 整目錄 |
| `commands/` | dir | 整目錄 |
| `output-styles/` | dir | 整目錄 |
| `rules/` | dir | 整目錄 |

**永不同步**（`NEVER_SYNC`，含機密 / 機器特定 / 執行期狀態）：
`.credentials.json`（OAuth token）、`settings.local.json`、`CLAUDE.local.md`、
`projects/`（session）、`history` / `history.jsonl`、`todos/`、`shell-snapshots/`、`statsig/`。
另 `~/.claude.json`（含 token/trust/MCP）位於 `.claude` 之外，掃描不會觸及。

---

## 5. Materialize（生效）與合併規則

在裝置上「拉取套用」時，把 `shared` 疊上 `devices/<本機>`，寫入 `~/.claude`：

- **整檔 / 整目錄項目**（CLAUDE.md、skills、agents…）：
  以項目為單位取 `shared` 與 `devices/<本機>` 的聯集；同名時**裝置層覆寫共用層**。
  scope 不含本機的項目（例：僅 `workPC` 的 skill）在本機**不 materialize**。
- **`settings.json`（鍵級）**：`deepMerge(shared/settings.base.json, devices/<本機>/settings.device.json)`，
  裝置層的鍵覆寫共用層，物件遞迴合併、陣列整個取代。
- **採「複製」而非 symlink**：CIM 為 Windows-only，symlink 需管理員 / 開發者模式，過脆。
- **managed-manifest（本機）**：CIM 於本機記錄「哪些檔由 CIM 管理」，
  讓拉取只更新 / 移除自己管的檔，不誤刪使用者手放的東西；並能偵測「使用者手改了受管檔」。
- **覆寫前備份**：materialize 覆寫既有檔前先備份，可回復。

---

## 6. 傳輸層

- **系統 git**：shell out 到使用者系統的 `git`（`execFile`，以陣列傳參避免 URL 引號/注入），
  沿用能力探測（比照 `terminal.js` 的 `wt.exe`）idiom；偵測不到 git 時 UI 引導安裝。
- **Repo 提供方式**：使用者自行在 GitHub / GitLab 建立**空的私有 repo**，把 URL 貼進 CIM；
  CIM clone 下來並初始化骨架（`cim-sync.json` + README）。CIM 不取得任何 GitHub token/OAuth。
- **認證**：沿用使用者系統 git 既有認證（Windows Credential Manager / SSH key）；
  clone / push 失敗時把 git 錯誤訊息 surface 給使用者。
- **本機 clone 位置**：CIM 代管於 `userData/sync-repo`，使用者不需手動管理。
- **分支**：空 repo 沿用遠端預設分支名初始化；非空 repo 以現有分支操作。

---

## 7. 衝突處理

- 推送 / 拉取時可能產生 git merge 衝突。文字檔（CLAUDE.md、json）多能 3-way 自動合併；
  真正衝突時於 UI surface，提供「保留本機 / 保留遠端 / 開啟編輯」的簡單選擇。
- v1 不做 JSON 語意層自動解衝突。

---

## 8. 安全底線

- 白名單機制 + `NEVER_SYNC`：機密（OAuth token）、`*.local`、session 歷史永不進入 repo。
- Remote 必須為私有 repo；UI 應提示使用者確認。
- settings.json 若含 token/API key，使用者須自審；v1 不主動加密（列為後續選項）。

---

## 9. 分階段實作與現況

| # | Stage | 狀態 |
|---|---|---|
| 1 | 後端骨架（唯讀）：`sync.js` 白名單 + `scanLocal`、IPC/preload、store `sync` key、Sidebar「同步」+ 唯讀 `SyncPage` | ✅ 完成 |
| 2 | Git 接管 + 能力探測、clone/init 私有 repo、`cim-sync.json` 讀寫、設定 remote 與本機裝置名 | ✅ 完成 |
| 3 | 推送（本機 → repo）：項目分派、複製進 `shared/` 或 `devices/<id>/`、settings base/overlay 拆分、commit + push | ⬜ |
| 4 | 拉取 + materialize（repo → 本機）：deep-merge、寫入 `~/.claude`、managed-manifest、備份、dry-run 預覽 | ⬜ |
| 5 | 變更 / 衝突偵測與解決 UI | ⬜ |
| 6 | 收尾：settings 鍵級分派 UI、新裝置 onboarding、per-item scope 編輯、安全確認 | ⬜ |

---

## 10. 相關檔案

- `src/main/sync.js` — 同步後端邏輯（白名單、掃描；後續加 git / 合併）
- `src/main/store.js` — `sync` 持久化 key（deviceId / remoteUrl / lastSyncAt）
- `src/main/ipc.js` — `sync:*` IPC handlers
- `src/preload/index.js` — `window.api.sync*`
- `src/renderer/src/pages/SyncPage.jsx` — 同步頁 UI
