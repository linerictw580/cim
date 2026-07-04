import { useState, useRef, useEffect } from 'react'
import { ChevronDownIcon } from './icons'

// 客製下拉選單：native <select> 的選項清單無法套用樣式，故自製以比照 App 內選單風格。
// options: [{ value, label }]；align: 'left'（預設）/ 'right' 決定選單對齊哪一側
export default function Dropdown({ value, options, onChange, title, align = 'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // 點選單外側或按 Esc 時關閉
  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = options.find((o) => o.value === value)

  const pick = (v) => {
    setOpen(false)
    if (v !== value) onChange(v)
  }

  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        className="dropdown__trigger"
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{current?.label}</span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className={`dropdown__menu ${align === 'right' ? 'dropdown__menu--right' : ''}`}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`dropdown__item ${o.value === value ? 'is-active' : ''}`}
              onClick={() => pick(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
