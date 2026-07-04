import { useState, useRef, useEffect } from 'react'

function CustomerSelect({ customers, value, onChange }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selected = customers.find(c => String(c.id) === String(value))

  const filtered = customers.filter(c => {
    const q = search.toLowerCase()
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.company_name?.toLowerCase().includes(q)
  })

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (c) => {
    onChange(String(c.id))
    setSearch('')
    setOpen(false)
  }

  const clear = () => { onChange(''); setSearch(''); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: '1px solid var(--gray-300)', borderRadius: 8, padding: '7px 10px',
          background: 'white', cursor: 'text', minHeight: 38,
        }}
        onClick={() => setOpen(true)}
      >
        {!open && selected ? (
          <>
            <span style={{ flex: 1, fontSize: 14 }}>{selected.name} <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>({selected.phone})</span></span>
            <button onClick={e => { e.stopPropagation(); clear() }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
          </>
        ) : (
          <input
            autoFocus={open}
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={selected ? `${selected.name} (${selected.phone})` : '이름, 전화번호 검색...'}
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, background: 'transparent' }}
          />
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: 'white', border: '1px solid var(--gray-200)', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', marginTop: 2,
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', color: 'var(--gray-400)', fontSize: 13 }}>검색 결과 없음</div>
          ) : (
            filtered.map(c => (
              <div
                key={c.id}
                onMouseDown={() => select(c)}
                style={{
                  padding: '9px 14px', cursor: 'pointer', fontSize: 14,
                  background: String(c.id) === String(value) ? 'var(--primary-light, #e3f2fd)' : 'white',
                  borderBottom: '1px solid var(--gray-100)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                onMouseLeave={e => e.currentTarget.style.background = String(c.id) === String(value) ? '#e3f2fd' : 'white'}
              >
                <strong>{c.name}</strong>
                <span style={{ color: 'var(--gray-400)', fontSize: 12, marginLeft: 8 }}>{c.phone}</span>
                {c.company_name && <span style={{ color: 'var(--gray-500)', fontSize: 12, marginLeft: 6 }}>· {c.company_name}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default CustomerSelect
