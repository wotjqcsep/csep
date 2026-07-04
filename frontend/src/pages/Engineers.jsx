import { useState } from 'react'
import Modal from '../components/Modal'
import { createEngineer, updateEngineerStatus, deleteEngineer } from '../api'

const STATUS_LABELS = {
  idle: '대기',
  on_the_way: '출동',
  working: '작업중',
  off_duty: '퇴근',
}

const STATUS_LIST = ['idle', 'on_the_way', 'working', 'off_duty']

function Engineers({ engineers, loading, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '' })

  const handleStatusChange = async (id, status) => {
    await updateEngineerStatus(id, status)
    onRefresh()
  }

  const handleDelete = async (id) => {
    if (!confirm('이 기사를 삭제하시겠습니까?')) return
    await deleteEngineer(id)
    onRefresh()
  }

  const handleAdd = async () => {
    if (!form.name || !form.phone) return alert('이름과 전화번호를 입력하세요')
    await createEngineer(form)
    setShowAdd(false)
    setForm({ name: '', phone: '' })
    onRefresh()
  }

  if (loading && !engineers.length) return <div className="loading">불러오는 중...</div>

  return (
    <div>
      <div className="page-header">
        <h2>기사 관리 ({engineers.length}명)</h2>
        <button className="btn" onClick={() => setShowAdd(true)}>+ 기사 추가</button>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', maxWidth: 600, marginBottom: 24 }}>
        {STATUS_LIST.map(s => (
          <div className="stat-card" key={s}>
            <div className="stat-label">{STATUS_LABELS[s]}</div>
            <div className="stat-value" style={{ fontSize: 24 }}>
              {engineers.filter(e => e.status === s).length}
            </div>
          </div>
        ))}
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>이름</th>
              <th>전화</th>
              <th>현재 상태</th>
              <th>위치</th>
              <th>누적 작업</th>
              <th>누적 매출</th>
              <th>상태 변경</th>
              <th>삭제</th>
            </tr>
          </thead>
          <tbody>
            {engineers.length === 0 && (
              <tr><td colSpan={8} className="empty-state">등록된 기사가 없습니다</td></tr>
            )}
            {engineers.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.name}</strong></td>
                <td>{e.phone}</td>
                <td><span className={`badge ${e.status}`}>{STATUS_LABELS[e.status] || e.status}</span></td>
                <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{e.location || '-'}</td>
                <td>{e.total_jobs}건</td>
                <td>₩{(e.total_revenue || 0).toLocaleString()}</td>
                <td>
                  <div className="actions">
                    {STATUS_LIST.filter(s => s !== e.status).map(s => (
                      <button key={s} className="btn btn-sm btn-secondary" onClick={() => handleStatusChange(e.id, s)}>
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(e.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <Modal title="기사 추가" onClose={() => setShowAdd(false)}>
          <div className="form-group">
            <label>이름 *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍기사" />
          </div>
          <div className="form-group">
            <label>전화번호 *</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="01012345678" />
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>취소</button>
            <button className="btn" onClick={handleAdd}>추가</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default Engineers
