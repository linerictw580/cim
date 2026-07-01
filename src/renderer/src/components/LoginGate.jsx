import { useState } from 'react'
import { CopyIcon, CheckIcon } from './icons'
import PathNotice from './PathNotice'

// 官方安裝指令（https://code.claude.com/docs/en/quickstart）
const INSTALL_COMMANDS = [
  { label: 'Windows PowerShell', cmd: 'irm https://claude.ai/install.ps1 | iex' },
  {
    label: 'Windows CMD',
    cmd: 'curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd'
  }
]

// 指令區塊：monospace 指令 + 一鍵複製
function CommandBlock({ label, command }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    window.api.copyText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="cmd-block">
      <div className="cmd-block__label">{label}</div>
      <div className="cmd-block__row">
        <code className="cmd-block__code">{command}</code>
        <button
          className="cmd-block__copy"
          onClick={handleCopy}
          title={copied ? '已複製' : '複製'}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
    </div>
  )
}

// 全畫面認證引導：未安裝 claude 或尚未登入時顯示
export default function LoginGate({ status, onRefresh }) {
  const [checking, setChecking] = useState(false)
  const notInstalled = !status.installed

  const [loginError, setLoginError] = useState(null)
  const [busy, setBusy] = useState(false) // 正在開啟登入終端
  const [launched, setLaunched] = useState(false) // 已開啟，等待使用者於終端完成登入

  const handleLogin = async () => {
    setLoginError(null)
    setLaunched(false)
    setBusy(true)
    const res = await window.api.login() // 開終端執行 claude auth login
    setBusy(false)
    if (res && !res.ok) {
      setLoginError(`開啟登入終端失敗：${res.error || '未知錯誤'}`)
    } else {
      setLaunched(true)
    }
  }

  const handleRecheck = async () => {
    setChecking(true)
    await onRefresh()
    setChecking(false)
  }

  return (
    <div className="gate">
      <div className="gate__card">
        <div className="gate__logo">CIM</div>

        {notInstalled ? (
          <>
            <h1 className="gate__title">尚未安裝 Claude Code</h1>
            <p className="gate__text">
              請先安裝 Claude Code 才能使用本工具。依你慣用的終端機複製指令安裝：
            </p>
            {INSTALL_COMMANDS.map((c) => (
              <CommandBlock key={c.label} label={c.label} command={c.cmd} />
            ))}
            <div className="gate__actions">
              <button className="btn btn--primary" onClick={handleRecheck} disabled={checking}>
                {checking ? '檢查中…' : '重新檢查'}
              </button>
            </div>
            <p className="gate__hint">安裝完成後點「重新檢查」。</p>
          </>
        ) : (
          <>
            <h1 className="gate__title">尚未登入 Claude</h1>
            <p className="gate__text">
              點「登入」會開啟終端機執行 <code>claude auth login</code>，請在終端內完成登入。
            </p>
            {status.error && <p className="gate__error">{status.error}</p>}
            {loginError && <p className="gate__error">{loginError}</p>}
            <div className="gate__actions">
              <button className="btn btn--primary" onClick={handleLogin} disabled={busy}>
                {busy ? '開啟中…' : '登入'}
              </button>
              <button className="btn" onClick={handleRecheck} disabled={checking}>
                {checking ? '檢查中…' : '重新檢查'}
              </button>
            </div>
            {launched && !loginError ? (
              <p className="gate__hint">
                已開啟登入終端，請在彈出的 PowerShell 視窗完成登入，完成後會自動進入主畫面。
              </p>
            ) : (
              <p className="gate__hint">完成登入後會自動偵測並進入主畫面。</p>
            )}
            {!status.inPath && <PathNotice onDone={onRefresh} />}
          </>
        )}
      </div>
    </div>
  )
}
