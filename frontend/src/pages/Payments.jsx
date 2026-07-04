import { completePayment } from '../api'

const METHOD_LABELS = { cash: '현금', transfer: '계좌이체', card: '카드', credit: '외상' }

function Payments({ payments, jobs, sales, loading, onRefresh }) {
  const getLabel = (p) => {
    if (p.job_id) {
      const j = jobs.find(j => j.id === p.job_id)
      return j ? `수리 #${p.job_id}` : `수리 #${p.job_id}`
    }
    if (p.sale_id) {
      const s = sales.find(s => s.id === p.sale_id)
      return s ? `판매 - ${s.item_name}` : `판매 #${p.sale_id}`
    }
    return '-'
  }

  const handleComplete = async (id) => {
    await completePayment(id)
    onRefresh()
  }

  const totalCompleted = payments.filter(p => p.payment_status === 'completed').reduce((s, p) => s + p.amount, 0)
  const totalPending = payments.filter(p => p.payment_status === 'pending').reduce((s, p) => s + p.amount, 0)

  if (loading && !payments.length) return <div className="loading">불러오는 중...</div>

  return (
    <div>
      <div className="page-header">
        <h2>결제 관리 ({payments.length}건)</h2>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: 540, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">결제 완료</div>
          <div className="stat-value" style={{ fontSize: 20 }}>₩{totalCompleted.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">미결제 (대기)</div>
          <div className="stat-value" style={{ fontSize: 20, color: totalPending > 0 ? 'var(--danger)' : 'var(--gray-400)' }}>
            ₩{totalPending.toLocaleString()}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">전체 건수</div>
          <div className="stat-value" style={{ fontSize: 24 }}>{payments.length}</div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>등록일</th>
              <th>구분</th>
              <th>금액</th>
              <th>결제수단</th>
              <th>상태</th>
              <th>결제일시</th>
              <th>납기일</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && <tr><td colSpan={8} className="empty-state">결제 내역이 없습니다</td></tr>}
            {payments.map((p) => (
              <tr key={p.id}>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{p.created_at?.slice(0, 10)}</td>
                <td style={{ fontSize: 13 }}>{getLabel(p)}</td>
                <td style={{ fontWeight: 600, textAlign: 'right' }}>₩{p.amount.toLocaleString()}</td>
                <td style={{ fontSize: 12 }}>{METHOD_LABELS[p.payment_method] || p.payment_method}</td>
                <td>
                  <span className={`badge ${p.payment_status === 'completed' ? 'completed' : 'pending'}`}>
                    {p.payment_status === 'completed' ? '완료' : '대기'}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                  {p.paid_at ? new Date(p.paid_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                </td>
                <td style={{ fontSize: 12, color: p.due_date && new Date(p.due_date) < new Date() ? 'var(--danger)' : 'var(--gray-600)' }}>
                  {p.due_date || '-'}
                </td>
                <td>
                  {p.payment_status === 'pending' && (
                    <button className="btn btn-sm btn-success" onClick={() => handleComplete(p.id)}>결제확인</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Payments
