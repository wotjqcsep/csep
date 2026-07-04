import { useState } from 'react'
import Modal from '../components/Modal'
import { assignReception, updateReceptionStatus, createReception, deleteReception } from '../api'

const STATUS_LABELS = { new: '신규', assigned: '배정', in_progress: '진행중', completed: '완료', cancelled: '취소' }
const CHANNEL_ICONS = { phone: '📞', sms: '💬', kakao: '💭', direct: '📋' }
const CHANNEL_LABELS = { phone: '전화', sms: 'SMS', kakao: '카카오톡', direct: '직접등록' }

const EMPTY = { customer_id: '', symptom: '', reception_channel: 'phone', reception_phone: '', initial_memo: '', computer_id: '' }

function Receptions({ receptions, engineers, customers, loading, onRefresh }) {
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showAssign, setShowAssign] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [assignEngineerId, setAssignEngineerId] = useState('')

  const filtered = filterStatus === 'all' ? receptions : receptions.filter(r => r.status === filterStatus)

  const getCustomerName = (id) => customers.find(c => c.id === id)?.name || `고객 ${id}`
  const getEngineerName = (id) => engineers.find(e => e.id === id)?.name || '-'

  const handleAssign = async () => {
    if (!assignEngineerId) return alert('기사를 선택하세요')
    await assignReception(showAssign.id, Number(assignEngineerId))
    setShowAssign(null)
    onRefresh()
  }

  const handleStatus = async (id, status) => {
    await updateReceptionStatus(id, status)
    onRefresh()
  }

  const handleAdd = async () => {
    if (!form.customer_id || !form.symptom) return alert('고객과 증상을 입력하세요')
    await createReception({ ...form, customer_id: Number(form.customer_id) })
    setShowAdd(false)
    setForm(EMPTY)
    onRefresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('이 접수를 삭제하시겠습니까?')) return
    await deleteReception(id)
    onRefresh()
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const countByStatus = (s) => receptions.filter(r => r.status === s).length

  if (loading && !receptions.length) return <div className="loading">불러오는 중...</div>

  return (
    <div>
      <div className="page-header">
        <h2>접수 관리 (전체 {receptions.length}건)</h2>
        <button className="btn" onClick={() => { setForm(EMPTY); setShowAdd(true) }}>+ 접수 등록</button>
      </div>

      <div className="filter-bar">
        {[['all', '전체'], ['new', '신규'], ['assigned', '배정'], ['in_progress', '진행중'], ['completed', '완료']].map(([s, label]) => (
          <button
            key={s}
            className={`filter-btn ${filterStatus === s ? 'active' : ''}`}
            onClick={() => setFilterStatus(s)}
          >
            {label} {s !== 'all' ? `(${countByStatus(s)})` : `(${receptions.length})`}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>고객</th>
              <th>채널</th>
              <th>증상</th>
              <th>상태</th>
              <th>배정 기사</th>
              <th>접수 시간</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={8} className="empty-state">접수가 없습니다</td></tr>}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td style={{ color: 'var(--gray-400)', fontSize: 12 }}>{r.id}</td>
                <td><strong>{getCustomerName(r.customer_id)}</strong></td>
                <td title={CHANNEL_LABELS[r.reception_channel]}>{CHANNEL_ICONS[r.reception_channel] || '📋'}</td>
                <td>{r.symptom}</td>
                <td><span className={`badge ${r.status}`}>{STATUS_LABELS[r.status] || r.status}</span></td>
                <td>{r.assigned_engineer_id ? getEngineerName(r.assigned_engineer_id) : <span style={{ color: 'var(--gray-400)' }}>미배정</span>}</td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  {r.received_at ? new Date(r.received_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td>
                  <div className="actions">
                    {r.status === 'new' && (
                      <button className="btn btn-sm" onClick={() => { setShowAssign(r); setAssignEngineerId('') }}>배정</button>
                    )}
                    {r.status === 'assigned' && (
                      <button className="btn btn-sm btn-success" onClick={() => handleStatus(r.id, 'in_progress')}>시작</button>
                    )}
                    {r.status === 'in_progress' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => handleStatus(r.id, 'completed')}>완료</button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="접수 등록" onClose={() => setShowAdd(false)}>
          <div className="form-row">
            <div className="form-group">
              <label>고객 *</label>
              <select value={form.customer_id} onChange={set('customer_id')}>
                <option value="">선택</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>접수 채널 *</label>
              <select value={form.reception_channel} onChange={set('reception_channel')}>
                <option value="phone">전화</option>
                <option value="sms">SMS</option>
                <option value="kakao">카카오톡</option>
                <option value="direct">직접등록</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>전화번호</label>
            <input value={form.reception_phone} onChange={set('reception_phone')} placeholder="발신 번호" />
          </div>
          <div className="form-group">
            <label>증상 *</label>
            <textarea value={form.symptom} onChange={set('symptom')} placeholder="고장 증상을 입력하세요..." />
          </div>
          <div className="form-group">
            <label>초기 메모</label>
            <textarea value={form.initial_memo} onChange={set('initial_memo')} placeholder="상담 내용..." />
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>취소</button>
            <button className="btn" onClick={handleAdd}>접수 등록</button>
          </div>
        </Modal>
      )}

      {showAssign && (
        <Modal title={`기사 배정 - ${getCustomerName(showAssign.customer_id)}`} onClose={() => setShowAssign(null)}>
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--gray-50)', borderRadius: 8, fontSize: 13 }}>
            <strong>증상:</strong> {showAssign.symptom}
          </div>
          <div className="form-group">
            <label>배정할 기사 선택</label>
            <select value={assignEngineerId} onChange={e => setAssignEngineerId(e.target.value)}>
              <option value="">선택하세요</option>
              {engineers.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.status === 'idle' ? '대기' : e.status === 'working' ? '작업중' : e.status === 'on_the_way' ? '출동중' : '퇴근'})
                </option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowAssign(null)}>취소</button>
            <button className="btn" onClick={handleAssign}>배정</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Receptions
