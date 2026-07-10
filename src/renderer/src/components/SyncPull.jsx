import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'

// 從 repo 拉取套用到本機（Stage 4）
// 先「檢查更新」做 dry-run 預覽，確認後才「套用到本機」；覆寫 / 移除前自動備份原檔。
const ACTION_LABEL = { create: '新增', overwrite: '覆寫', remove: '移除', unchanged: '無變更' }

export default function SyncPull({ onChanged }) {
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(false)

  const doPreview = async () => {
    setBusy(true)
    setError(null)
    setMsg(null)
    const r = await window.api.syncPreviewPull()
    setBusy(false)
    if (!r.ok) return setError(r.error || '預覽失敗')
    setPreview(r)
  }

  const doApply = async () => {
    setConfirm(false)
    setBusy(true)
    setError(null)
    setMsg(null)
    const r = await window.api.syncApplyPull()
    setBusy(false)
    if (!r.ok) return setError(r.error || '套用失敗')
    setMsg(
      `已套用：新增 ${r.created}、覆寫 ${r.overwritten}、移除 ${r.removed}。` +
        (r.backupDir ? '（原檔已備份）' : '')
    )
    setPreview(null)
    onChanged && onChanged()
  }

  const changing = preview ? preview.actions.filter((a) => a.action !== 'unchanged') : []

  return (
    <div className="field">
      <span className="field__label">從 repo 拉取套用到本機</span>
      <p className="field__hint">
        把 repo 的共用層與本機裝置層合併後套用到 <code>~/.claude</code>（settings.json
        為鍵級合併）。覆寫 / 移除前會自動備份原檔。
      </p>

      <div className="push-actions">
        <button className="btn" disabled={busy} onClick={doPreview}>
          {busy ? '處理中…' : '檢查更新'}
        </button>
        {preview && changing.length > 0 && (
          <button className="btn btn--primary" disabled={busy} onClick={() => setConfirm(true)}>
            套用到本機
          </button>
        )}
      </div>

      {preview &&
        (changing.length === 0 ? (
          <p className="field__hint">本機已是最新，無需變更。</p>
        ) : (
          <ul className="sync-list">
            {changing.map((a) => (
              <li key={a.path} className="sync-list__row">
                <span className="sync-list__name">{a.path}</span>
                <span className={`sync-list__tag pull-tag--${a.action}`}>
                  {ACTION_LABEL[a.action]}
                </span>
              </li>
            ))}
          </ul>
        ))}

      {preview?.pullError && (
        <p className="field__hint field__hint--error">
          注意：無法連上遠端更新（{preview.pullError}），以下為本機 repo 快取的結果。
        </p>
      )}
      {msg && <p className="field__hint">{msg}</p>}
      {error && <p className="field__hint field__hint--error">{error}</p>}

      <ConfirmDialog
        open={confirm}
        title="套用同步設定"
        message="即將把 repo 的設定套用到本機 ~/.claude，覆寫 / 移除的原檔會先備份。確定套用嗎？"
        confirmText="套用"
        onConfirm={doApply}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
