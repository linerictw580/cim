import { useEffect, useState } from 'react'

// claude 已安裝但不在系統 PATH 時顯示：提示 + 一鍵加入 PATH
// 成功後短暫顯示成功訊息，再呼叫 onDone（通常是重新查詢認證狀態，使 inPath 更新後本元件消失）
export default function PathNotice({ onDone }) {
  const [state, setState] = useState('idle') // idle | working | done | error
  const [error, setError] = useState(null)

  const handleAdd = async () => {
    setState('working')
    setError(null)
    const res = await window.api.addToPath()
    if (res.ok) {
      setState('done')
    } else {
      setState('error')
      setError(res.error || '未知錯誤')
    }
  }

  // 成功後 3 秒觸發 onDone（刷新 auth 讓 inPath 更新，本元件隨之卸載）
  useEffect(() => {
    if (state !== 'done') return
    const timer = setTimeout(() => onDone && onDone(), 3000)
    return () => clearTimeout(timer)
  }, [state, onDone])

  if (state === 'done') {
    return (
      <div className="pathnotice pathnotice--ok">
        已將 claude 加入使用者 PATH，請重新開啟終端機後生效。
      </div>
    )
  }

  return (
    <div className="pathnotice">
      <div className="pathnotice__body">
        <span className="pathnotice__text">
          claude 已安裝但未加入系統 PATH，其他終端機無法直接執行 claude。
        </span>
        {error && <span className="pathnotice__error">{error}</span>}
      </div>
      <button className="pathnotice__btn" onClick={handleAdd} disabled={state === 'working'}>
        {state === 'working' ? '加入中…' : '一鍵加入 PATH'}
      </button>
    </div>
  )
}
