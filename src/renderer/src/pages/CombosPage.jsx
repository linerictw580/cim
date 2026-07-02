import { useEffect, useState } from 'react'

// 啟動組合頁：列出使用者自定義的 combo，每個 combo 可一鍵啟動其下所有 group。
// 此階段為骨架 —— 只負責讀取與空狀態，CRUD / 編輯 / 啟動於後續階段接上。
export default function CombosPage() {
  const [combos, setCombos] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.api.getCombos().then((list) => {
      setCombos(list || [])
      setLoaded(true)
    })
  }, [])

  return (
    <section className="page">
      <header className="page__header">
        <h1>組合</h1>
      </header>

      {loaded && combos.length === 0 ? (
        <div className="empty">尚未建立任何組合。</div>
      ) : (
        <ul className="combo-list">
          {combos.map((c) => (
            <li key={c.id} className="combo-card">
              {c.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
