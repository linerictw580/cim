import { useState } from 'react'
import { CopyIcon, CheckIcon } from './icons'

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

  const handleLogin = async () => {
    setLoginError(null)
    const res = await window.api.login() // 開終端執行 claude auth login
    if (res && !res.ok) {
      setLoginError(`開啟登入終端失敗：${res.error || '未知錯誤'}`)
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
              <button className="btn btn--primary" onClick={handleLogin}>
                登入
              </button>
              <button className="btn" onClick={handleRecheck} disabled={checking}>
                {checking ? '檢查中…' : '重新檢查'}
              </button>
            </div>
            <p className="gate__hint">完成登入後會自動偵測並進入主畫面。</p>
          </>
        )}
      </div>
    </div>
  )
}
