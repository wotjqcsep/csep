import { useState } from 'react'
import Modal from '../components/Modal'
import { createInventory, updateInventory, deleteInventory } from '../api'

const CATEGORIES = { cpu: 'CPU', ram: 'RAM', ssd: 'SSD', hdd: 'HDD', gpu: 'GPU', power: '파워', case: '케이스', cable: '케이블', other: '기타' }

const EMPTY = { part_name: '', part_code: '', category: 'other', quantity: 0, reorder_level: 5, unit_cost: '', unit_price: '', supplier: '', supplier_phone: '', location: '' }

function Inventory({ inventory, loading, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [filterLow, setFilterLow] = useState(false)

  const lowStockCount = inventory.filter(i => i.quantity <= i.reorder_level).length
  const totalValue = inventory.reduce((s, i) => s + (i.quantity * (i.unit_cost || 0)), 0)

  const filtered = filterLow ? inventory.filter(i => i.quantity <= i.reorder_level) : inventory

  const openEdit = (item) => { setForm({ ...item }); setShowEdit(item) }

  const handleAdd = async () => {
    if (!form.part_name) return alert('부품명을 입력하세요')
    await createInventory({ ...form, quantity: Number(form.quantity), reorder_level: Number(form.reorder_level), unit_cost: Number(form.unit_cost) || null, unit_price: Number(form.unit_price) || null })
    setShowAdd(false)
    setForm(EMPTY)
    onRefresh()
  }

  const handleUpdate = async () => {
    await updateInventory(showEdit.id, { ...form, quantity: Number(form.quantity), reorder_level: Number(form.reorder_level), unit_cost: Number(form.unit_cost) || null, unit_price: Number(form.unit_price) || null })
    setShowEdit(null)
    onRefresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('이 재고를 삭제하시겠습니까?')) return
    await deleteInventory(id)
    onRefresh()
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  if (loading && !inventory.length) return <div className="loading">불러오는 중...</div>

  return (
    <div>
      <div className="page-header">
        <h2>재고 관리 ({inventory.length}종)</h2>
        <button className="btn" onClick={() => { setForm(EMPTY); setShowAdd(true) }}>+ 부품 등록</button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 540, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">총 종류</div>
          <div className="stat-value" style={{ fontSize: 24 }}>{inventory.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">재고 부족</div>
          <div className="stat-value" style={{ fontSize: 24, color: lowStockCount > 0 ? 'var(--danger)' : 'var(--gray-400)' }}>{lowStockCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">재고 총 가치</div>
          <div className="stat-value" style={{ fontSize: 18 }}>₩{totalValue.toLocaleString()}</div>
        </div>
      </div>

      <div className="filter-bar">
        <button className={`filter-btn ${!filterLow ? 'active' : ''}`} onClick={() => setFilterLow(false)}>전체 ({inventory.length})</button>
        <button className={`filter-btn ${filterLow ? 'active' : ''}`} onClick={() => setFilterLow(true)} style={{ color: lowStockCount > 0 ? 'var(--danger)' : '' }}>
          재고부족 ({lowStockCount})
        </button>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>부품명</th>
              <th>코드</th>
              <th>분류</th>
              <th>수량</th>
              <th>재주문 기준</th>
              <th>원가</th>
              <th>판매가</th>
              <th>공급처</th>
              <th>위치</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={10} className="empty-state">재고가 없습니다</td></tr>}
            {filtered.map((item) => (
              <tr key={item.id} className={item.quantity <= item.reorder_level ? 'low-stock' : ''}>
                <td><strong>{item.part_name}</strong></td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.part_code || '-'}</td>
                <td><span className="badge new" style={{ fontSize: 11 }}>{CATEGORIES[item.category] || item.category}</span></td>
                <td style={{ textAlign: 'center', fontWeight: item.quantity <= item.reorder_level ? 700 : 400, color: item.quantity <= item.reorder_level ? 'var(--danger)' : '' }}>
                  {item.quantity}
                  {item.quantity <= item.reorder_level && <span className="badge low" style={{ marginLeft: 6, fontSize: 10 }}>부족</span>}
                </td>
                <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-500)' }}>{item.reorder_level}</td>
                <td style={{ textAlign: 'right', fontSize: 12 }}>{item.unit_cost ? `₩${item.unit_cost.toLocaleString()}` : '-'}</td>
                <td style={{ textAlign: 'right', fontSize: 12 }}>{item.unit_price ? `₩${item.unit_price.toLocaleString()}` : '-'}</td>
                <td style={{ fontSize: 12 }}>{item.supplier || '-'}</td>
                <td style={{ fontSize: 12 }}>{item.location || '-'}</td>
                <td>
                  <div className="actions">
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>수정</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(showAdd || showEdit) && (
        <Modal title={showAdd ? '부품 등록' : '부품 수정'} onClose={() => { setShowAdd(false); setShowEdit(null) }}>
          <InventoryForm form={form} set={set} />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => { setShowAdd(false); setShowEdit(null) }}>취소</button>
            <button className="btn" onClick={showAdd ? handleAdd : handleUpdate}>저장</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function InventoryForm({ form, set }) {
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>부품명 *</label>
          <input value={form.part_name || ''} onChange={set('part_name')} placeholder="삼성 SSD 500GB" />
        </div>
        <div className="form-group">
          <label>부품 코드</label>
          <input value={form.part_code || ''} onChange={set('part_code')} placeholder="SSD-SAM-500" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>분류</label>
          <select value={form.category || 'other'} onChange={set('category')}>
            {Object.entries({ cpu: 'CPU', ram: 'RAM', ssd: 'SSD', hdd: 'HDD', gpu: 'GPU', power: '파워', case: '케이스', cable: '케이블', other: '기타' }).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>창고 위치</label>
          <input value={form.location || ''} onChange={set('location')} placeholder="선반 A-1" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>현재 수량</label>
          <input type="number" value={form.quantity || 0} onChange={set('quantity')} min={0} />
        </div>
        <div className="form-group">
          <label>재주문 기준 수량</label>
          <input type="number" value={form.reorder_level || 5} onChange={set('reorder_level')} min={0} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>원가 (원)</label>
          <input type="number" value={form.unit_cost || ''} onChange={set('unit_cost')} />
        </div>
        <div className="form-group">
          <label>판매가 (원)</label>
          <input type="number" value={form.unit_price || ''} onChange={set('unit_price')} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>공급처</label>
          <input value={form.supplier || ''} onChange={set('supplier')} placeholder="삼성전자" />
        </div>
        <div className="form-group">
          <label>공급처 전화</label>
          <input value={form.supplier_phone || ''} onChange={set('supplier_phone')} placeholder="02-1234-5678" />
        </div>
      </div>
    </>
  )
}

export default Inventory
