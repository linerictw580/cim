import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

// Claude Code 的 /usage 資料來源：向 Anthropic OAuth 端點即時查詢方案額度。
// 注意：此端點未公開、非官方文件，Claude 改版可能失效（屆時本頁會顯示錯誤而非崩潰）。
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const OAUTH_BETA = 'oauth-2025-04-20'

// 端點有速率限制（打太快會 429）。快取上一次成功結果，TTL 內的查詢直接回傳，
// 不再打 API —— 避免切分頁重新掛載 / 連點「重新整理」造成請求風暴。
const TTL = 60000
let cache = null // { result, at }

// 讀取 Claude Code 的 OAuth accessToken（由 claude CLI 維護，執行時會自動更新）
// 回傳字串 token；找不到檔案 / 格式不符時回傳 null
function readAccessToken() {
  try {
    const raw = readFileSync(join(homedir(), '.claude', '.credentials.json'), 'utf8')
    return JSON.parse(raw)?.claudeAiOauth?.accessToken || null
  } catch {
    return null
  }
}

// 從回應的 limits[] 取出單一種類，正規化為 { percent, resetsAt }
function pickLimit(limits, kind) {
  const l = limits.find((x) => x.kind === kind)
  if (!l) return null
  return { percent: l.percent, resetsAt: l.resets_at || null }
}

// 查詢方案額度用量（帶 TTL 快取與 429 退避）
// 回傳 { ok:true, session, weekly, scoped[], fetchedAt, stale? } 或 { ok:false, error }
// session / weekly 為 { percent, resetsAt }；scoped 為 [{ model, percent, resetsAt }]
export async function getUsage() {
  // TTL 內直接回傳快取，完全不打 API
  if (cache && Date.now() - cache.at < TTL) {
    return cache.result
  }

  const token = readAccessToken()
  if (!token) {
    return { ok: false, error: '找不到 Claude 認證資料，請先登入。' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  let res
  try {
    res = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        'anthropic-beta': OAUTH_BETA,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })
  } catch {
    // abort / 網路不通都落這裡
    return { ok: false, error: '無法連線至 Anthropic，請確認網路連線後重試。' }
  } finally {
    clearTimeout(timer)
  }

  // 請求過於頻繁：有舊資料就回傳（標記 stale），避免使用者看到錯誤
  if (res.status === 429) {
    if (cache) return { ...cache.result, stale: true }
    return { ok: false, error: '查詢過於頻繁，請稍候一分鐘再試。' }
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, error: '認證已過期，請於終端執行 claude 或重新登入後再試。' }
  }
  if (!res.ok) {
    return { ok: false, error: `取得用量失敗（HTTP ${res.status}）。` }
  }

  let data
  try {
    data = await res.json()
  } catch {
    return { ok: false, error: '回應格式無法解析，可能為 Claude 改版所致。' }
  }

  const limits = Array.isArray(data.limits) ? data.limits : []
  const scoped = limits
    .filter((l) => l.kind === 'weekly_scoped')
    .map((l) => ({
      model: l.scope?.model?.display_name || '未知模型',
      percent: l.percent,
      resetsAt: l.resets_at || null
    }))

  const result = {
    ok: true,
    session: pickLimit(limits, 'session'),
    weekly: pickLimit(limits, 'weekly_all'),
    scoped,
    fetchedAt: Date.now()
  }
  cache = { result, at: Date.now() }
  return result
}
