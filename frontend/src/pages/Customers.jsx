import { useState } from 'react'
import Modal from '../components/Modal'
import { createCustomer, updateCustomer, deleteCustomer } from '../api'

const EMPTY_FORM = { name: '', customer_type: 'personal', company_name: '', contact_person: '', phone: '', phone2: '', email: '', address: '', address_detail: '', memo: '' }

function Customers({ customers, loading, onRefresh }) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const filtered = customers.filter(c => {
    const matchSearch = c.name.includes(search) || (c.phone && c.phone.includes(search)) || (c.company_name && c.company_name.includes(search))
    const matchType = filterType === 'all' || c.customer_type === filterType
    return matchSearch && matchType
  })

  const openAdd = () => { setForm(EMPTY_FORM); setShowAdd(true) }
  const openEdit = (c) => { setForm({ ...c }); setShowEdit(true) }

  const handleSave = async () => {
    await createCustomer(form)
    setShowAdd(false)
    onRefresh()
  }

  const handleUpdate = async () => {
    await updateCustomer(selected.id, form)
    setShowEdit(false)
    onRefresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('이 고객을 삭제하시겠습니까?')) return
    await deleteCustomer(id)
    setSelected(null)
    onRefresh()
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  if (loading && !customers.length) return <div className="loading">불러오는 중...</div>

  return (
    <div>
      <div className="page-header">
        <h2>고객 관리 ({customers.length}명)</h2>
        <button className="btn" onClick={openAdd}>+ 고객 추가</button>
      </div>

      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="이름, 회사명, 전화번호 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className={`filter-btn ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>전체 ({customers.length})</button>
        <button className={`filter-btn ${filterType === 'personal' ? 'active' : ''}`} onClick={() => setFilterType('personal')}>개인 ({customers.filter(c => c.customer_type === 'personal').length})</button>
        <button className={`filter-btn ${filterType === 'business' ? 'active' : ''}`} onClick={() => setFilterType('business')}>기업 ({customers.filter(c => c.customer_type === 'business').length})</button>
      </div>

      <div className={selected ? 'split-layout' : ''}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>구분</th>
                <th>명칭 / 식별명</th>
                <th>회사명</th>
                <th>전화</th>
                <th>주소</th>
                <th>미수금</th>
                <th>메모</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="empty-state">고객이 없습니다</td></tr>
              )}
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(selected?.id === c.id ? null : c)}
                  style={{ cursor: 'pointer', background: selected?.id === c.id ? '#e3f2fd' : '' }}
                >
                  <td>
                    <span className={`badge ${c.customer_type === 'business' ? 'assigned' : 'new'}`}>
                      {c.customer_type === 'business' ? '기업' : '개인'}
                    </span>
                  </td>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.company_name || <span style={{ color: 'var(--gray-300)' }}>-</span>}</td>
                  <td>{c.phone}</td>
                  <td>{c.address || '-'}</td>
                  <td>
                    {c.outstanding_amount > 0
                      ? <span className="outstanding">₩{c.outstanding_amount.toLocaleString()}</span>
                      : <span style={{ color: 'var(--gray-400)' }}>없음</span>
                    }
                  </td>
                  <td style={{ color: 'var(--gray-500)', fontSize: '12px' }}>{c.memo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="detail-panel">
            <h3>
              {selected.name}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(selected)}>수정</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selected.id)}>삭제</button>
              </div>
            </h3>

            <div className="detail-row">
              <span className="detail-label">구분</span>
              <span className="detail-value">
                <span className={`badge ${selected.customer_type === 'business' ? 'assigned' : 'new'}`}>
                  {selected.customer_type === 'business' ? '기업' : '개인'}
                </span>
              </span>
            </div>
            {selected.company_name && <div className="detail-row"><span className="detail-label">회사명</span><span className="detail-value">{selected.company_name}</span></div>}
            {selected.contact_person && <div className="detail-row"><span className="detail-label">담당자</span><span className="detail-value">{selected.contact_person}</span></div>}
            <div className="detail-row"><span className="detail-label">전화</span><span className="detail-value">{selected.phone}</span></div>
            {selected.phone2 && <div className="detail-row"><span className="detail-label">보조전화</span><span className="detail-value">{selected.phone2}</span></div>}
            {selected.email && <div className="detail-row"><span className="detail-label">이메일</span><span className="detail-value">{selected.email}</span></div>}
            <div className="detail-row"><span className="detail-label">주소</span><span className="detail-value">{selected.address || '-'} {selected.address_detail || ''}</span></div>
            <div className="detail-row">
              <span className="detail-label">미수금</span>
              <span className={`detail-value ${selected.outstanding_amount > 0 ? 'outstanding' : ''}`}>
                {selected.outstanding_amount > 0 ? `₩${selected.outstanding_amount.toLocaleString()}` : '없음'}
              </span>
            </div>
            {selected.memo && <div className="detail-row"><span className="detail-label">메모</span><span className="detail-value">{selected.memo}</span></div>}
            <div className="detail-row"><span className="detail-label">등록일</span><span className="detail-value">{selected.created_at?.slice(0, 10)}</span></div>
          </div>
        )}
      </div>

      {showAdd && (
        <Modal title="고객 추가" onClose={() => setShowAdd(false)}>
          <CustomerForm form={form} set={set} />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>취소</button>
            <button className="btn" onClick={handleSave}>저장</button>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title="고객 수정" onClose={() => setShowEdit(false)}>
          <CustomerForm form={form} set={set} />
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowEdit(false)}>취소</button>
            <button className="btn" onClick={handleUpdate}>저장</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CustomerForm({ form, set }) {
  const isBusiness = form.customer_type === 'business'
  return (
    <>
      <div className="form-group">
        <label>고객 구분 *</label>
        <select value={form.customer_type || 'personal'} onChange={set('customer_type')}>
          <option value="personal">개인</option>
          <option value="business">기업</option>
        </select>
      </div>
      {isBusiness && (
        <div className="form-row">
          <div className="form-group">
            <label>회사명 *</label>
            <input value={form.company_name || ''} onChange={set('company_name')} placeholder="(주)홍길동기업" />
          </div>
          <div className="form-group">
            <label>담당자명</label>
            <input value={form.contact_person || ''} onChange={set('contact_person')} placeholder="홍길동" />
          </div>
        </div>
      )}
      <div className="form-row">
        <div className="form-group">
          <label>{isBusiness ? '담당자 / 식별명' : '고객명 / 식별명'} *</label>
          <input value={form.name || ''} onChange={set('name')} placeholder="이름, 별칭, 주소, 회사명 등 식별 가능한 것" />
        </div>
        <div className="form-group">
          <label>전화번호 *</label>
          <input value={form.phone || ''} onChange={set('phone')} placeholder="01012345678" />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>보조 전화</label>
          <input value={form.phone2 || ''} onChange={set('phone2')} placeholder="선택" />
        </div>
        <div className="form-group">
          <label>이메일</label>
          <input value={form.email || ''} onChange={set('email')} placeholder="선택" />
        </div>
      </div>
      <div className="form-group">
        <label>주소</label>
        <input value={form.address || ''} onChange={set('address')} placeholder="서울시 강남구..." />
      </div>
      <div className="form-group">
        <label>상세주소</label>
        <input value={form.address_detail || ''} onChange={set('address_detail')} placeholder="101호..." />
      </div>
      <div className="form-group">
        <label>메모</label>
        <textarea value={form.memo || ''} onChange={set('memo')} placeholder="특이사항..." />
      </div>
    </>
  )
}

export default Customers
