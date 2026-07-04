import { useState } from 'react'
import Modal from '../components/Modal'
import { updateJob } from '../api'

const STATUS_LABELS = { assigned: '배정', working: '작업중', completed: '완료' }

function History({ jobs, receptions, customers, engineers, loading, onRefresh }) {
  const [filterEngineer, setFilterEngineer] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showEdit, setShowEdit] = useState(null)
  const [form, setForm] = useState({})

  const getCustomerName = (receptionId) => {
    const r = receptions.find(r => r.id === receptionId)
    if (!r) return '-'
    return customers.find(c => c.id === r.customer_id)?.name || '-'
  }

  const getSymptom = (receptionId) => receptions.find(r => r.id === receptionId)?.symptom || '-'
  const getEngineerName = (id) => engineers.find(e => e.id === id)?.name || '-'

  const filtered = jobs.filter(j => {
    if (filterEngineer && String(j.engineer_id) !== filterEngineer) return false
    if (filterStatus !== 'all' && j.status !== filterStatus) return false
    return true
  })

  const openEdit = (j) => {
    setForm({ work_description: j.work_description || '', parts_used: j.parts_used || '', cost_parts: j.cost_parts || 0, cost_labor: j.cost_labor || 0, total_cost: j.total_cost || 0, status: j.status })
    setShowEdit(j)
  }

  const handleUpdate = async () => {
    await updateJob(showEdit.id, {
      ...form,
      cost_parts: Number(form.cost_parts),
      cost_labor: Number(form.cost_labor),
      total_cost: Number(form.cost_parts) + Number(form.cost_labor),
    })
    setShowEdit(null)
    onRefresh()
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  if (loading && !jobs.length) return <div className="loading">불러오는 중...</div>

  const totalRevenue = jobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.total_cost || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h2>수리 이력 ({jobs.length}건)</h2>
        <div style={{ fontSize: 14, color: 'var(--gray-600)' }}>
          완료 매출: <strong style={{ color: 'var(--primary)' }}>₩{totalRevenue.toLocaleString()}</strong>
        </div>
      </div>

      <div className="filter-bar">
        {[['all', '전체'], ['assigned', '배정'], ['working', '작업중'], ['completed', '완료']].map(([s, label]) => (
          <button key={s} className={`filter-btn ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
            {label} ({s === 'all' ? jobs.length : jobs.filter(j => j.status === s).length})
          </button>
        ))}
        <select
          value={filterEngineer}
          onChange={e => setFilterEngineer(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 20, border: '1px solid var(--gray-300)', fontSize: 13 }}
        >
          <option value="">전체 기사</option>
          {engineers.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>고객</th>
              <th>증상</th>
              <th>담당 기사</th>
              <th>상태</th>
              <th>작업 내용</th>
              <th>사용 부품</th>
              <th>부품비</th>
              <th>공임비</th>
              <th>합계</th>
              <th>수정</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={11} className="empty-state">이력이 없습니다</td></tr>}
            {filtered.map((j) => (
              <tr key={j.id}>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{j.scheduled_date || '-'}</td>
                <td><strong>{getCustomerName(j.reception_id)}</strong></td>
                <td style={{ fontSize: 12, color: 'var(--gray-600)' }}>{getSymptom(j.reception_id)}</td>
                <td>{getEngineerName(j.engineer_id)}</td>
                <td><span className={`badge ${j.status}`}>{STATUS_LABELS[j.status] || j.status}</span></td>
                <td style={{ fontSize: 12 }}>{j.work_description || <span style={{ color: 'var(--gray-400)' }}>-</span>}</td>
                <td style={{ fontSize: 12 }}>{j.parts_used || <span style={{ color: 'var(--gray-400)' }}>-</span>}</td>
                <td style={{ fontSize: 12, textAlign: 'right' }}>{j.cost_parts > 0 ? `₩${j.cost_parts.toLocaleString()}` : '-'}</td>
                <td style={{ fontSize: 12, textAlign: 'right' }}>{j.cost_labor > 0 ? `₩${j.cost_labor.toLocaleString()}` : '-'}</td>
                <td style={{ fontWeight: 600, color: j.total_cost > 0 ? 'var(--primary)' : 'var(--gray-400)', textAlign: 'right' }}>
                  {j.total_cost > 0 ? `₩${j.total_cost.toLocaleString()}` : '-'}
                </td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(j)}>수정</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEdit && (
        <Modal title="작업 이력 수정" onClose={() => setShowEdit(null)}>
          <div style={{ marginBottom: 14, padding: 12, background: 'var(--gray-50)', borderRadius: 8, fontSize: 13 }}>
            <strong>{getCustomerName(showEdit.reception_id)}</strong> — {getSymptom(showEdit.reception_id)}
          </div>
          <div className="form-group">
            <label>상태</label>
            <select value={form.status} onChange={set('status')}>
              <option value="assigned">배정</option>
              <option value="working">작업중</option>
              <option value="completed">완료</option>
            </select>
          </div>
          <div className="form-group">
            <label>작업 내용</label>
            <textarea value={form.work_description} onChange={set('work_description')} placeholder="수행한 작업 내용..." />
          </div>
          <div className="form-group">
            <label>사용 부품</label>
            <input value={form.parts_used} onChange={set('parts_used')} placeholder="LVDS 케이블 1개, SSD 1개..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>부품비 (원)</label>
              <input type="number" value={form.cost_parts} onChange={set('cost_parts')} />
            </div>
            <div className="form-group">
              <label>공임비 (원)</label>
              <input type="number" value={form.cost_labor} onChange={set('cost_labor')} />
            </div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 12 }}>
            합계: <strong style={{ color: 'var(--primary)' }}>₩{(Number(form.cost_parts) + Number(form.cost_labor)).toLocaleString()}</strong>
          </div>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setShowEdit(null)}>취소</button>
            <button className="btn" onClick={handleUpdate}>저장</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default History
