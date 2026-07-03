import { useCallback, useEffect, useState } from 'react'

// 把 resets_at（ISO 字串）格式化為「X 小時 Y 分後重置 · 本地時間」
function formatReset(resetsAt) {
  if (!resetsAt) return null
  const target = new Date(resetsAt)
  if (Number.isNaN(target.getTime())) return null

  const diffMs = target.getTime() - Date.now()
  const local = target.toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  if (diffMs <= 0) return `即將重置 · ${local}`

  const totalMin = Math.round(diffMs / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const rel = h > 0 ? `${h} 小時 ${m} 分後重置` : `${m} 分後重置`
  return `${rel} · ${local}`
}

// 單一額度進度條：>=80% 轉為警示色
function UsageBar({ label, percent, resetsAt }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent ?? 0)))
  const reset = formatReset(resetsAt)
  return (
    <div className="usage-item">
      <div className="usage-item__head">
        <span className="usage-item__label">{label}</span>
        <span className="usage-item__pct">{pct}%</span>
      </div>
      <div className="usage-bar">
        <div
          className={`usage-bar__fill ${pct >= 80 ? 'is-high' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {reset && <div className="usage-item__reset">{reset}</div>}
    </div>
  )
}

const COOLDOWN = 60 // 秒；與主行程快取 TTL 對齊，期間重新整理只會取回快取

export default function UsagePage() {
  const [state, setState] = useState('loading') // loading | ready | error
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [cooldown, setCooldown] = useState(0)

  const load = useCallback(async () => {
    setState('loading')
    setError(null)
    const res = await window.api.getUsage()
    if (res.ok) {
      setData(res)
      setState('ready')
      setCooldown(COOLDOWN) // 成功後進入冷卻，避免連點打爆端點
    } else {
      setError(res.error || '取得用量失敗。')
      setState('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // 冷卻倒數：每秒遞減至 0
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  return (
    <section className="page">
      <header className="page__header">
        <h1>用量</h1>
        <div className="page__header-actions">
          <button
            className="btn"
            onClick={load}
            disabled={state === 'loading' || cooldown > 0}
          >
            {state === 'loading'
              ? '讀取中…'
              : cooldown > 0
                ? `重新整理（${cooldown}s）`
                : '重新整理'}
          </button>
        </div>
      </header>

      {state === 'loading' && <p className="field__hint">正在讀取方案額度…</p>}

      {state === 'error' && <p className="field__hint field__hint--error">{error}</p>}

      {state === 'ready' && data && (
        <div className="usage">
          {data.session && <UsageBar label="本次 session（5 小時）" {...data.session} />}
          {data.weekly && <UsageBar label="本週（所有模型）" {...data.weekly} />}

          {data.scoped?.length > 0 && (
            <div className="usage-group">
              <div className="usage-group__title">本週各模型額度</div>
              {data.scoped.map((s, i) => (
                <UsageBar key={`${s.model}-${i}`} label={s.model} {...s} />
              ))}
            </div>
          )}

          <p className="field__hint">
            資料來自 Claude 訂閱方案額度（同 /usage）；為未公開 API，Claude 改版時可能失效。
            {data.fetchedAt &&
              ` 更新於 ${new Date(data.fetchedAt).toLocaleTimeString('zh-TW', { hour12: false })}。`}
            {data.stale && ' 目前請求較頻繁，顯示為前次快取。'}
          </p>
        </div>
      )}
    </section>
  )
}
