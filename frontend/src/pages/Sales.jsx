import { useState } from 'react'
import Modal from '../components/Modal'
import { createSale, markSalePaid, deleteSale } from '../api'

const ITEM_TYPES = { computer: '컴퓨터', part: '부품', service: '서비스' }
const PAY_METHODS = { cash: '현금', transfer: '계좌이체', card: '카드', credit: '외상' }

const EMPTY = { customer_id: '', item_type: 'service', item_name: '', quantity: 1, unit_price: '', total_price: '', sale_date: new Date().toISOString().slice(0, 10), payment_method: 'card', engineer_id: '' }

function Sales({ sales, customers, engineers, loading, onRefresh }) {
  const [filterPaid, setFilterPaid] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY)

  const filtered = filterPaid === 'all' ? sales
    : filterPaid === 'paid' ? sales.filter(s => s.paid)
    : sales.filter(s => !s.paid)

  const getCustomerName = (id) => customers.find(c => c.id === id)?.name || '-'
  const getEngineerName = (id) => engineers.find(e => e.id === id)?.name || '-'

  const totalRevenue = sales.filter(s => s.paid).reduce((sum, s) => sum + s.total_price, 0)
  const unpaidAmount = sales.filter(s => !s.paid).reduce((sum, s) => sum + s.total_price, 0)

  const handleAdd = async () => {
    if (!form.customer_id || !form.item_name || !form.unit_price) return alert('고객, 품목, 단가를 입력하세요')
    await createSale({
      ...form,
      customer_id: Number(form.customer_id),
      quantity: Number(form.quantity),
      unit_price: Number(form.unit_price),
      total_price: Number(form.quantity) * Number(form.unit_price),
      engineer_id: form.engineer_id ? Number(form.engineer_id) : null,
    })
    setShowAdd(false)
    setForm(EMPTY)
    onRefresh()
  }

  const handlePay = async (id) => {
    await markSalePaid(id)
    onRefresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('이 판매를 삭제하시겠습니까?')) return
    await deleteSale(id)
    onRefresh()
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  if (loading && !sales.length) return <div className="loading">불러오는 중...</div>

  return (
    <div>
      <div className="page-header">
        <h2>판매 관리 ({sales.length}건)</h2>
        <button className="btn" onClick={() => { setForm(EMPTY); setShowAdd(true) }}>+ 판매 등록</button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 540, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">총 매출 (결제 완료)</div>
          <div className="stat-value" style={{ fontSize: 20 }}>₩{totalRevenue.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">미수금 (외상)</div>
          <div className="stat-value" style={{ fontSize: 20, color: unpaidAmount > 0 ? 'var(--danger)' : 'var(--gray-400)' }}>
            ₩{unpaidAmount.toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">전체 건수</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{sales.length}</div>
        </div>
      </div>

      <div className="filter-bar">
        {[['all', '전체'], ['paid', '결제완료'], ['unpaid', '미결제']].map(([v, label]) => (
          <button key={v} className={`filter-btn ${filterPaid === v ? 'active' : ''}`} onClick={() => setFilterPaid(v)}>
            {label}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>고객</th>
              <th>구분</th>
              <th>품목</th>
              <th>수량</th>
              <th>단가</th>
              <th>합계</th>
              <th>결제수단</th>
              <th>담당자</th>
              <th>결제상태</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={11} className="empty-state">판매 내역이 없습니다</td></tr>}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{s.sale_date}</td>
                <td><strong>{getCustomerName(s.customer_id)}</strong></td>
                <td><span className="badge new">{ITEM_TYPES[s.item_type] || s.item_type}</span></td>
                <td>{s.item_name}</td>
                <td style={{ textAlign: 'center' }}>{s.quantity}</td>
                <td style={{ textAlign: 'right' }}>₩{s.unit_price.toLocaleString()}</td>
                <td style={{ fontWeight: 600, textAlign: 'right' }}>₩{s.total_price.toLocaleString()}</td>
                <td style={{ fontSize: 12 }}>{PAY_METHODS[s.payment_method] || s.payment_method}</td>
                <td style={{ fontSize: 12 }}>{s.engineer_id ? getEngineerName(s.engineer_id) : '-'}</td>
                <td>
                  <span className={`badge ${s.paid ? 'paid' : 'unpaid'}`}>{s.paid ? '완료' : '미결제'}</span>
                </td>
                <td>
                  <div className="actions">
                    {!s.paid && <button className="btn btn-sm btn-success" onClick={() => handlePay(s.id)}>결제완료</button>}
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="판매 등록" onClose={() => setShowAdd(false)}>
          <div className="form-row">
            <div className="form-group">
              <label>고객 *</label>
              <select value={form.customer_id} onChange={set('customer_id')}>
                <option value="">선택</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>구분 *</label>
              <select value={form.item_type} onChange={set('item_type')}>
                <option value="computer">컴퓨터</option>
                <option value="part">부품</option>
                <option value="service">서비스</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>품목명 *</label>
            <input value={form.item_name} onChange={set('item_name')} placeholder="삼성 SSD 500GB" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>수량</label>
              <input type="number" value={form.quantity} onChange={set('quantity')} min={1} />
            </div>
            <div className="form-group">
              <label>단가 (원) *</label>
              <input type="number" value={form.unit_price} onChange={set('unit_price')} placeholder="75000" />
            </div>
          </div>
          {form.unit_price && form.quantity && (
            <div style={{ fontSize: 14, marginBottom: 12, color: 'var(--gray-600)' }}>
              합계: <strong style={{ color: 'var(--primary)' }}>₩{(Number(form.quantity) * Number(form.unit_price)).toLocaleString()}</strong>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label>판매일</label>
              <input type="date" value={form.sale_date} onChange={set('sale_date')} />
            </div>
            <div className="form-group">
              <label>결제수단</label>
              <select value={form.payment_method} onChange={set('payment_method')}>
                <option value="cash">현금</option>
                <option value="transfer">계좌이체</option>
                <option value="card">카드</option>
                <option value="credit">외상</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>담당자</label>
            <select value={form.engineer_id} onChange={set('engineer_id')}>
              <option value="">없음</option>
              {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>취소</button>
            <button className="btn" onClick={handleAdd}>등록</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Sales
